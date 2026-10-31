# Design: Bahn-Verspätungswürfel

## Intent

- Second game for the Pages site: port the "Verspätungswürfel" artifact (https://claude.ai/artifact/14JFJH7ZiYfwpp5C9qxFLy) to `bahn-verspaetungs-wuerfel/index.html`.
- Game: double-tap a 3D die, a split-flap board shows a random official DB RIS delay reason (66 reasons, with code).

## Goals

- Behaviour and look 1:1 with the artifact.
- Repo rules: single self-contained `index.html`, zero external requests, modern browsers, mobile viewport.

## Non-goals

- No gameplay changes (double-tap stays, no single-tap roll).
- No workflow change: the Pages workflow already publishes every top-level folder with an `index.html`.

## Approaches

- Port the artifact as-is, swapping only what conflicts with repo rules (chosen; only sensible option, code is finished).
- Rewrite: rejected, adds risk for no gain.

## Decided changes vs. artifact

- Remove Google Fonts `<link>`s (Barlow, Barlow Condensed) and the `document.fonts.load` / `.fonts-ok` upgrade path.
- Font stacks (system only):
  - Body: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  - Board/headline: `"Arial Narrow", "Roboto Condensed", "Helvetica Neue Condensed", system-ui, sans-serif`
- Add CSP meta blocking all external requests (as in el-clasico-bingo), `referrer: no-referrer`, empty favicon.
- Everything else unchanged: 66 RIS reasons, bag draw without repeats, die animation, split-flap animation, share (Web Share API, clipboard fallback), light/dark, reduced motion, fan-project note.

## Tests

- `tests/bahn-verspaetungs-wuerfel.test.js` (Playwright, same style as bingo): initial board "NOCH KEIN WURF", roll via Enter and via double-click, RIS code shown, 66 rolls without a repeat, no external requests, fits 390x844 / 844x390 / 360x640 / 1440x900 without horizontal scroll, reduced motion shows result immediately.

## Left to the builder

- Minor CSS adjustments only if system fonts break the board layout.
- README: add the game to the list.
