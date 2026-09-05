# Chola Royal Court — original theme pack

This is an original, reproducibly generated theme for this project's solitaire
game, created with GitHub Copilot assistance. It contains 52 complete card-face
SVGs, one back, one table background, five sound effects, and one rendered
25.6-second ambient loop. All media can be used offline.

## Interpretation and provenance

The illustrations are a modern, imaginative interpretation of Chola-period royal
court life and temple architecture. Kings evoke the setting of Rajaraja I, not a
verified likeness. Queens are imagined court women; jacks are imagined commanders.
No specific identities, kinships, dress reconstruction, or historical accuracy are
asserted. The twelve court illustrations use original paths, shaded jewel-toned
costumes, ornamental headpieces, jewellery, and ceremonial or practical objects.
There are no copied Microsoft cards, historical portraits, third-party images,
traced artworks, downloaded recordings, online models, or external media.

The music is an original pentatonic composition with additive plucked-string,
breath-shaped flute, tuned-percussion and drone synthesis. Veena, flute and
mridangam are inspirations, not sampled instruments or a claim to a professional
Carnatic performance. The piece is not represented as an authentic raga rendition.
All noise is deterministically seeded. No audio service is required.

## Regenerate

From the project root, with Node.js and the existing `fflate` dependency:

```powershell
node .\tools\assets\generate.mjs
```

The generator writes `themes\chola\manifest.json`, `cards\`, `table\`, `audio\`,
`generated\chola-pack.zip`, and `generated\chola-preview.html`. Source artwork is
in `tools\assets\art.mjs`; audio synthesis is in `tools\assets\audio.mjs`.

Archive timestamps are fixed. Repeated runs with the same Node runtime and source
produce byte-identical media and ZIP output. Different JavaScript engines may
round floating-point audio synthesis differently. The source files and this README
are deliberately **not** in the installable ZIP. Provenance is embedded in the
manifest's `attribution` field instead.

## Integration

Schema version 1; ID `chola`; version `1.0.0`. Each archive entry is either
`manifest.json` or a listed `files[].path`; SHA-256 and exact byte sizes cover all
60 media files. There are no directory, source-code, or executable entries.

- Card keys: `"0"` through `"51"`; rank is `card % 13 + 1`.
- Suit order: spades, hearts, clubs, diamonds. Hearts and diamonds have red indices.
- Face dimensions: 240 × 336; back: 240 × 336; background: 1600 × 1000.
- All SVGs are self-contained and have no scripts, external references, embedded
  fonts, animation, `foreignObject`, stylesheets, or filters.
- Corner ranks use the local Georgia/serif font stack. Typography can vary by OS.
  Pips and decorative elements are vector paths, not font glyphs.
- WAVs are 22,050 Hz, mono, uncompressed 16-bit little-endian PCM.
- Music is designed to loop: cyclic event and room-reflection tails, integer-cycle
  drone tones, and restrained peak level. Actual gapless playback depends on the
  app/audio browser implementation. Sound effects have click-suppressing fades.
- `audio.music` should be user-controlled and looped by the player. No runtime
  synthesis, automatic playback, or victory video is required by the pack.

Open `generated\chola-preview.html` for a local visual and audio review. It includes
all faces and 58-pixel-wide mobile samples. The generator verifies the complete
ZIP whitelist, all hashes and sizes, and WAV headers after writing.
