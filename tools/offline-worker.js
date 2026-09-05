/* Build replaces this one configuration token with an immutable core inventory. */
const CONFIG = __SOLITAIRE_SW_CONFIG__;
const SCOPE = new URL(self.registration.scope);
const CACHE = `mangoidiots-solitaire-core-${encodeURIComponent(SCOPE.pathname)}-${CONFIG.digest}`;
const CORE = new Map(CONFIG.files.map((file) => [new URL(file.path, SCOPE).href, file]));
const INDEX = new URL("./", SCOPE).href;
const RESUME = new URL("resume/index.html", SCOPE).href;
let repairTask;

function assertResponse(response, file) {
  if (!response || !response.ok || response.redirected || response.type === "opaque") {
    throw new Error(`Missing, redirected, or unsuccessful core response: ${file.path || "./"}`);
  }
  const contentType = (response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const compatible = {
    "text/javascript": ["text/javascript", "application/javascript"],
    "application/manifest+json": ["application/manifest+json", "application/json"],
    "audio/wav": ["audio/wav", "audio/x-wav"],
  };
  if (!(compatible[file.contentType] || [file.contentType]).includes(contentType)) {
    throw new Error(`Unexpected content type for ${file.path || "./"}. Check host caching or rewrites.`);
  }
}

async function digest(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function checkResponse(response, file) {
  assertResponse(response, file);
  if (file.sha256) {
    const actual = await digest(await response.clone().arrayBuffer());
    if (actual !== file.sha256) throw new Error(`Core integrity mismatch: ${file.path}`);
  }
  if (file.contentType === "text/html") {
    const html = await response.clone().text();
    if (!html.includes(`solitaire-build-${CONFIG.digest}`) || html.includes("__SOLITAIRE_BASE__")) {
      throw new Error("The game page belongs to a different build or has an unresolved hosting path.");
    }
  } else if (file.path === "themes.json") {
    const list = await response.clone().json();
    if (list.defaultTheme !== "chola" || !Array.isArray(list.themes)
        || !["chola", "mughal"].every((id) => list.themes.some((theme) => theme.id === id && theme.version === "1.0.0"))) {
      throw new Error("The server returned an invalid theme menu.");
    }
    for (const theme of list.themes) {
      if (!theme || typeof theme.url !== "string" || !theme.url.startsWith("themes/")) {
        throw new Error("The theme menu contains an invalid asset URL.");
      }
      const url = new URL(theme.url, SCOPE);
      if (url.origin !== SCOPE.origin || !url.pathname.startsWith(`${SCOPE.pathname}themes/`)
          || !url.pathname.endsWith(".zip") || url.search || url.hash) {
        throw new Error("The theme menu contains a non-game asset URL.");
      }
    }
  }
}

async function status() {
  const cache = await caches.open(CACHE);
  let files = 0;
  const failures = [];
  for (const [url, file] of CORE) {
    try {
      await checkResponse(await cache.match(url), file);
      files++;
    } catch (error) {
      failures.push(error.message);
    }
  }
  return {
    ready: files === CORE.size, scope: SCOPE.href, version: CONFIG.digest,
    files, total: CORE.size, ...(failures.length ? { problems: failures } : {}),
  };
}

async function downloadCore() {
  const cache = await caches.open(CACHE);
  // Validate all responses before touching a usable cache; network failures keep old files.
  const responses = [];
  for (const [url, file] of CORE) {
    const response = await fetch(new Request(url, { cache: "no-store", credentials: "same-origin" }));
    await checkResponse(response, file);
    responses.push([url, response]);
  }
  for (const [url, response] of responses) await cache.put(url, response);
  const result = await status();
  if (!result.ready) throw new Error(result.problems?.join(" ") || "Core cache verification failed.");
  return result;
}

function repair() {
  if (!repairTask) repairTask = downloadCore().finally(() => { repairTask = undefined; });
  return repairTask;
}

self.addEventListener("install", (event) => {
  event.waitUntil(repair());
  // Do not skipWaiting: an update must never take over a live game.
});

self.addEventListener("activate", (event) => {
  // Keep build-specific caches so old tabs are safe. Never delete another app's cache.
  event.waitUntil(status().then((result) => {
    if (!result.ready) throw new Error(result.problems?.join(" ") || "Incomplete offline cache.");
    return self.clients.claim();
  }));
});

self.addEventListener("message", (event) => {
  if (!event.ports || !event.ports[0]) return;
  if (!event.source || !event.source.url) return;
  const source = new URL(event.source.url);
  if (source.origin !== SCOPE.origin || !source.pathname.startsWith(SCOPE.pathname)) return;
  if (event.data?.type !== "STATUS" && event.data?.type !== "REPAIR") return;
  event.waitUntil((async () => {
    try {
      const result = event.data.type === "REPAIR" ? await repair() : await status();
      event.ports[0].postMessage(result);
    } catch (error) {
      event.ports[0].postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const relative = url.pathname.slice(SCOPE.pathname.length);
  if (request.mode === "navigate" && (relative === "" || relative === "resume/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const pageURL = relative === "resume/" ? RESUME : INDEX;
      // Keep this worker's page and hashed assets paired, including during server upgrades.
      const cached = await cache.match(pageURL);
      if (cached) return cached;
      try {
        const response = await fetch(new Request(pageURL, { credentials: "same-origin", cache: "no-store" }));
        await checkResponse(response, CORE.get(pageURL));
        await cache.put(pageURL, response.clone());
        return response;
      } catch {
        return new Response("Offline game files are missing. Reconnect and repair the offline download.", {
          status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
    return;
  }
  if (url.search || !CORE.has(url.href)) return;
  const file = CORE.get(url.href);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (relative === "themes.json") {
      try {
        const response = await fetch(new Request(request, { cache: "no-store" }));
        await checkResponse(response, file);
        await cache.put(url.href, response.clone());
        return response;
      } catch {
        const cached = await cache.match(url.href);
        if (cached) return cached;
        return new Response('{"error":"Theme menu unavailable. Reconnect and repair offline files."}', {
          status: 503, headers: { "Content-Type": "application/json" },
        });
      }
    }
    const cached = await cache.match(url.href);
    if (cached) return cached;
    const response = await fetch(request);
    await checkResponse(response, file);
    await cache.put(url.href, response.clone());
    return response;
  })());
});
