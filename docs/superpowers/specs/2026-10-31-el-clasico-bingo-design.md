# Design: GitHub Pages setup + El Clásico Bingo

## Intent

- Repo hosts simple browser games on GitHub Pages.
- Each top-level folder = one game, entry point `<folder>/index.html`.
- First game: `el-clasico-bingo`, a playable version of the "El Clásico Bingo" sharepic (Bayern vs. BVB drinking game): mark a field each time someone says "El Clásico", 5 in a row = bingo.

## Goals

- Deploy automatically on push to `main` via GitHub Actions.
- Game works on phones while watching the match.
- Fully self-contained, no tracking.

## Non-goals

- No landing page at the root URL (root returns 404).
- No build step, frameworks, or dependencies.
- No multiplayer, accounts, or shared state.

## Anti-goals

- Any external request (CDN, Google Fonts, analytics, cookies).
- Docs, README, or repo internals published on the site.

## Approaches considered

1. **Pages serves `main` branch directly** - zero config, but publishes everything in the repo (docs, README).
2. **GitHub Actions workflow (chosen)** - publishes only game folders; small YAML to maintain.

Chosen by user: option 2.

## Deployment

- Workflow `.github/workflows/pages.yml`, triggers: `push` to `main`, `workflow_dispatch`.
- Staging step: copy every top-level directory that contains an `index.html` into `_site/` (skips dot-dirs, `docs/`, README). New games need no workflow change.
- Uses official actions: `actions/checkout`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`.
- Permissions: `pages: write`, `id-token: write`, `contents: read`; concurrency group `pages`.
- Manual one-time step (user): repo Settings > Pages > Source = "GitHub Actions".

## Game: el-clasico-bingo

### Rules (decided)

- 5x5 board, every field labelled "El Clásico".
- Centre field is the free space: pre-marked, cannot be unmarked.
- Tap a field to mark; tap again to unmark.
- Bingo = any full row, column, or either diagonal (12 lines, standard bingo).
- Win animation (fireworks) on every newly completed line.
- Reset icon top-right: clears all marks except the centre.

### Content (from the artifact, German)

- Title "El Clásico Bingo" ("Bingo" in yellow).
- "FC Bayern München vs. BVB" (red / grey / yellow). Match date and time dropped so it works for any Klassiker.
- Footer: "Treffer = jedes Mal, wenn jemand "El Clásico" sagt", cards "Bei jedem Treffer: 1 Kurzer" (red border) and "Bei einem Bingo: 5 Kurze" (yellow border).

### Look (from the artifact)

- Background #121212, text #F2F2F2, muted #A0A0A0.
- Accents: red #FF3B5C, yellow #FDE100.
- Fields: #1E1E1E with #555555 border, radius 8px; marked fields yellow (#FDE100, dark text) like the artifact's centre.
- Font: system stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), bold.

### Technical constraints

- Single `index.html`, inline CSS + JS, zero external requests.
- Modern evergreen browsers only (Chrome, Firefox, Safari, Edge), no polyfills.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, safe-area insets.
- Fits one screen without scrolling in portrait; usable in landscape.
- Touch targets >= 44px; reset is a real `<button>` with `aria-label`; fields are `<button>`s with `aria-pressed`.
- State persisted in `localStorage` (try/catch, works without it).
- Fireworks: hand-written `<canvas>` particle animation, overlay, non-blocking; reduced or skipped under `prefers-reduced-motion`.
- `lang="de"`.

## Left to the builder

- Exact fireworks look and duration.
- Reset icon drawing (inline SVG).
- Responsive sizing details.
