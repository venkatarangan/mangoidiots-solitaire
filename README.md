# Mangoidiots Solitaire

An offline-first Draw 1 Klondike game with original Chola and Mughal themes,
responsive card interactions, synthesized music, local saves, and no account or
remote progress tracking.

**Generated with OpenAI GPT-6 Astra.**

- Current Pages address:
  <https://venkatarangan.github.io/mangoidiots-solitaire/>
- Planned custom address:
  <https://solitaire.mangoidiots.com/>

## Features

- Draw 1 Klondike with Standard-style scoring
- Easy, Medium, and Difficult proven-solvable deals
- Undo, Reset, New Game, hints, timer, and Auto-finish
- Save and resume through IndexedDB
- Game history for the latest 500 attempts
- Offline restart through a scoped service worker
- Mouse, touch, and keyboard play
- Forgiving legal-target drag-and-drop geometry
- Responsive phone, tablet, landscape, and desktop layouts
- Visible underlying foundation and waste cards while dragging
- Chola Royal Court and Mughal Gardens themes
- Original synthesized effects and instrumental music
- Mute, separate volume controls, and reduced-motion preference

The game does not load analytics, advertising, external fonts, CDNs, or
third-party runtime services.

## Play and install

Open the Pages address in a current Chrome, Edge, Firefox, or Safari browser.
Allow the first download to complete before going offline. Use the browser's
**Install app** or **Add to Home Screen** action if you want an app-like shortcut.

Progress, preferences, Undo state, and game history remain in that browser
profile. They are not uploaded or synchronized. Browser storage belongs to an
origin, so the temporary `github.io` address and the future custom domain have
separate saves.

## Development

Requirements:

- Node.js 24
- npm
- Google Chrome for the existing Playwright configuration

```powershell
npm ci
npm run build
npm run preview
```

Open:

```text
http://127.0.0.1:4173/mangoidiots-solitaire/
```

`npm run build` performs type checking, regenerates both deterministic theme
packs, builds the application, and writes the complete static site to `dist`.
The build uses relative URLs, so the same artifact works at the GitHub project
path and at the root of the custom domain.

Run all tests:

```powershell
npm test
```

The test suite covers rules, scoring, complete proven-solvable games, storage,
history retention, theme validation, rendering, drag-and-drop, touch,
accessibility, responsive layouts, service-worker updates, and offline restart.
The full visual suite is intentionally run during local release validation;
deployment CI uses a smaller deterministic smoke set to avoid platform-specific
pixel-rendering differences.

## GitHub Pages deployment

`.github/workflows/deploy-pages.yml` builds and deploys the site whenever a
commit reaches `main`. It:

1. Installs the locked npm dependencies.
2. Builds the static site into `dist`.
3. Runs the deterministic unit, artifact, and Pages browser smoke tests.
4. Uploads `dist` as the Pages artifact.
5. Deploys through GitHub's `github-pages` environment.

No generated site files are committed. GitHub Actions always produces the
deployment from the tracked source and lockfile.

### Custom domain

The intended domain is `solitaire.mangoidiots.com`. After its DNS record points
to GitHub Pages, configure that exact name under **Repository Settings → Pages →
Custom domain**, wait for the DNS check and certificate, then enable
**Enforce HTTPS**.

Do not add a `CNAME` file manually before the DNS record is ready: doing so can
make the temporary `github.io` address redirect to a hostname that does not yet
resolve.

## Static output

The `dist` directory contains:

- `index.html` and `resume/index.html`
- hashed JavaScript, CSS, and logo assets
- PWA icons and `manifest.webmanifest`
- `sw.js` with a content-derived offline cache version
- `themes.json`
- bundled Chola and Mughal theme ZIPs
- `.nojekyll`

Theme ZIPs remain inside the deployed static site because the browser downloads
and validates them on first use. They are not separate release downloads.

## Offline and update behaviour

The service worker is scoped to the deployed game path. It verifies MIME types,
content hashes, build markers, and the static theme catalog before reporting
**Ready offline**. It does not call `skipWaiting`, so a new build cannot replace
the code underneath an active game. Close all game tabs and reopen the site to
activate a waiting update.

Each theme is downloaded as one ZIP, validated in the browser, and stored in
Cache Storage. The active theme remains usable if a later network request fails.
Additional themes are added through source changes and a new Pages deployment.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/` | Game UI, rules integration, persistence, themes, and Phaser table |
| `themes/` | Current generated theme artwork, audio, and manifests |
| `tools/assets/` | Deterministic theme generators |
| `tools/build.mjs` | Static Pages and PWA build |
| `tools/pages-server.mjs` | Local server that reproduces the project-path deployment |
| `tests/` | Unit and browser regression tests |
| `.github/workflows/deploy-pages.yml` | Automatic Pages deployment |
| `SPECIFICATION.md` | Product and acceptance specification |
| `prompt-history.md` | User-authored prompts retained as project history |

## Attribution

The card art, backgrounds, geometric ornaments, sound effects, and music are
original contemporary interpretations created for this project with AI
assistance. They are not authenticated historical portraits, archaeological
reconstructions, recorded traditional performances, or reproductions of an
existing commercial solitaire game.

Mangoidiots Solitaire is an independent project and is not affiliated with
Microsoft.
