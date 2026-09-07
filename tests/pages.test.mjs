import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function files(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(path.join(directory, entry.name), `${relative}/`));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}

test("Pages output is complete and contains no server-side deployment files", async () => {
  const inventory = await files("dist");
  for (const required of [
    ".nojekyll",
    "CNAME",
    "index.html",
    "manifest.webmanifest",
    "resume/index.html",
    "social-preview.png",
    "sw.js",
    "themes.json",
    "themes/chola-1.1.0.zip",
    "themes/mughal-1.1.0.zip",
  ]) {
    assert.ok(inventory.includes(required), `missing ${required}`);
  }
  assert.ok(inventory.some((file) => /^assets\/index-[\w-]+\.js$/.test(file)));
  assert.ok(inventory.some((file) => /^assets\/index-[\w-]+\.css$/.test(file)));
  assert.deepEqual(inventory.filter((file) => file.endsWith(".zip")), [
    "themes/chola-1.1.0.zip",
    "themes/mughal-1.1.0.zip",
  ]);
});

test("published assets exclude private paths, source maps and image metadata", async () => {
  const inventory = await files("dist");
  assert.equal(inventory.filter((file) => /\.(?:map|log|env|sqlite|db|pem|key)$/.test(file)).length, 0);
  for (const file of inventory) {
    const bytes = await readFile(path.join("dist", file));
    if (/\.(?:js|css|html|json|webmanifest)$/.test(file)) {
      assert.doesNotMatch(bytes.toString("utf8"), /[A-Z]:[\\/](?:Users|DevTemp)[\\/]|\/(?:Users|home)\/|session-state/i, file);
    }
    if (!file.endsWith(".png")) continue;
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", file);
    for (let offset = 8; offset < bytes.length;) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString("ascii", offset + 4, offset + 8);
      assert.ok(offset + length + 12 <= bytes.length, `${file}: invalid PNG chunk`);
      assert.ok(!["eXIf", "tEXt", "iTXt", "zTXt"].includes(type), `${file}: embedded ${type} metadata`);
      offset += length + 12;
    }
  }
});

test("Pages HTML supports nested and custom-domain base paths", async () => {
  const index = await readFile("dist/index.html", "utf8");
  const resume = await readFile("dist/resume/index.html", "utf8");
  for (const html of [index, resume]) {
    assert.match(html, /solitaire-build-[a-f0-9]{24}/);
    assert.match(html, /<link rel="canonical" href="https:\/\/solitaire\.mangoidiots\.com\/">/);
    assert.match(html, /<meta property="og:url" content="https:\/\/solitaire\.mangoidiots\.com\/">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/solitaire\.mangoidiots\.com\/social-preview\.png">/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.doesNotMatch(html, /venkatarangan\.github\.io/);
    assert.doesNotMatch(html, /__SOLITAIRE_BASE__/);
  }
  assert.match(index, /<base href="\.\/">/);
  assert.match(resume, /<base href="\.\.\/">/);
});

test("manifest, theme catalog and worker are static-host compatible", async () => {
  assert.equal((await readFile("dist/CNAME", "utf8")).trim(), "solitaire.mangoidiots.com");
  const preview = await readFile("dist/social-preview.png");
  assert.equal(preview.subarray(1, 4).toString(), "PNG");
  assert.ok(preview.length > 50_000);
  assert.equal(preview.readUInt32BE(16), 1200);
  assert.equal(preview.readUInt32BE(20), 630);
  const manifest = JSON.parse(await readFile("dist/manifest.webmanifest", "utf8"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.name, "Mangoidiots Solitaire");
  const themes = JSON.parse(await readFile("dist/themes.json", "utf8"));
  assert.equal(themes.defaultTheme, "chola");
  assert.deepEqual(themes.themes.map((theme) => theme.id), ["chola", "mughal"]);
  const worker = await readFile("dist/sw.js", "utf8");
  assert.doesNotMatch(worker, /__SOLITAIRE_SW_CONFIG__/);
  assert.match(worker, /mangoidiots-solitaire-core/);
});
