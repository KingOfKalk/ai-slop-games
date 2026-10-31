# Bahn-Verspätungswürfel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Verspätungswürfel artifact 1:1 to `bahn-verspaetungs-wuerfel/index.html`, minus external fonts.

**Architecture:** Copy the artifact HTML verbatim, then apply the spec's changes (fonts, CSP). Behaviour tested with a plain Node + Playwright script like `tests/el-clasico-bingo.test.js`.

**Tech Stack:** HTML, CSS, vanilla JS; Node + Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-10-31-bahn-verspaetungs-wuerfel-design.md`

## Global Constraints

- Zero external requests (CSP `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:`).
- Body font: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- Board/headline font: `"Arial Narrow", "Roboto Condensed", "Helvetica Neue Condensed", system-ui, sans-serif`.
- Gameplay, copy, 66 RIS reasons, colors: unchanged from the artifact.
- Commits: plain `git`, no AI attribution. Branch `claude/bahn-verspaetungs-wuerfel`.

## Review Focus

- Rapid repeated Enter / double-taps during a roll: ignored until the roll finishes (no double draw).
- Resize mid-roll: board re-renders the current reason after the roll, not a stale one.
- Share without Web Share API and with clipboard denied: no uncaught error.
- Very narrow screen (320px): board tiles stay within the board, no horizontal scroll.
- Larger system font than Barlow Condensed: board text still fits the tile grid (wrap uses character columns, so it should).

---

### Task 1: Port game + tests

**Files:**
- Create: `bahn-verspaetungs-wuerfel/index.html`
- Create: `tests/bahn-verspaetungs-wuerfel.test.js`
- Modify: `README.md` (games list)

**Interfaces (DOM contract from the artifact):** `#scene` (role=button, tabindex 0), `#grid` with `.row > .tile > .ch`, `#code` ("RIS-Code <nn>"), `#live` (aria-live, set to "Grund: <text>" after the roll), `#share` (hidden until first roll), `#hint`.

- [ ] **Step 1: Write failing tests** (`tests/bahn-verspaetungs-wuerfel.test.js`, same runner as bingo; helper `boardText(page)` = rows' `.ch` text joined by spaces, trimmed):
  - `initial`: `#code` text `RIS-Code -`; `boardText` contains `NOCH KEIN WURF`; `#share` hidden.
  - `roll via Enter` (reduced motion for speed): focus `#scene`, press Enter -> `#code` matches `/^RIS-Code \d\d$/`; `#live` starts with `Grund: `; `#share` visible.
  - `roll via double-click` (normal motion): `page.dblclick('#scene')` -> after 1700 ms `#live` starts with `Grund: `.
  - `no repeats in 66 rolls` (reduced motion): 66 Enter presses, collect `#code` -> 66 unique codes.
  - `ignores input mid-roll` (normal motion): Enter, Enter within 100 ms -> after 1700 ms exactly one change of `#code` recorded via MutationObserver.
  - `share fallback safe`: `addInitScript` deleting `navigator.share` and making `navigator.clipboard.writeText` reject; roll, click `#share` -> no `pageerror`.
  - `no external requests`: only `file://` requests.
  - `fits` 320x568, 390x844, 844x390, 1440x900: `scrollWidth <= width`; every `.tile` right edge <= `#board` right edge.

- [ ] **Step 2: Run, verify fail**

Run: `node tests/bahn-verspaetungs-wuerfel.test.js`
Expected: FAIL (file not found).

- [ ] **Step 3: Implement** - artifact HTML verbatim, then: remove the 3 Google Fonts `<link>`s; set `--font-body` / `--font-board` to the Global Constraints stacks; remove the `document.fonts.load` block and `.fonts-ok` rules, moving their larger sizes (`h1 clamp(38px, 9vw, 60px)`, `.ch calc(var(--tw) * 1.3)`) into the base rules only if the board still fits (else keep base sizes, ledger a ruling); add CSP, `referrer` meta, `<link rel="icon" href="data:,">`.

- [ ] **Step 4: Run, verify pass**

Run: `node tests/bahn-verspaetungs-wuerfel.test.js`
Expected: all PASS. Also `node tests/el-clasico-bingo.test.js` still 21/21.

- [ ] **Step 5: Screenshots** at 390x844 (light + dark) and 844x390 after one roll; check board look.

- [ ] **Step 6: README** - add `[Bahn-Verspätungswürfel](https://kingofkalk.github.io/ai-slop-games/bahn-verspaetungs-wuerfel/)` and the test command.

- [ ] **Step 7: Commit + push** `feat: add Bahn-Verspätungswürfel game`, `git push -u origin claude/bahn-verspaetungs-wuerfel`.
