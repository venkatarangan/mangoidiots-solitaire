import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

const hash = data => createHash("sha256").update(data).digest("hex");

test("Mughal Gardens has the exact manifest, complete safe media, and verified integrity", async () => {
  const archive = await readFile("generated/mughal-pack.zip");
  assert.ok(archive.length < 10 * 1024 * 1024);
  const members = unzipSync(archive);
  const manifest = JSON.parse(new TextDecoder().decode(members["manifest.json"]));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "mughal");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.name, "Mughal Gardens");
  assert.match(manifest.author, /Generated with OpenAI GPT-6 Astra/);
  assert.match(manifest.attribution, /not authenticated portraits/i);
  assert.match(manifest.attribution, /not an authentic historical or devotional performance/i);
  assert.deepEqual(Object.keys(manifest.cards), Array.from({ length: 52 }, (_, i) => String(i)));
  assert.equal(manifest.files.length, 60);
  assert.equal(Object.keys(members).length, 61);
  const paths = new Set(manifest.files.map(file => file.path));
  assert.equal(paths.size, 60);
  assert.ok(Object.keys(members).every(path => path === "manifest.json" || paths.has(path)));
  assert.ok(Object.keys(members).every(path => !path.endsWith("/") && !path.split("/").some(part => !part || part === "." || part === "..")));
  for (const file of manifest.files) {
    assert.match(file.path, /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/);
    assert.equal(members[file.path].length, file.bytes);
    assert.equal(hash(members[file.path]), file.sha256);
    if (file.mime === "image/svg+xml") {
      const svg = new TextDecoder().decode(members[file.path]);
      assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      assert.doesNotMatch(svg, /<script|foreignObject|<!DOCTYPE|<!ENTITY|<style|<animate|<set[\s>]/i);
      assert.doesNotMatch(svg, /\son[a-z]+\s*=|\shref\s*=|\sxlink:href\s*=/i);
      for (const reference of svg.matchAll(/url\(([^)]*)\)/g)) assert.match(reference[1], /^#[\w-]+$/);
    }
  }
  for (let id = 0; id < 52; id++) {
    const svg = new TextDecoder().decode(members[manifest.cards[id]]);
    assert.match(svg, /width="240" height="336"/);
    const rank = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][id % 13];
    const suit = ["spades", "hearts", "clubs", "diamonds"][Math.floor(id / 13)];
    assert.ok(svg.includes(`<title>${rank} of ${suit}</title>`));
  }
  assert.ok(paths.has(manifest.back));
  assert.ok(paths.has(manifest.background));
  assert.match(manifest.palette.table, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.palette.accent, /^#[0-9a-f]{6}$/i);
  assert.equal(manifest.files.filter(file => file.mime === "image/svg+xml").length, 54);
  const courts = Array.from({ length: 52 }, (_, i) => i).filter(id => id % 13 >= 10);
  assert.equal(new Set(courts.map(id => hash(members[manifest.cards[id]]))).size, 12);
});

test("Mughal WAVs are rendered PCM16, distinct, restrained, and smoothly loopable", async () => {
  const members = unzipSync(await readFile("generated/mughal-pack.zip"));
  const manifest = JSON.parse(new TextDecoder().decode(members["manifest.json"]));
  const chola = unzipSync(await readFile("generated/chola-pack.zip"));
  const cholaManifest = JSON.parse(new TextDecoder().decode(chola["manifest.json"]));
  const roles = ["shuffle", "draw", "place", "invalid", "victory", "music"];
  assert.deepEqual(Object.keys(manifest.audio).sort(), [...roles].sort());
  const audioHashes = [];
  for (const role of roles) {
    const path = manifest.audio[role];
    const wav = Buffer.from(members[path]);
    assert.equal(manifest.files.find(file => file.path === path).mime, "audio/wav");
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    assert.equal(wav.readUInt32LE(4), wav.length - 8);
    assert.equal(wav.readUInt32LE(40), wav.length - 44);
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 22050);
    assert.equal(wav.readUInt32LE(28), 44100);
    assert.equal(wav.readUInt16LE(32), 2);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.notEqual(hash(wav), hash(chola[cholaManifest.audio[role]]), `${role} must differ from Chola`);
    audioHashes.push(hash(wav));
    let peak = 0, power = 0;
    for (let offset = 44; offset < wav.length; offset += 2) {
      const value = wav.readInt16LE(offset) / 32768;
      peak = Math.max(peak, Math.abs(value));
      power += value * value;
    }
    assert.ok(peak < .6 && peak > .1, `${role}: restrained non-silent peak`);
    assert.ok(power > 1, `${role}: substantive signal`);
    if (role === "music") {
      const seconds = (wav.length - 44) / 44100;
      assert.ok(seconds >= 25 && seconds <= 35);
      assert.ok(Math.abs(wav.readInt16LE(44) - wav.readInt16LE(wav.length - 2)) / 32768 < .03, "no large loop-edge discontinuity");
    } else {
      assert.equal(wav.readInt16LE(44), 0);
      assert.equal(wav.readInt16LE(wav.length - 2), 0);
    }
  }
  assert.equal(new Set(audioHashes).size, 6);
});
