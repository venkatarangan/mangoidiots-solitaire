import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { cardSvg, backSvg, backgroundSvg } from "./art.mjs";
import { ambientMusic, soundEffects, SAMPLE_RATE } from "./audio.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const theme = join(root, "themes", "chola");
const generated = join(root, "generated");
const hash = data => createHash("sha256").update(data).digest("hex");
const assets = {};
const files = [];

async function add(path, mime, data) {
  const bytes = typeof data === "string" ? strToU8(data) : new Uint8Array(data);
  assets[path] = bytes;
  files.push({ path, mime, bytes: bytes.byteLength, sha256: hash(bytes) });
  const destination = join(theme, ...path.split("/"));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}

await mkdir(generated, { recursive: true });
const cards = {};
for (let card = 0; card < 52; card++) {
  const path = `cards/${card}.svg`;
  await add(path, "image/svg+xml", cardSvg(card));
  cards[String(card)] = path;
}
await add("table/card-back.svg", "image/svg+xml", backSvg());
await add("table/courtyard.svg", "image/svg+xml", backgroundSvg());
const audio = {};
for (const [role, wav] of Object.entries({ ...soundEffects(), music: ambientMusic() })) {
  const path = `audio/${role}.wav`;
  await add(path, "audio/wav", wav);
  audio[role] = path;
}

const attribution = "Original procedural vector artwork and original synthesized audio created for this project with GitHub Copilot assistance. Chola-period royal-court and temple-architecture inspiration; an imaginative modern interpretation, not authenticated historical portraits or reconstructions. Kings evoke the setting of Rajaraja I; queens are imagined court women and jacks imagined commanders, with no asserted identities or relationships. No Microsoft artwork, recordings, online models, sampled instruments, or external media used. Music is a gentle original pentatonic composition with veena-, flute-, and mridangam-inspired synthesis, not a professional performance or an authentic raga rendition.";
const manifest = {
  schemaVersion: 1,
  id: "chola",
  version: "1.0.0",
  name: "Chola Royal Court",
  description: "Jewel-toned original royal-court illustrations, parchment cards, bronze-gold geometry, a quiet courtyard table, and gentle instrument-inspired synthesized sound.",
  author: "Mangoidiots Solitaire · original work with GitHub Copilot assistance",
  files,
  cards,
  back: "table/card-back.svg",
  background: "table/courtyard.svg",
  audio,
  palette: { table: "#123f44", accent: "#e8bd63" },
  attribution,
};
const manifestBytes = strToU8(JSON.stringify(manifest, null, 2) + "\n");
await writeFile(join(theme, "manifest.json"), manifestBytes);
// Fixed member timestamps keep the archive byte-identical across repeat runs.
const archive = {};
for (const [path, data] of Object.entries({ "manifest.json": manifestBytes, ...assets })) {
  archive[path] = [data, { mtime: new Date(2026, 0, 1, 0, 0, 0), level: 9 }];
}
const zipped = zipSync(archive, { level: 9 });
if (zipped.byteLength >= 30 * 1024 * 1024) throw new Error("Theme exceeds the 30 MiB limit");
await writeFile(join(generated, "chola-pack.zip"), zipped);

const card = (id, caption) => `<figure><img src="../themes/chola/${cards[id]}" alt="${caption}" width="240" height="336"><figcaption>${caption}</figcaption></figure>`;
const audioPreview = Object.entries(audio).map(([role, path]) => `<label>${role === "music" ? "Courtyard dusk · 25.6-second loop" : role}<audio controls ${role === "music" ? "loop" : ""} preload="none" src="../themes/chola/${path}"></audio></label>`).join("");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chola Royal Court · original theme preview</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b2931;color:#f6ebd0;font:16px/1.55 system-ui,sans-serif}header,main,footer{max-width:1240px;margin:auto;padding:32px}header{padding-bottom:12px}.eyebrow{color:#e8bd63;letter-spacing:.19em;text-transform:uppercase;font-size:12px}h1{font:clamp(30px,5vw,52px)/1.1 Georgia,serif;margin:12px 0}h2{font:27px Georgia,serif;color:#edca7c;margin-top:34px}p{max-width:850px;color:#d5e3d9}.board{background:#123f44 url('../themes/chola/table/courtyard.svg') center/cover;border:1px solid #b99650;border-radius:18px;padding:24px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:20px}figure{margin:0;text-align:center}img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 6px #00151a88)}figcaption{font-size:12px;margin:9px 0;color:#ebd8a8}.court{grid-template-columns:repeat(4,minmax(100px,1fr));max-width:900px;margin:auto}.sounds{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}label{display:grid;gap:8px;text-transform:capitalize;color:#ecd29c}audio{width:100%}.swatches{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.swatches span{padding:8px 14px;border-radius:30px;border:1px solid #e5cc8255}a{color:#f1ca74}footer{font-size:13px;padding-top:0}.mobile-cards{display:flex;gap:8px;flex-wrap:wrap}.mobile-cards img{width:58px;height:auto}.note{border-left:3px solid #c7a25a;padding-left:18px}
@media(max-width:600px){header,main,footer{padding:20px}.board{padding:15px}.cards{gap:12px}.court{grid-template-columns:repeat(2,minmax(100px,1fr))}}
</style></head><body>
<header><div class="eyebrow">Original art · locally rendered audio · offline ready</div><h1>Chola Royal Court</h1>
<p>A royal-court daydream in peacock blue, emerald, ruby and bronze. Fifty-two complete vector faces, twelve illustrated court characters, a geometric card back, and an understated courtyard table.</p>
<p class="note">An imaginative Chola-inspired interpretation, not authenticated portraits. Synthesized instrument-inspired music, not a professional Carnatic performance.</p></header>
<main><section class="board"><div class="cards">
${card(0, "Ace of spades")}${card(22, "Ten of hearts")}${card(38, "King of clubs")}${card(24, "Queen of hearts · veena")}${card(49, "Jack of diamonds · captain")}
<figure><img src="../themes/chola/table/card-back.svg" width="240" height="336" alt="Bronze-gold geometric card back"><figcaption>Geometric lotus back</figcaption></figure></div></section>
<div class="swatches"><span style="background:#197380">Peacock blue</span><span style="background:#9e294b">Ruby</span><span style="background:#237653">Emerald</span><span style="background:#624794">Amethyst</span><span style="background:#e8bd63;color:#352c23">Bronze gold</span><span style="background:#fff8e6;color:#352c23">Parchment</span></div>
<h2>The imagined royal court</h2><p>Kings hold a lotus sceptre and a temple model, sealed document, palm-leaf record, or model ship. Court women carry a lotus, play a veena-inspired instrument, tend a festival lamp, or hold a manuscript. Commanders bear a spear, bow, polearm, or sword with ornamental shields. Costume details and stepped temple forms are stylized inventions.</p>
<section class="board cards court">${[12,25,38,51,11,24,37,50,10,23,36,49].map(id => card(id, `${["Spades","Hearts","Clubs","Diamonds"][Math.floor(id/13)]} · ${["Jack","Queen","King"][id%13-10]}`)).join("")}</section>
<h2>Small-card legibility</h2><p>58-pixel-wide samples: dark spades/clubs, red hearts/diamonds, conventional rank and suit indices at both corners.</p><div class="mobile-cards">${[0,9,10,11,12,13,22,23,24,25,26,35,39,48].map(id=>`<img src="../themes/chola/${cards[id]}" alt="Card ${id} at mobile scale" width="58" height="81">`).join("")}</div>
<h2>Original sound palette</h2><p>Rendered PCM16 mono WAV at ${SAMPLE_RATE.toLocaleString("en-US")} Hz. Soft plucked-string tones, breath-shaped flute synthesis, and tuned percussion support a restrained original modal loop. Playback is opt-in here; nothing autoplays.</p><div class="sounds">${audioPreview}</div>
<h2>All fifty-two cards</h2><section class="board cards">${Array.from({length:52}, (_,id)=>card(id, `${["A","2","3","4","5","6","7","8","9","10","J","Q","K"][id%13]} of ${["spades","hearts","clubs","diamonds"][Math.floor(id/13)]}`)).join("")}</section>
<p><a href="./chola-pack.zip" download>Download the verified theme ZIP</a> · ${(zipped.byteLength / 1024 / 1024).toFixed(2)} MiB</p></main><footer>${attribution}</footer></body></html>`;
await writeFile(join(generated, "chola-preview.html"), html);

const unpacked = unzipSync(await readFile(join(generated, "chola-pack.zip")));
const readManifest = JSON.parse(strFromU8(unpacked["manifest.json"]));
if (Object.keys(unpacked).length !== readManifest.files.length + 1) throw new Error("ZIP whitelist mismatch");
for (const file of readManifest.files) {
  const bytes = unpacked[file.path];
  if (!bytes || bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error(`Integrity mismatch: ${file.path}`);
  if (file.mime === "audio/wav") {
    const wav = Buffer.from(bytes);
    if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE" ||
        wav.readUInt32LE(4) !== wav.length - 8 || wav.readUInt32LE(40) !== wav.length - 44 ||
        wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== 1 ||
        wav.readUInt32LE(24) !== SAMPLE_RATE || wav.readUInt16LE(34) !== 16) {
      throw new Error(`Invalid PCM16 mono WAV: ${file.path}`);
    }
  }
}
console.log(`Generated and verified ${files.length} media assets and ${Object.keys(cards).length} card faces.`);
console.log(`ZIP: generated/chola-pack.zip (${zipped.byteLength.toLocaleString("en-US")} bytes, SHA-256 ${hash(zipped)})`);
console.log("Preview: generated/chola-preview.html");
