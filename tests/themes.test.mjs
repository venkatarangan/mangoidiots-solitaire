import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { cardSvg as cholaCardSvg, CARD_FACE_METRICS } from "../tools/assets/art.mjs";
import { cardSvg as mughalCardSvg } from "../tools/assets/mughal/art.mjs";

test("the original theme has all 52 cards, required sounds, and verified asset hashes", async () => {
  const bytes = await readFile("generated/chola-pack.zip");
  assert.ok(bytes.length < 30 * 1024 * 1024);
  const files = unzipSync(bytes);
  const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "chola");
  assert.equal(manifest.version, "1.1.0");
  assert.equal(Object.keys(manifest.cards).length, 52);
  assert.equal(Object.keys(manifest.compactCards).length, 52);
  assert.equal(manifest.files.length, 112);
  assert.equal(Object.keys(files).length, 113);
  assert.ok(Object.keys(files).length <= 200);
  assert.equal(Object.keys(files).length, manifest.files.length + 1);
  for (const file of manifest.files) {
    assert.ok(files[file.path], file.path);
    assert.equal(files[file.path].byteLength, file.bytes, file.path);
    assert.equal(createHash("sha256").update(files[file.path]).digest("hex"), file.sha256, file.path);
    assert.deepEqual(await readFile(`themes/chola/${file.path}`), Buffer.from(files[file.path]), file.path);
    if (file.mime === "image/svg+xml") {
      const svg = new TextDecoder().decode(files[file.path]);
      assert.match(svg, /<svg/);
      assert.doesNotMatch(svg, /<script|foreignObject|<!DOCTYPE|<!ENTITY|<style|<animate|<set[\s>]/i);
      assert.doesNotMatch(svg, /\son[a-z]+\s*=/i);
    }
  }
  for (let card = 0; card < 52; card++) assert.ok(files[manifest.cards[String(card)]]);
  const originalAudioHashes = {
    shuffle: "2afa35436a8b7c9b07ac67008f3eb3bcbc6b2dc0bf15cab3136ef29a0d0350ea",
    draw: "f37b277e0a0cba6ff1471ab0bc0bbada813dec40569c88d0c35d15649758e4fc",
    place: "2d4d19063f4299ad69be345c95d265961d6aae05defb0d8f3adaeb1428e1d6e0",
    invalid: "ac7adece620f1b55aa096412c41af3aecb39a9de3ab4d77faff06c7491700f0e",
    victory: "cb2711825e4a98e8d2adf172f3ff30efb9f2101ac73bde07cc6f3a51276ac517",
    music: "c1725fe4cf022970857e836a596c487e85e616e2d335bb147b2c10ce4a401d49",
  };
  for (const role of ["shuffle", "draw", "place", "invalid", "victory", "music"]) {
    const audio = Buffer.from(files[manifest.audio[role]]);
    assert.equal(createHash("sha256").update(audio).digest("hex"), originalAudioHashes[role], `${role}: original audio remains byte-identical`);
    assert.equal(audio.subarray(0, 4).toString(), "RIFF");
    assert.equal(audio.subarray(8, 12).toString(), "WAVE");
    assert.ok(audio.length > 500, role);
    if (role === "music") assert.ok(audio.length > 22050 * 2 * 15, "music should be a substantive rendered loop");
  }
});

const suitPaths = [
  "M0-17C-6-9-17-4-17 5C-17 15-5 18 0 9C5 18 17 15 17 5C17-4 6-9 0-17ZM-3 8L-7 21H7L3 8Z",
  "M0 18C-5 12-18 3-18-6C-18-18-4-20 0-10C4-20 18-18 18-6C18 3 5 12 0 18Z",
  "M0-19C-13-19-13-4-5-1C-19-9-24 11-12 14C-7 16-2 12 0 8C2 12 7 16 12 14C24 11 19-9 5-1C13-4 13-19 0-19ZM-3 6L-7 21H7L3 6Z",
  "M0-21L16 0L0 21L-16 0Z",
];

for (const [theme, renderCard, inks] of [
  ["chola", cholaCardSvg, ["#182d34", "#b3233d"]],
  ["mughal", mughalCardSvg, ["#172d51", "#ae2847"]],
]) {
  test(`${theme}: all 104 faces preserve identity, familiar pips, artwork, and readable indices`, async () => {
    const files = unzipSync(await readFile(`generated/${theme}-pack.zip`));
    const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
    const ids = Array.from({ length: 52 }, (_, id) => String(id));
    assert.deepEqual(Object.keys(manifest.cards), ids);
    assert.deepEqual(Object.keys(manifest.compactCards), ids);
    assert.equal(new Set([...Object.values(manifest.cards), ...Object.values(manifest.compactCards)]).size, 104);
    assert.equal(manifest.files.filter(file => file.mime === "image/svg+xml").length, 106);
    assert.deepEqual(CARD_FACE_METRICS, {
      standard: { rankFontSize: 48, exposedIndexHeight: 92 },
      compact: { rankFontSize: 86, exposedIndexHeight: 86 },
    });
    for (let id = 0; id < 52; id++) {
      const rank = id % 13 + 1;
      const suit = Math.floor(id / 13);
      const label = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][rank - 1];
      const name = `${label} of ${["spades", "hearts", "clubs", "diamonds"][suit]}`;
      let standardArt;
      for (const compact of [false, true]) {
        const assetPath = (compact ? manifest.compactCards : manifest.cards)[id];
        assert.equal(assetPath, `cards/${compact ? "compact-" : ""}${id}.svg`);
        const svg = new TextDecoder().decode(files[assetPath]);
        assert.equal(svg, renderCard(id, compact), `generated ${theme}/${assetPath} is current`);
        assert.match(svg, /width="240" height="336" viewBox="0 0 240 336"/);
        assert.ok(svg.includes(`<title>${name}</title>`), assetPath);
        assert.ok(svg.includes(`aria-label="${name};`), assetPath);
        const text = svg.match(/<text id="index-rank"([^>]*)>([^<]+)<\/text>/);
        assert.ok(text, assetPath);
        assert.equal(text[2], label, assetPath);
        assert.ok(text[1].includes(`fill="${inks[suit % 2]}"`), assetPath);
        assert.match(text[1], /font-family="Arial,Helvetica,sans-serif" font-weight="700"/);
        assert.ok(text[1].includes(`font-size="${compact ? 86 : 48}"`), assetPath);
        const symbol = svg.match(/<g id="index-suit"><g transform="([^"]+)"><path d="([^"]+)" fill="([^"]+)"/);
        assert.ok(symbol, assetPath);
        assert.equal(symbol[2], suitPaths[suit], `${assetPath}: correct visual suit, not just its label`);
        assert.equal(symbol[3], inks[suit % 2], assetPath);
        const art = svg.match(/<g id="card-art"([^>]*)>([\s\S]*?)<\/g>\s*<g id="primary-index">/);
        assert.ok(art, assetPath);
        if (rank <= 10) assert.equal(art[2].split(`d="${suitPaths[suit]}"`).length - 1, rank, `${assetPath}: familiar pip count`);
        if (!compact) {
          standardArt = art[2];
          assert.match(svg, /id="secondary-index" transform="rotate\(180 120 168\)"/);
          assert.match(text[1], /x="34" y="52" text-anchor="middle"/);
          assert.equal(symbol[1], `translate(34 75) rotate(0) scale(${32 / 42})`);
          assert.ok(75 + 32 / 2 < CARD_FACE_METRICS.standard.exposedIndexHeight);
          assert.doesNotMatch(svg, /d="M12 85H228"/, "horizontal strip is compact-only");
        } else {
          assert.equal(art[2], standardArt, `${assetPath}: retain the original court/ace/pip artwork`);
          assert.equal(art[1], ' transform="translate(0 54) scale(1 .86)"');
          assert.doesNotMatch(svg, /id="secondary-index"/);
          assert.match(text[1], /x="14" y="77"/);
          assert.equal(symbol[1], `translate(181 44) rotate(0) scale(${64 / 42})`);
          assert.match(svg, /d="M12 85H228"/);
          assert.ok(86 * 40 / 240 >= 14, "nominal rank is at least 14 CSS px at the smallest width");
          assert.ok(CARD_FACE_METRICS.compact.exposedIndexHeight / 240 <= .36, "indices fit the landscape overlap step");
          assert.ok(44 - 64 / 2 >= 6 && 44 + 64 / 2 < 86, "suit stays inside the compact strip");
          assert.ok(54 + 42 * .86 >= 90, "court artwork begins near y=90, below the exposed strip");
          assert.ok(54 + 307 * .86 < 324, "court artwork keeps a bottom margin");
          assert.ok(181 - 32 - (14 + 98) >= 24, "even ten has a generous rank/suit gap");
          assert.ok(181 + 32 <= 228, "suit keeps a right margin");
        }
        if (rank === 10) assert.ok(text[1].includes(`textLength="${compact ? 98 : 52}" lengthAdjust="spacingAndGlyphs"`));
      }
    }
  });
}
