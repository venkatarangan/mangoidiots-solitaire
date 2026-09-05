import { build } from "vite";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = fileURLToPath(new URL("..", import.meta.url));
const VERSION = "1.2.0";
const BUNDLED_THEMES = [
  { id: "chola", version: "1.0.0", name: "Chola Royal Court" },
  { id: "mughal", version: "1.0.0", name: "Mughal Gardens" },
];
const web = path.join(root, "build", "web");
const stage = path.join(root, "build", "pages");
const output = path.join(root, "dist");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webmanifest": "application/manifest+json",
};

async function guardGeneratedDirectory(directory) {
  if (![web, stage, output].some((known) => path.resolve(known) === path.resolve(directory))) {
    throw new Error("Refusing to replace an unknown directory.");
  }
  const relative = path.relative(root, directory);
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error(`Refusing to replace a link or non-directory: ${current}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function collect(directory, prefix = "") {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    const relative = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Refusing generated symlink: ${file}`);
    if (entry.isDirectory()) files.push(...await collect(file, `${relative}/`));
    else if (entry.isFile()) files.push({ path: relative, bytes: await readFile(file) });
    else throw new Error(`Unsupported generated file: ${file}`);
  }
  return files;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const type = Buffer.from(name);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  type.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8);
  return result;
}

function icon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      let color = [16, 62, 56, 255];
      const cx = Math.max(.25, Math.min(.75, nx));
      const cy = Math.max(.18, Math.min(.82, ny));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < .055 ** 2) color = [247, 236, 211, 255];
      if (Math.abs(nx - .5) / .16 + Math.abs(ny - .51) / .22 < 1) color = [168, 98, 37, 255];
      if (ny > .215 && ny < .25 && nx > .295 && nx < .705) color = [188, 145, 66, 255];
      if (ny > .75 && ny < .785 && nx > .295 && nx < .705) color = [188, 145, 66, 255];
      pixels.set(color, row + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "binary"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (metadata.version !== VERSION) throw new Error(`Package and site version must both be ${VERSION}.`);

const bundledThemes = [];
for (const expected of BUNDLED_THEMES) {
  const sourcePath = path.join(root, "generated", `${expected.id}-pack.zip`);
  let bytes;
  try {
    bytes = await readFile(sourcePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Missing generated/${expected.id}-pack.zip. Run npm run assets before building.`);
    }
    throw error;
  }
  if (bytes.length > 30 * 1024 * 1024) throw new Error(`${expected.id}: theme exceeds the 30 MB ZIP limit.`);
  const themeFiles = unzipSync(bytes);
  const manifest = JSON.parse(new TextDecoder().decode(themeFiles["manifest.json"]));
  if (manifest.schemaVersion !== 1 || manifest.id !== expected.id || manifest.version !== expected.version
      || manifest.name !== expected.name || !Array.isArray(manifest.files)
      || manifest.files.length + 1 !== Object.keys(themeFiles).length || Object.keys(themeFiles).length > 200) {
    throw new Error(`${expected.id}: theme identity or file inventory is invalid.`);
  }
  if (Object.values(themeFiles).reduce((size, file) => size + file.length, 0) > 60 * 1024 * 1024) {
    throw new Error(`${expected.id}: expanded theme exceeds 60 MB.`);
  }
  const seen = new Set();
  for (const file of manifest.files) {
    if (seen.has(file.path) || !themeFiles[file.path] || file.bytes !== themeFiles[file.path].length
        || hash(themeFiles[file.path]) !== file.sha256) {
      throw new Error(`${expected.id}: theme integrity failed: ${file.path}`);
    }
    seen.add(file.path);
  }
  bundledThemes.push({ ...expected, sourcePath, url: `themes/${manifest.id}-${manifest.version}.zip` });
}

for (const directory of [web, stage, output]) {
  await guardGeneratedDirectory(directory);
  await rm(directory, { recursive: true, force: true });
}

await build({
  root,
  configFile: path.join(root, "vite.config.js"),
  build: { outDir: web, emptyOutDir: false },
});
await mkdir(stage, { recursive: true });
for (const file of await collect(web)) {
  const destination = path.join(stage, ...file.path.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, file.bytes);
}

let html = await readFile(path.join(stage, "index.html"), "utf8");
if (!html.includes('<base href="__SOLITAIRE_BASE__">')) {
  throw new Error("index.html must contain the __SOLITAIRE_BASE__ hosting placeholder.");
}
html = html.replace('<base href="__SOLITAIRE_BASE__">', '<base href="./">');

await writeFile(path.join(stage, "manifest.webmanifest"), JSON.stringify({
  id: "./",
  name: "Mangoidiots Solitaire",
  short_name: "Solitaire",
  description: "Free offline-first Draw 1 Klondike with original Chola and Mughal themes.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#103e38",
  theme_color: "#103e38",
  icons: [192, 512].map((size) => ({
    src: `icon-${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose: "any",
  })),
}, null, 2) + "\n");
for (const size of [192, 512]) await writeFile(path.join(stage, `icon-${size}.png`), icon(size));
await writeFile(path.join(stage, "themes.json"), JSON.stringify({
  themes: bundledThemes.map(({ id, version, name, url }) => ({ id, version, name, url })),
  defaultTheme: "chola",
}, null, 2) + "\n");
await mkdir(path.join(stage, "themes"), { recursive: true });
for (const theme of bundledThemes) {
  await copyFile(theme.sourcePath, path.join(stage, ...theme.url.split("/")));
}

const workerTemplate = await readFile(path.join(root, "tools", "offline-worker.js"), "utf8");
const digest = hash(Buffer.concat([
  Buffer.from(VERSION),
  Buffer.from(workerTemplate),
  Buffer.from(html),
  ...((await collect(stage))
    .filter((file) => file.path !== "index.html")
    .flatMap((file) => [Buffer.from(file.path), file.bytes])),
])).slice(0, 24);
html = html.replace("</head>", `  <meta name="solitaire-build" content="solitaire-build-${digest}">\n</head>`);
await writeFile(path.join(stage, "index.html"), html);
await mkdir(path.join(stage, "resume"), { recursive: true });
await writeFile(path.join(stage, "resume", "index.html"), html.replace('<base href="./">', '<base href="../">'));
await writeFile(path.join(stage, ".nojekyll"), "");

const core = (await collect(stage))
  .filter((file) => !file.path.endsWith(".zip") && file.path !== ".nojekyll" && file.path !== "CNAME")
  .map((file) => {
    const contentType = types[path.extname(file.path)];
    if (!contentType) throw new Error(`No explicit MIME for static asset: ${file.path}`);
    return {
      path: file.path === "index.html" ? "" : file.path,
      contentType,
      ...(contentType === "text/html" ? {} : { sha256: hash(file.bytes) }),
    };
  });
const worker = workerTemplate.replace("__SOLITAIRE_SW_CONFIG__", JSON.stringify({
  version: VERSION,
  digest,
  files: core,
}));
await writeFile(path.join(stage, "sw.js"), worker);
await rename(stage, output);

const published = await collect(output);
if (published.some((file) => file.path.includes("__SOLITAIRE_BASE__") || file.bytes.includes(Buffer.from("__SOLITAIRE_SW_CONFIG__")))) {
  throw new Error("The Pages output contains an unresolved build token.");
}
console.log(`Mangoidiots Solitaire ${VERSION}: ${published.length} static files; ${core.length} offline core files; ${bundledThemes.length} themes; build ${digest}.`);
