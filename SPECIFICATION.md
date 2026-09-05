# Mangoidiots Solitaire product specification

## Product summary

Mangoidiots Solitaire is a colourful, offline-first Draw 1 Klondike game for
phones, tablets, and desktop browsers. It combines familiar solitaire rules
with original Indian-history-inspired visual and musical themes.

- **Current application version:** 1.2.0
- **Hosting:** GitHub Pages
- **Temporary URL:** <https://venkatarangan.github.io/mangoidiots-solitaire/>
- **Planned URL:** <https://solitaire.mangoidiots.com/>

The game is independent work. It does not copy Microsoft's artwork, sounds,
branding, source code, or proprietary deal collection.

## Core game

| Area | Required behaviour |
| --- | --- |
| Rules | Klondike, Draw 1 |
| Layout | Stock and waste on the left; four suit foundations on the right |
| Difficulty | Easy, Medium, and Difficult proven-solvable deals |
| Scoring | Standard-style move points, Undo penalties, recycling rules, timer, and victory bonus |
| Hints | Explain a useful legal move without moving the cards |
| Undo | Restore the exact board and score state |
| Reset | Restart the same deal and record the previous attempt |
| New Game | Select a difficulty and choose another deal |
| Auto-finish | Offer only when the remaining legal sequence is deterministic |
| Timer | Count active play only; pause while dialogs or pause state stop play |
| History | Retain the latest 500 completed, restarted, or abandoned attempts |

## Interaction

- Cards support mouse, touch, and keyboard play.
- A legal destination is selected from the leading dragged card's overlap and
  bounded proximity, not only the pointer coordinate.
- Legal targets glow before release.
- Ambiguous and illegal drops return the cards safely.
- Escape, pointer cancellation, window blur, and real board-size changes cancel
  a held drag without losing cards.
- The top two waste and foundation cards remain rendered so dragging the top
  card immediately reveals the card underneath.
- Only the top waste or foundation card is interactive.
- Touch targets are at least 44 CSS pixels where practical.

## Themes

### Chola Royal Court

- Original jewel-toned court imagery inspired by the Rajaraja Chola period
- Parchment, bronze-gold geometry, temple and courtyard motifs
- Original veena-, flute-, and mridangam-inspired synthesized music

### Mughal Gardens

- Original miniature-inspired court figures, floral inlay, arches, and charbagh
  garden geometry
- Lapis, turquoise, emerald, rose, ivory, and antique-gold palette
- Original oud-, reed-, and frame-drum-inspired instrumental synthesis
- No sacred text, recitation, adhan, devotional vocals, or copied recordings

### Theme behaviour

- The main screen and menu both expose the theme collection.
- Switching themes preserves the board, pause state, Undo history, score, and
  timer.
- Theme packs are static ZIP assets listed in `themes.json`.
- Each ZIP is downloaded, size-limited, validated, hash-checked, and cached
  locally before activation.
- A failed update cannot replace a usable cached theme.
- New themes are added through the repository and deployed with the site.

## Visual and audio experience

- The board must remain readable at 320 px portrait width and in phone
  landscape.
- All seven tableau columns remain visible without horizontal page scrolling.
- Rank and suit indices use conventional high-contrast colours.
- Animations cover deals, legal moves, score feedback, hints, and victory.
- Reduced-motion mode removes unnecessary movement without reducing usability.
- Shuffle, draw, placement, invalid action, victory, and background music have
  independent synthesized assets.
- Users can mute all sound and control music/effect volume.

## Persistence and privacy

- Current game, Undo snapshots, preferences, selected theme, and history are
  stored in IndexedDB.
- Theme media and offline files are stored in browser Cache Storage.
- A Web Lock prevents two tabs from writing the same game simultaneously.
- No account, analytics, advertising, telemetry, or progress-upload API is
  included.
- Corrupt or unsupported saves produce a visible error and are not silently
  overwritten.
- Cloud synchronization is explicitly out of scope.

## GitHub Pages delivery

- The repository is the deployment source of truth.
- A GitHub Actions workflow builds and deploys every accepted change on `main`.
- Generated output is uploaded as a Pages artifact rather than committed.
- URLs are relative so one artifact supports:
  - `/mangoidiots-solitaire/` on the default GitHub Pages domain.
  - `/` on `solitaire.mangoidiots.com`.
- `resume/index.html` provides a static resume route.
- `.nojekyll` prevents Jekyll processing.
- The service worker remains inside and controls only the game deployment scope.
- The build must not rely on host-specific response headers.

## Offline lifecycle

1. The first online visit downloads and validates the core application.
2. The selected theme ZIP is downloaded, validated, and expanded into Cache
   Storage.
3. **Ready offline** appears only after the core and active theme are complete.
4. Reloading or reopening the deployment URL works without a network.
5. Updates install separately and wait until existing game tabs close.
6. Old caches are not broadly deleted while another tab may still use them.

## Accessibility

- Every important action is a native HTML control with an accessible name.
- A keyboard card list allows source and destination selection without dragging.
- Dialogs trap focus, close predictably, and restore focus.
- Status and errors use appropriate live regions.
- Hidden cards are never announced as visible information.
- Colour is not the only signal for suits, targets, state, or errors.

## Release acceptance

A release is ready only when:

1. TypeScript checking and all unit tests pass.
2. All browser tests pass at the GitHub project-path base.
3. All three difficulty witnesses complete through real UI controls.
4. Mouse, touch, keyboard, cancellation, Undo, and forgiving targeting work.
5. Both themes download, decode, switch, and reopen offline.
6. Saves, pause state, preferences, and 500-entry history survive reloads.
7. The generated artifact contains no unresolved build tokens or unexpected
   non-static files.
8. `index.html`, `resume/index.html`, manifest, icons, themes, and service worker
   are present.
9. The public Pages URL loads over HTTPS and reaches **Ready offline**.

## Deferred work

- Cloud save synchronization
- User accounts
- Multiplayer or leaderboards
- Draw 3
- Native app-store packages
- A graphical theme-authoring studio
