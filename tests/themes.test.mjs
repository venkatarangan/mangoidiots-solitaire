import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

test("the original theme has all 52 cards, required sounds, and verified asset hashes", async () => {
  const bytes = await readFile("generated/chola-pack.zip");
  assert.ok(bytes.length < 30 * 1024 * 1024);
  const files = unzipSync(bytes);
  const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "chola");
  assert.equal(Object.keys(manifest.cards).length, 52);
  assert.equal(Object.keys(files).length, manifest.files.length + 1);
  for (const file of manifest.files) {
    assert.ok(files[file.path], file.path);
    assert.equal(files[file.path].byteLength, file.bytes, file.path);
    assert.equal(createHash("sha256").update(files[file.path]).digest("hex"), file.sha256, file.path);
    if (file.mime === "image/svg+xml") {
      const svg = new TextDecoder().decode(files[file.path]);
      assert.match(svg, /<svg/);
      assert.doesNotMatch(svg, /<script|foreignObject|<!DOCTYPE|<!ENTITY|<style|<animate|<set[\s>]/i);
      assert.doesNotMatch(svg, /\son[a-z]+\s*=/i);
    }
  }
  for (let card = 0; card < 52; card++) assert.ok(files[manifest.cards[String(card)]]);
  for (const role of ["shuffle", "draw", "place", "invalid", "victory", "music"]) {
    const audio = Buffer.from(files[manifest.audio[role]]);
    assert.equal(audio.subarray(0, 4).toString(), "RIFF");
    assert.equal(audio.subarray(8, 12).toString(), "WAVE");
    assert.ok(audio.length > 500, role);
    if (role === "music") assert.ok(audio.length > 22050 * 2 * 15, "music should be a substantive rendered loop");
  }
});
