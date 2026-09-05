import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { cardSvg, backSvg, backgroundSvg, COURT_LABELS } from "./art.mjs";
import { ambientMusic, soundEffects, SAMPLE_RATE } from "./audio.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const themeRoot = join(root, "themes", "mughal");
const output = join(root, "generated");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const assets = {};
const files = [];
async function add(path, mime, data) {
  const bytes = typeof data === "string" ? strToU8(data) : new Uint8Array(data);
  const disk = join(themeRoot, ...path.split("/"));
  await mkdir(dirname(disk), { recursive: true });
  await writeFile(disk, bytes);
  assets[path] = bytes;
  files.push({ path, mime, bytes: bytes.length, sha256: hash(bytes) });
}
await mkdir(output, { recursive: true });
const cards = {};
for (let id = 0; id < 52; id++) {
  cards[String(id)] = `cards/${id}.svg`;
  await add(cards[id], "image/svg+xml", cardSvg(id));
}
await add("table/card-back.svg", "image/svg+xml", backSvg());
await add("table/garden.svg", "image/svg+xml", backgroundSvg());
const audio = {};
for (const [role, wav] of Object.entries({ ...soundEffects(), music: ambientMusic() })) {
  audio[role] = `audio/${role}.wav`;
  await add(audio[role], "audio/wav", wav);
}

const attribution = "Generated with OpenAI GPT-6 Astra. Original procedural vector artwork and original locally synthesized instrumental audio for Mangoidiots Solitaire (https://venkatarangan.github.io/mangoidiots-solitaire/). Respectful creative inspiration from Mughal-period Indian miniature painting, court costume, floral inlay, scalloped arches, and charbagh gardens; not authenticated portraits, named historical figures, or a reconstruction. The newly composed instrumental music draws on broad Sufi, Indo-Persian and Islamicate cultural influences through oud-like plucks, ney/reed-like lead, and frame-drum-inspired synthesis. It is not an authentic historical or devotional performance. No Quran recitation, adhan, religious vocals, sacred text, downloaded recordings, sampled instruments, external artwork, or copied commercial cards are used.";
const manifest = {
  schemaVersion: 1,
  id: "mughal",
  version: "1.0.0",
  name: "Mughal Gardens",
  description: "Original miniature-inspired garden courts, ivory and floral-inlay cards, lapis and turquoise geometry, and a gentle original oud- and reed-inspired instrumental soundscape.",
  author: "Mangoidiots Solitaire · Generated with OpenAI GPT-6 Astra",
  files,
  cards,
  back: "table/card-back.svg",
  background: "table/garden.svg",
  audio,
  palette: { table: "#173b53", accent: "#e4c783" },
  attribution,
};
const manifestBytes = strToU8(JSON.stringify(manifest, null, 2) + "\n");
await writeFile(join(themeRoot, "manifest.json"), manifestBytes);
const entries = {};
for (const [path, bytes] of Object.entries({ "manifest.json": manifestBytes, ...assets })) {
  entries[path] = [bytes, { mtime: new Date(2026, 0, 1, 0, 0, 0), level: 9 }];
}
const zip = zipSync(entries, { level: 9 });
if (zip.byteLength >= 10 * 1024 * 1024) throw new Error("Mughal theme exceeds the 10 MiB target");
await writeFile(join(output, "mughal-pack.zip"), zip);

const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const suits = ["Spades","Hearts","Clubs","Diamonds"];
const cardName = id => `${ranks[id % 13]} of ${suits[Math.floor(id / 13)]}`;
const figure = (id, detail = false) => `<figure><img src="../themes/mughal/${cards[id]}" alt="${cardName(id)}" width="240" height="336"><figcaption>${cardName(id)}${detail ? ` · ${COURT_LABELS[Math.floor(id/13)][id%13-10].toLowerCase()}` : ""}</figcaption></figure>`;
const preview = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mughal Gardens — Mangoidiots Solitaire</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#102637;color:#f3eedf;font:16px/1.6 system-ui,sans-serif}header,main,footer{max-width:1280px;margin:auto;padding:30px}header{padding-bottom:0}.eyebrow{color:#dbc389;text-transform:uppercase;letter-spacing:.2em;font-size:12px}h1{font:clamp(34px,5vw,56px)/1.15 Georgia,serif;margin:16px 0}h2{font:30px Georgia,serif;color:#e5cc94;margin:36px 0 16px}p{max-width:950px;color:#d5e2df}.note{border-left:3px solid #85bcb5;padding:8px 18px}.board{background:#173b53 url('../themes/mughal/table/garden.svg') center/cover;border:1px solid #bba567;padding:22px;border-radius:10px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:20px}figure{margin:0;min-width:0;text-align:center}figure img{width:100%;height:auto;display:block;filter:drop-shadow(0 6px 7px #07192399)}figcaption{font-size:12px;color:#e2d4b5;margin-top:10px}.court{max-width:980px;margin:auto;grid-template-columns:repeat(4,minmax(100px,1fr))}.swatches{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}.swatches span{border:1px solid #ebd5a266;border-radius:6px;padding:8px 15px}.sounds{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px}label{display:grid;gap:8px;text-transform:capitalize;color:#ead399}audio{width:100%}.small{display:flex;flex-wrap:wrap;gap:9px}.small img{width:58px;height:auto}a{color:#e8cf92}footer{font-size:13px;padding-top:0}code{font-size:14px}
@media(max-width:600px){header,main,footer{padding:20px}.board{padding:14px}.cards{gap:12px}.court{grid-template-columns:repeat(2,minmax(100px,1fr))}}
</style></head><body>
<header><div class="eyebrow">Mangoidiots Solitaire · Original second theme</div><h1>Mughal Gardens</h1>
<p>A miniature-inspired garden world in lapis, turquoise, emerald and ivory. Floral inlay, scalloped niches, flowing court robes and quiet water channels create a distinct companion to Chola Royal Court.</p>
<p class="note">Respectful creative inspiration—not authenticated portraits or historical reconstruction. Original instrumental synthesis—not a historical or devotional performance. No sacred text or religious vocals.</p></header>
<main><section class="board cards">${figure(0)}${figure(22)}${figure(12,true)}${figure(24,true)}${figure(10,true)}
<figure><img src="../themes/mughal/table/card-back.svg" alt="Lapis and ivory floral-inlay card back" width="240" height="336"><figcaption>Floral-inlay garden back</figcaption></figure></section>
<div class="swatches"><span style="background:#25477a">Lapis</span><span style="background:#218b8e">Turquoise</span><span style="background:#287858">Emerald</span><span style="background:#965567">Rose</span><span style="background:#e4c783;color:#40352a">Antique gold</span><span style="background:#f9f4e6;color:#40352a">Ivory marble</span></div>
<h2>Twelve imagined court figures</h2><p>Emperors wear layered turbans, feather ornaments and cross-over jama-inspired robes; their objects evoke gardens, architecture, correspondence and worldly curiosity. Veiled queens carry flowers, an oud-like lute, a manuscript or a floral vase. Courtiers are an imagined falconer, garden steward, painter and scribe. No individual is a named or authenticated historical portrait.</p>
<section class="board cards court">${[12,25,38,51,11,24,37,50,10,23,36,49].map(id=>figure(id,true)).join("")}</section>
<h2>Small-card legibility</h2><p>58-pixel-wide cards. Conventional high-contrast rank and suit indices remain at both corners; red hearts/diamonds and dark spades/clubs.</p>
<div class="small">${[0,9,10,11,12,13,22,23,24,25,26,35,39,48].map(id=>`<img src="../themes/mughal/${cards[id]}" alt="${cardName(id)} at mobile size" width="58" height="81">`).join("")}</div>
<h2>Garden at blue hour · original instrumental loop</h2><p>A newly composed 28.8-second instrumental miniature with doubled-course oud-like plucks, airy ney/reed-like lead, soft frame-drum pulses and a spacious room response. Broad Sufi, Indo-Persian and Islamicate influences are creative reference points, not a claim of devotional or historical authenticity. All six sounds are rendered PCM16 mono at 22,050 Hz. Playback is opt-in.</p>
<div class="sounds">${Object.entries(audio).map(([role,path])=>`<label>${role === "music" ? "Garden at blue hour · loop" : role}<audio controls ${role === "music" ? "loop" : ""} preload="none" src="../themes/mughal/${path}"></audio></label>`).join("")}</div>
<h2>The complete deck</h2><section class="board cards">${Array.from({length:52},(_,id)=>figure(id)).join("")}</section>
<p><a href="./mughal-pack.zip" download>Download Mughal Gardens ZIP</a> · ${(zip.byteLength / 1048576).toFixed(2)} MiB · schema 1</p>
<p>Regenerate locally: <code>node tools/assets/mughal/generate.mjs</code></p></main>
<footer><strong>Generated with OpenAI GPT-6 Astra.</strong><p>${attribution}</p></footer></body></html>`;
await writeFile(join(output, "mughal-preview.html"), preview);

const unpacked = unzipSync(await readFile(join(output, "mughal-pack.zip")));
const decoded = JSON.parse(strFromU8(unpacked["manifest.json"]));
if (Object.keys(unpacked).length !== files.length + 1) throw new Error("ZIP whitelist mismatch");
for (const file of decoded.files) {
  const bytes = unpacked[file.path];
  if (!bytes || bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error(`Integrity failure: ${file.path}`);
  if (file.mime === "image/svg+xml") {
    const svg = strFromU8(bytes);
    if (/<script|<foreignObject|<!DOCTYPE|<!ENTITY|<style|<animate|<set[\s>]|\son[a-z]+\s*=/i.test(svg)) throw new Error(`Disallowed SVG content: ${file.path}`);
  } else if (file.mime === "audio/wav") {
    const wav = Buffer.from(bytes);
    if (wav.toString("ascii",0,4)!=="RIFF" || wav.toString("ascii",8,12)!=="WAVE" ||
        wav.readUInt32LE(4)!==wav.length-8 || wav.readUInt32LE(40)!==wav.length-44 ||
        wav.readUInt16LE(20)!==1 || wav.readUInt16LE(22)!==1 || wav.readUInt16LE(34)!==16 ||
        wav.readUInt32LE(24)!==SAMPLE_RATE) throw new Error(`Invalid WAV: ${file.path}`);
  }
}
console.log(`Generated and verified ${files.length} media assets: 52 faces, back, background, six WAVs.`);
console.log(`ZIP: generated/mughal-pack.zip (${zip.byteLength.toLocaleString("en-US")} bytes)`);
console.log(`SHA-256: ${hash(zip)}`);
console.log("Preview: generated/mughal-preview.html");
