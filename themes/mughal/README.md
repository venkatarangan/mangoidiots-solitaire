# Mughal Gardens — Mangoidiots Solitaire

**Generated with OpenAI GPT-6 Astra.**

Original vector artwork and locally synthesized instrumental music for
[Mangoidiots Solitaire](https://solitaire.mangoidiots.com/).

## Creative direction and provenance

This is a respectful, imaginative interpretation of Mughal-period Indian miniature
and court art: ivory/marble, floral inlay, scalloped arches, charbagh-inspired water
channels, lapis, turquoise, emerald and antique gold. The images are not traced,
copied commercial cards, authenticated portraits, or historical reconstructions.
No individual is named as a historical emperor, queen or courtier. No sacred text
appears on the cards; decorative document marks are only short abstract strokes.

The twelve court figures have deliberately different roles and objects:

| Suit | King / imagined emperor | Queen / imagined court woman | Jack / imagined courtier |
| --- | --- | --- | --- |
| Spades | Garden patron with pavilion model | Rose garden | Falconer |
| Hearts | Garden audience with flower | Court melody with oud-like lute | Garden steward |
| Clubs | Court counsel with document | Court letters with book | Painter |
| Diamonds | Worldly curiosity with globe | Floral arts with vase | Scribe |

Layered turbans and feather ornaments, cross-over jama-inspired robes, veils,
floral hems and miniature-style sideward faces distinguish this deck from the
Chola deck. These are stylized costume choices, not archaeological claims.

## Instrumental sound

“Garden at blue hour” is a newly composed 28.8-second instrumental loop. Broad
Sufi, Indo-Persian and Islamicate cultural influences inform the creative direction.
Double-course oud-like plucks, an airy ney/reed-like lead and soft daf/frame-drum
inspired percussion are synthesized locally. It is **not** a historical,
professional or devotional performance, nor a claim to reproduce a specific
maqam or established composition.

There is no Quran recitation, adhan, religious singing, speech, sampled instrument,
downloaded recording, online model or external audio service. All noise is seeded.
The six supplied WAVs are distinct from the Chola pack: shuffle, draw, place,
invalid, victory and music. They are mono PCM16 at 22,050 Hz. Percussion and
melodic dynamics are restrained; cyclic event/reflection tails and whole-cycle
background tones support smooth looping. Gapless playback still depends on the
browser/player.

## Generate and verify

From the project root, using the project's Node runtime and existing dependencies:

```powershell
node .\tools\assets\mughal\generate.mjs
node --test .\tests\mughal-theme.test.mjs
```

The generator writes this folder's `manifest.json`, `cards\`, `table\`, and
`audio\`, plus `generated\mughal-pack.zip` and `generated\mughal-preview.html`.
It leaves the Chola deck, application and project configuration unchanged.
Shared imports reuse only the original pip-path helper and the original PCM WAV
encoder/sample-rate constant; all illustration compositions and audio voices,
melodies, rhythms and effects in this theme are new.

Fixed ZIP timestamps and seeded synthesis produce byte-identical archives on
repeat runs with the same source and Node runtime. Floating-point arithmetic may
vary between engines. No media is generated at game runtime.

## Integration

- Manifest schema 1; `id: mughal`; version `1.0.0`; name `Mughal Gardens`.
- Exactly 61 ZIP members: root `manifest.json` plus 60 listed media files.
  No directory-only members, executable source, or unlisted documentation.
- Card IDs are `"0"`–`"51"`; rank is `id % 13 + 1`; suit order is spades,
  hearts, clubs, diamonds. Hearts/diamonds have red indices.
- 52 faces and one back are 240 × 336 SVG; table is 1600 × 1000 SVG.
- SVGs use only self-contained elements, attribute styling and internal gradient
  URLs. No scripts, animation, external references, embedded stylesheet or font.
- Ranks use the local Georgia/serif font stack; typography may vary by OS.
  Standard pips and all artwork are paths/shapes, not external font glyphs.
- Audio is `audio/wav`. Music is user-controlled and looped by the app.
- Provenance is present in the manifest's `attribution`. This README and source
  code remain outside the ZIP.

The local preview contains the initial selection, all twelve courts, all 52
cards, 58-pixel-wide legibility examples, the back, table palette and audio players.
