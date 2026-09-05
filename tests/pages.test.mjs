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
    "index.html",
    "manifest.webmanifest",
    "resume/index.html",
    "sw.js",
    "themes.json",
    "themes/chola-1.0.0.zip",
    "themes/mughal-1.0.0.zip",
  ]) {
    assert.ok(inventory.includes(required), `missing ${required}`);
  }
  assert.ok(inventory.some((file) => /^assets\/index-[\w-]+\.js$/.test(file)));
  assert.ok(inventory.some((file) => /^assets\/index-[\w-]+\.css$/.test(file)));
  assert.deepEqual(inventory.filter((file) => file.endsWith(".zip")), [
    "themes/chola-1.0.0.zip",
    "themes/mughal-1.0.0.zip",
  ]);
});

test("Pages HTML supports project and custom-domain base paths", async () => {
  const index = await readFile("dist/index.html", "utf8");
  const resume = await readFile("dist/resume/index.html", "utf8");
  for (const html of [index, resume]) {
    assert.match(html, /solitaire-build-[a-f0-9]{24}/);
    assert.match(html, /https:\/\/venkatarangan\.github\.io\/mangoidiots-solitaire\//);
    assert.doesNotMatch(html, /__SOLITAIRE_BASE__/);
  }
  assert.match(index, /<base href="\.\/">/);
  assert.match(resume, /<base href="\.\.\/">/);
});

test("manifest, theme catalog and worker are static-host compatible", async () => {
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
