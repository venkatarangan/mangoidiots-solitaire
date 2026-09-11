# Mangoidiots Solitaire product specification

## Product summary

Mangoidiots Solitaire is a colourful, offline-first Draw 1 Klondike game for
phones, tablets, and desktop browsers. It combines familiar solitaire rules
with original Indian-history-inspired visual and musical themes.

- **Application version:** 1.3.3
- **Previous working release:** 1.3.2, commit `98f5610`
- **Hosting:** GitHub Pages
- **Production URL:** <https://solitaire.mangoidiots.com/>

The game is independent work. It does not copy Microsoft's artwork, sounds,
branding, source code, or proprietary deal collection.

## Core game

| Area | Required behaviour |
| --- | --- |
| Rules | Klondike, Draw 1 |
| Layout | Stock and waste on the left; foundations above the columns, or beside them in short landscape |
| Difficulty | Easy, Medium, and Difficult proven-solvable deals |
| Scoring | Standard-style move points, Undo penalties, recycling rules, timer, and victory bonus |
| Hints | Explain a useful legal move without moving the cards |
| Undo | Restore the exact board and score state |
| Reset | Restart the same deal and record the previous attempt |
| New Game | Select a difficulty and choose another deal |
| Auto-finish | Offer only when the remaining legal sequence is deterministic |
| Timer | Count active play only; settings/help/results pause play, while the interactive keyboard card list remains playable |
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
- The layout is calculated from visible width and height. Genuine resizes and
  scrolling cancel a held drag safely. A tap-selected card remains selected
  while scrolling to a distant destination.

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
- Each 1.1.0 theme includes standard and large-index faces. Smaller cards use a
  clear horizontal rank/suit strip while retaining the original court artwork.
- A saved 1.0.0 theme upgrades explicitly to the same theme's 1.1.0 pack, without
  resetting progress. A failed download retains a complete cached previous pack
  and explains how to retry.

## Visual and audio experience

- The board must remain readable at 320 px portrait width and in phone
  landscape.
- At the default card size, seven tableau columns fit across the table. Zoomed
  tables scroll internally in either direction without widening the page.
- Phone ranks have at least 14 CSS pixels of nominal type size in portrait and
  at least 12 in the shortest supported landscape layout at 100% zoom. Fit is an
  optional smaller overview; scrollable readable cards are the default.
- Landscape acceptance includes visible viewports of 667 x 300, 780 x 320, and
  844 x 390 CSS pixels, with browser controls present.
- Short landscape uses a side area for stock, waste, and foundations. Long runs
  retain large indices and scroll instead of being squeezed into the height.
- Short landscape does not reserve a row for display controls. A **Display**
  button below Undo, Hint, and Pause in the right action rail opens zoom, Fit,
  Scroll, and Colour in a temporary accessible panel.
- Visible zoom controls provide 75%, 100%, 125%, 150%, 175%, 200%, and Fit.
  Fit includes the complete wide laptop/desktop and short-landscape table,
  shrinking cards when necessary. Portrait Fit remains width-only and can still
  scroll long runs. Numeric zoom preserves its requested scale and default 100%.
- Wide, short laptops (width >= 1000 CSS pixels, height > 500 and <= 800) use
  one 68-pixel left display rail, a shorter header, compact caption, and bottom
  essential actions. Every display/action button remains at least 44 x 44 pixels.
  Stock/waste/foundations stay above the seven columns; height constraints do not
  implicitly change the pile arrangement.
- A bounded laptop grid allocates remaining viewport height independently of
  canvas content; status and scrollable errors occupy their own rows, never
  covering cards. Secondary information and keyboard controls remain in the menu.
  Taller desktops keep the horizontal display row and use the bounded table
  height for Fit; phone-width layouts never acquire the laptop rail.
- Shared drawing/hit-test geometry includes labels, card tails and bottom
  padding. Fit preserves proportional exposed rank/suit strips and selects
  compact art based on Fit's final card size. Deep hidden stacks compress before
  the complete overview shrinks; moves cannot cause a content/viewport resize loop.
- Scroll mode uses one-finger swipes over cards without moving them. Turning it
  off restores card drag/tap interactions. Selected cards survive scrolling.
- Zoom and a preset/custom colour persist locally, including across theme
  changes. The chosen colour covers the entire app and playing area without
  decorative overlays, with contrasting text, controls and pile labels.
  A theme-background reset restores the theme's original appearance.
- The menu shows the Mangoidiots logo and groups game actions, appearance/sound,
  and help/information. About links to the public GitHub repository.
- The current package version appears in the normal footer, About, and the
  compact-landscape menu. The compact-landscape footer remains hidden to
  preserve playing height.
- Secondary information and the keyboard list remain accessible from the menu.
- Back stacks may overlap tightly, but every exposed card's identifying strip
  remains visible. Hidden identities remain concealed.
- Device-aware canvas and text resolution supports Retina screens while bounding
  texture dimensions and memory use.
- Rank and suit indices use conventional high-contrast colours.
- Animations cover deals, legal moves, score feedback, hints, and victory.
- Successful manual or auto-finish wins show fireworks in the visible results
  panel. Closing/skipping releases animation resources. Reduced effects use a
  static celebration; reloading a completed game does not replay fireworks.
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
- Publication excludes personal saves, browser profiles, credentials, private
  filesystem paths, and diagnostic session artifacts. Prompt history contains
  product requests, not private tool/session context.

## GitHub Pages delivery

- The repository is the deployment source of truth.
- A GitHub Actions workflow builds and deploys every accepted change on `main`.
- Generated output is uploaded as a Pages artifact rather than committed.
- Application URLs are relative so the artifact is served from `/` on
  `solitaire.mangoidiots.com`.
- Canonical and social-sharing metadata use the production URL.
- A 1200 × 630 Open Graph image is published for link previews.
- `CNAME` binds the Pages deployment to `solitaire.mangoidiots.com`.
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
10. Both themes pass Fit containment, scroll/zoom, background persistence,
    large-index, rotation, victory, and old-theme upgrade coverage. Browser
    emulation is distinguished from physical-device review.
11. Laptop coverage includes 1024 x 600, 1280 x 600, 1280 x 720, 1366 x 650,
    1440 x 750 and 1536 x 800 CSS pixels with DPR 1/2, thresholds near widths
    of 1000 and heights of 500/800, and a 1920 x 1080 desktop. The 1366 x 650
    table recovers at least the old 52-pixel display row without hiding essential
    actions. Initial deals, mixed positions, deep backs and 13-card runs fit
    fully at scroll zero. Numeric zoom reaches the last card and both-axis
    scrolled drag targets stay accurate.
12. Phone portrait widths 320/375/390/430 and landscape 667 x 300, 780 x 320,
    844 x 390 and 932 x 430 retain readable default indices and DPR 2/3 support.
    Browser zoom is evaluated through equivalent reduced CSS viewport sizes,
    not physical screen dimensions. Landscape Display controls open temporarily
    from the right rail without reducing board height. CI retains existing
    mobile checks and adds a bounded laptop selection.

## Deferred work

- Cloud save synchronization
- User accounts
- Multiplayer or leaderboards
- Draw 3
- Native app-store packages
- A graphical theme-authoring studio
