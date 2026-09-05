import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const basePath = process.env.PAGES_BASE || "/mangoidiots-solitaire/";
const port = Number(process.env.PORT || 4173);
const types = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webmanifest": "application/manifest+json",
  ".zip": "application/zip",
};

if (!basePath.startsWith("/") || !basePath.endsWith("/") || basePath.includes("..")) {
  throw new Error("PAGES_BASE must be an absolute URL path ending in a slash.");
}

function reply(response, status, body, headers = {}) {
  response.writeHead(status, { "Cache-Control": "no-store", ...headers });
  response.end(body);
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (!["GET", "HEAD"].includes(request.method || "")) {
    reply(response, 405, "Method not allowed.", { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    return;
  }
  if (url.pathname === "/__test__/blank") {
    reply(response, 200, request.method === "HEAD" ? "" : "<!doctype html><title>Test fixture</title>", { "Content-Type": "text/html; charset=utf-8" });
    return;
  }
  if (url.pathname === basePath.slice(0, -1)) {
    response.writeHead(308, { Location: basePath, "Cache-Control": "no-store" });
    response.end();
    return;
  }
  if (!url.pathname.startsWith(basePath)) {
    reply(response, 404, "Not found.", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }
  let relative;
  try {
    relative = decodeURIComponent(url.pathname.slice(basePath.length));
  } catch {
    reply(response, 400, "Invalid path.", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }
  if (!relative || relative.endsWith("/")) relative += "index.html";
  const file = path.resolve(root, ...relative.split("/"));
  if (path.relative(root, file).startsWith("..")) {
    reply(response, 404, "Not found.", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Not a regular file.");
    const contentType = types[path.extname(file).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType, "Content-Length": stat.size });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    reply(response, 404, "Not found.", { "Content-Type": "text/plain; charset=utf-8" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`GitHub Pages preview: http://127.0.0.1:${port}${basePath}`);
});
