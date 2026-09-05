import { unzipSync } from "fflate";

export interface ThemeManifest {
  schemaVersion: 1; id: string; version: string; name: string; description: string;
  author: string; attribution: string;
  files: { path: string; mime: string; bytes: number; sha256: string }[];
  cards: Record<string, string>; back: string; background: string;
  audio: Record<"shuffle" | "draw" | "place" | "invalid" | "victory" | "music", string>;
  palette: { table: string; accent: string };
}
export interface ThemeListing { id: string; version: string; name: string; url: string }
export interface LoadedTheme { manifest: ThemeManifest; urls: Map<string, string> }
const MAX_ZIP = 30 * 1024 * 1024, MAX_EXPANDED = 60 * 1024 * 1024;
const mediaTypes = new Set(["image/svg+xml", "image/png", "image/webp", "image/jpeg", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/ogg", "video/mp4", "text/plain"]);
function safePath(path: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(path) && !path.split("/").some((p) => p === ".." || p === "." || !p);
}
function validateSVG(bytes: Uint8Array): void {
  const text = new TextDecoder().decode(bytes);
  const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
  if (parsed.querySelector("parsererror") || parsed.documentElement.localName !== "svg" ||
      /<!DOCTYPE|<!ENTITY/i.test(text) || parsed.querySelector("script,foreignObject,iframe,object,embed,style,animate,set")) {
    throw new Error("Theme contains an invalid or active SVG image.");
  }
  for (const element of parsed.querySelectorAll("*")) {
    for (const attribute of element.attributes) {
      const references = [...attribute.value.matchAll(/url\(([^)]*)\)/gi)];
      const external = references.some((match) => !/^#[\w-]+$/.test(match[1].trim().replace(/^["']|["']$/g, "")));
      if (/^on/i.test(attribute.name) || ((attribute.localName === "href") && !/^#[\w-]+$/.test(attribute.value)) || external) {
        throw new Error("Theme SVG references active or external content.");
      }
    }
  }
}
function manifest(raw: unknown): ThemeManifest {
  if (!raw || typeof raw !== "object") throw new Error("Theme manifest is missing.");
  const m = raw as ThemeManifest;
  if (m.schemaVersion !== 1 || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(m.id) || !/^\d+\.\d+\.\d+$/.test(m.version) ||
      typeof m.name !== "string" || typeof m.attribution !== "string" || !Array.isArray(m.files) || m.files.length > 190 ||
      !m.cards || !m.audio || !m.palette) throw new Error("Theme manifest format is unsupported.");
  const paths = new Set<string>();
  let expanded = 0;
  for (const f of m.files) {
    if (!safePath(f.path) || paths.has(f.path) || !mediaTypes.has(f.mime) || !Number.isSafeInteger(f.bytes) || f.bytes < 0 ||
        !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error("Theme contains an invalid asset description.");
    paths.add(f.path); expanded += f.bytes;
  }
  if (expanded > MAX_EXPANDED) throw new Error("Expanded theme exceeds 60 MB.");
  for (let i = 0; i < 52; i++) if (!paths.has(m.cards[String(i)])) throw new Error(`Theme is missing card ${i}.`);
  for (const path of [m.back, m.background, ...["shuffle", "draw", "place", "invalid", "victory", "music"].map((key) => m.audio[key as keyof typeof m.audio])]) {
    if (!paths.has(path)) throw new Error("Theme is missing a required image or sound.");
  }
  if (!/^#[0-9a-f]{6}$/i.test(m.palette.table) || !/^#[0-9a-f]{6}$/i.test(m.palette.accent)) throw new Error("Theme palette is invalid.");
  return m;
}
export async function themeListings(base: URL): Promise<ThemeListing[]> {
  const response = await fetch(new URL("themes.json", base));
  if (!response.ok) throw new Error(`Theme list could not be loaded (HTTP ${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data.themes) || !data.themes.length) throw new Error("No theme packs are available.");
  for (const theme of data.themes) {
    if (typeof theme.id !== "string" || typeof theme.name !== "string" || typeof theme.version !== "string" || typeof theme.url !== "string") throw new Error("Theme listing is invalid.");
    const url = new URL(theme.url, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error("Theme packs must be hosted on this game's own route.");
  }
  return data.themes;
}
export async function loadTheme(base: URL, listing: ThemeListing, progress: (text: string, percent: number) => void): Promise<LoadedTheme> {
  const prefix = `mangoidiots-theme:${base.pathname}:${listing.id}:${listing.version}`;
  const metadataURL = new URL(`_theme/${listing.id}/${listing.version}/manifest.json`, base).href;
  const cache = await caches.open(prefix);
  const saved = await cache.match(metadataURL);
  let cachedManifest: ThemeManifest | undefined;
  let m: ThemeManifest;
  if (saved) {
    const candidate = manifest(await saved.json());
    const available = await Promise.all(candidate.files.map((f) => cache.match(new URL(`_theme/${candidate.id}/${candidate.version}/${f.path}`, base))));
    if (available.every(Boolean)) cachedManifest = candidate;
  }
  if (!cachedManifest) {
    progress(`Downloading ${listing.name}...`, 15);
    const response = await fetch(new URL(listing.url, base), { cache: "no-cache" });
    if (!response.ok) throw new Error(`Theme download failed (HTTP ${response.status}). Reconnect and retry.`);
    const advertised = Number(response.headers.get("Content-Length") || 0);
    if (advertised > MAX_ZIP) throw new Error("Theme archive exceeds 30 MB.");
    if (!response.body) throw new Error("Theme download body is unavailable.");
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let downloaded = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      downloaded += value.byteLength;
      if (downloaded > MAX_ZIP) { await reader.cancel(); throw new Error("Theme archive exceeds 30 MB."); }
      chunks.push(value);
      progress(`Downloading ${listing.name} (${(downloaded / 1048576).toFixed(1)} MB)...`, Math.min(45, 15 + (advertised ? downloaded / advertised * 30 : downloaded / MAX_ZIP * 30)));
    }
    const archive = new Uint8Array(downloaded);
    let offset = 0; for (const chunk of chunks) { archive.set(chunk, offset); offset += chunk.length; }
    let count = 0, expanded = 0;
    const archiveNames = new Set<string>();
    const files = unzipSync(archive, { filter: (file) => {
      count++; expanded += file.originalSize;
      if (count > 200 || expanded > MAX_EXPANDED || !safePath(file.name) || archiveNames.has(file.name)) throw new Error("Theme archive contains duplicate/unsafe paths or exceeds extraction limits.");
      archiveNames.add(file.name);
      return true;
    } });
    if (!files["manifest.json"] || files["manifest.json"].length > 256 * 1024) throw new Error("Theme manifest is missing or too large.");
    m = manifest(JSON.parse(new TextDecoder().decode(files["manifest.json"])));
    if (m.id !== listing.id || m.version !== listing.version) throw new Error("Downloaded theme identity does not match the selected pack.");
    if (Object.keys(files).length !== m.files.length + 1) throw new Error("Theme archive contains unlisted files.");
    for (let i = 0; i < m.files.length; i++) {
      const f = m.files[i], data = files[f.path];
      if (!data || data.byteLength !== f.bytes) throw new Error(`Theme asset has an incorrect size: ${f.path}`);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(data).buffer))).map((v) => v.toString(16).padStart(2, "0")).join("");
      if (hash !== f.sha256) throw new Error(`Theme asset checksum failed: ${f.path}`);
      if (f.mime === "image/svg+xml") validateSVG(data);
      progress("Checking artwork and music...", 45 + (i / m.files.length) * 25);
    }
    // The metadata marker is written last. An interrupted install is never selected as complete.
    for (const f of m.files) {
      await cache.put(new URL(`_theme/${m.id}/${m.version}/${f.path}`, base), new Response(new Uint8Array(files[f.path]).buffer, { headers: { "Content-Type": f.mime } }));
    }
    await cache.put(metadataURL, new Response(JSON.stringify(m), { headers: { "Content-Type": "application/json" } }));
  } else {
    m = cachedManifest;
  }
  const urls = new Map<string, string>();
  for (const f of m.files) {
    const response = await cache.match(new URL(`_theme/${m.id}/${m.version}/${f.path}`, base));
    if (!response) throw new Error("An installed theme asset has disappeared. Reconnect and retry the download.");
    urls.set(f.path, URL.createObjectURL(await response.blob()));
  }
  progress("Opening your royal court...", 85);
  return { manifest: m, urls };
}
export function disposeTheme(theme: LoadedTheme): void { for (const url of theme.urls.values()) URL.revokeObjectURL(url); }

export class Sound {
  private music: HTMLAudioElement;
  private active = new Set<HTMLAudioElement>();
  private muted = false;
  private musicVolume = .18;
  private effectVolume = .65;
  private playing = false;
  constructor(private theme: LoadedTheme, private onError: (message: string) => void) {
    this.music = new Audio(this.url("music"));
    this.music.loop = true;
    this.music.preload = "auto";
  }
  private url(role: keyof ThemeManifest["audio"]): string {
    const url = this.theme.urls.get(this.theme.manifest.audio[role]);
    if (!url) throw new Error(`Sound asset is missing: ${role}`);
    return url;
  }
  settings(music: number, effects: number, muted: boolean): void {
    this.musicVolume = music; this.effectVolume = effects; this.muted = muted;
    this.music.volume = music; this.music.muted = muted;
    for (const audio of this.active) { audio.volume = effects; audio.muted = muted; }
    if (muted || music === 0) this.music.pause();
    else if (this.playing) this.start();
  }
  private play(audio: HTMLAudioElement): void {
    void audio.play().catch((error: DOMException) => {
      this.active.delete(audio);
      if (error.name !== "AbortError") this.onError(error.name === "NotAllowedError"
        ? "Your browser paused audio. Press Resume or a sound control to enable it."
        : `Audio could not play: ${error.message}`);
    });
  }
  start(): void {
    this.playing = true;
    if (!this.muted && this.musicVolume > 0 && this.music.paused) this.play(this.music);
  }
  pause(): void {
    this.playing = false; this.music.pause();
    for (const audio of this.active) audio.pause();
    this.active.clear();
  }
  effect(role: Exclude<keyof ThemeManifest["audio"], "music">): void {
    if (this.muted || this.effectVolume === 0) return;
    if (this.active.size >= 6) return;
    const audio = new Audio(this.url(role));
    audio.volume = this.effectVolume; this.active.add(audio);
    audio.onended = () => this.active.delete(audio);
    audio.onerror = () => { this.active.delete(audio); this.onError("A sound could not be decoded by this browser."); };
    this.play(audio);
  }
  dispose(): void { this.pause(); this.music.src = ""; }
}
