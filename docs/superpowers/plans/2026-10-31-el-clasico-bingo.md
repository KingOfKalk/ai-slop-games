# El Clásico Bingo + Pages Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy top-level game folders to GitHub Pages via Actions and ship the first game, `el-clasico-bingo`.

**Architecture:** A Pages workflow stages every top-level folder containing `index.html` into `_site/` and deploys it. The game is one self-contained `index.html` (inline CSS/JS). Behaviour is tested with a plain Node script driving the pre-installed Playwright Chromium.

**Tech Stack:** HTML, CSS, vanilla JS, GitHub Actions, Node + Playwright (tests only, no `package.json`).

**Spec:** `docs/superpowers/specs/2026-10-31-el-clasico-bingo-design.md`

## Global Constraints

- Zero external requests from the game (no CDN, no Google Fonts, no analytics, no cookies).
- Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Colors: bg `#121212`, text `#F2F2F2`, muted `#A0A0A0`, red `#FF3B5C`, yellow `#FDE100`, field `#1E1E1E`, field border `#555555`, radius `8px`.
- `lang="de"`, viewport `width=device-width, initial-scale=1, viewport-fit=cover`.
- Copy (German, verbatim): title `El Clásico Bingo`, teams `FC Bayern München vs. BVB`, field label `El Clásico`, footer `Treffer = jedes Mal, wenn jemand "El Clásico" sagt`, cards `Bei jedem Treffer` / `1 Kurzer` and `Bei einem Bingo` / `5 Kurze`.
- No match date/time on the page.
- Commits: plain `git`, no AI attribution.

## Review Focus

- Corrupt or foreign `localStorage` value: game loads with a fresh board (centre marked), no crash.
- `localStorage` throwing (private mode): game fully playable, just not persisted.
- Reload with existing lines complete: no fireworks on load, only on a newly completed line.
- Reset during running fireworks: animation stops, canvas cleared.
- Short landscape viewport (e.g. 844x390): whole board visible, no page scroll.

---

## File Structure

- `.github/workflows/pages.yml` - build `_site/` from game folders, deploy to Pages.
- `el-clasico-bingo/index.html` - the game.
- `tests/el-clasico-bingo.test.js` - Playwright behaviour tests (`node tests/el-clasico-bingo.test.js`, exits non-zero on failure).
- `README.md` - one line per game, how to add a game.

### Task 1: Pages workflow

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

- [ ] **Step 1: Write workflow**
  - Triggers: `push` on `main`, `workflow_dispatch`.
  - `permissions: { contents: read, pages: write, id-token: write }`, `concurrency: { group: pages, cancel-in-progress: false }`.
  - Job `build`: `actions/checkout@v4`, `actions/configure-pages@v5`, stage step, `actions/upload-pages-artifact@v3` with `path: _site`.
  - Job `deploy` (needs build): `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`, `actions/deploy-pages@v4` with `id: deployment`.
  - Stage step:
    ```bash
    mkdir -p _site
    for d in */; do
      d="${d%/}"
      case "$d" in docs|tests|_site) continue ;; esac
      [ -f "$d/index.html" ] && cp -r "$d" _site/
    done
    touch _site/.nojekyll
    ```

- [ ] **Step 2: Verify stage step locally**

Run the stage step in the repo root after Task 2 exists (or with a dummy `el-clasico-bingo/index.html`), then `ls -A _site`.
Expected: `.nojekyll  el-clasico-bingo`. Then `rm -rf _site`.

- [ ] **Step 3: Verify YAML parses**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/pages.yml'))"`
Expected: no output, exit 0.

- [ ] **Step 4: README** - list games with path, note: "Add a game = new top-level folder with `index.html`; enable Pages Source = GitHub Actions once."

- [ ] **Step 5: Commit** `ci: deploy game folders to GitHub Pages`

### Task 2: Game board, rules, persistence, reset

**Files:**
- Create: `el-clasico-bingo/index.html`
- Create: `tests/el-clasico-bingo.test.js`

**Interfaces (DOM contract the tests rely on):**
- 25 `<button class="cell" data-index="0..24" aria-pressed="true|false">`; centre `data-index="12"` has `disabled` and `aria-pressed="true"`.
- `<button id="reset" aria-label="Spiel zurücksetzen">` top-right, inline SVG icon.
- `<canvas id="fireworks">` full-viewport overlay, `pointer-events: none`.
- `document.body.dataset.bingos` = number of completed lines (string).
- `document` dispatches `CustomEvent('bingo', { detail: { lines: number[] } })` for newly completed lines (line indices into `LINES`).
- `localStorage` key `el-clasico-bingo:v1` = JSON array of 25 booleans.
- Lines: indices of rows, columns, diagonals (12 lines) as a const `LINES: number[][]`.

- [ ] **Step 1: Write failing tests** (`tests/el-clasico-bingo.test.js`, `require('playwright')`, load `file://` URL, `assert` from `node:assert`):
  - `initial`: 25 cells; only index 12 pressed; index 12 disabled; `bingos === "0"`.
  - `toggle`: click 0 -> pressed true; click 0 again -> false.
  - `row bingo`: click 10,11,13,14 -> `bingos === "1"`, one `bingo` event with `lines` of length 1.
  - `column bingo`: click 2,7,17,22 -> `bingos === "1"`.
  - `diagonal bingo`: click 0,6,18,24 -> `bingos === "1"`; plus 4,8,16,20 -> `"2"`.
  - `no bingo on 4`: click 0,1,2,3 -> `"0"`.
  - `re-trigger`: complete row 2, unmark 10, re-mark 10 -> two `bingo` events total.
  - `persistence`: mark 0, reload -> 0 pressed.
  - `reload no fireworks`: complete row 2, reload -> zero `bingo` events after load, `bingos === "1"`.
  - `corrupt storage`: set key to `"garbage"`, reload -> initial state.
  - `storage throws`: `addInitScript` overriding `Storage.prototype.getItem/setItem` to throw -> toggle still works.
  - `reset`: mark 0,1, click `#reset` -> only 12 pressed, `bingos === "0"`, storage reset.
  - `no external requests`: `page.on('request')` sees only `file://` URLs.
  - `landscape fit`: viewport 844x390 -> `document.documentElement.scrollHeight <= 390` and cell 24 bounding box within viewport.
  - `portrait fit`: viewport 390x844 -> same check.

- [ ] **Step 2: Run tests, verify fail**

Run: `node tests/el-clasico-bingo.test.js`
Expected: FAIL (file missing / selectors not found).

- [ ] **Step 3: Implement `el-clasico-bingo/index.html`**
  - Layout: header (title, teams), 5x5 grid, footer (rule line + two cards); `100dvh` flex column, grid sized by `min()` of available width/height so it fits both orientations; landscape (`orientation: landscape` and short height): header+footer left column, grid right.
  - Marked cell: bg `#FDE100`, border `#FDE100`, text `#121212`.
  - Padding uses `env(safe-area-inset-*)`.
  - Bingo detection: on each toggle, compute completed line set; event + fireworks only for lines not in the previous set.
  - Storage wrapped in try/catch; invalid data (not an array of 25 booleans) -> fresh board; index 12 forced true.
  - Reset: clear marks except 12, persist, stop fireworks, clear canvas.

- [ ] **Step 4: Run tests, verify pass**

Run: `node tests/el-clasico-bingo.test.js`
Expected: all tests PASS, exit 0.

- [ ] **Step 5: Commit** `feat: add El Clásico Bingo game`

### Task 3: Fireworks

**Files:**
- Modify: `el-clasico-bingo/index.html`
- Modify: `tests/el-clasico-bingo.test.js`

**Interfaces:**
- Consumes: `bingo` event, `#fireworks` canvas.
- Produces: `document.body.dataset.fireworks = "running" | "idle"`.

- [ ] **Step 1: Add failing tests**
  - `fireworks run`: complete a line -> `fireworks === "running"`; after ~3.5s -> `"idle"`.
  - `reduced motion`: `page.emulateMedia({ reducedMotion: 'reduce' })`, complete a line -> `fireworks` never `"running"`; a static "BINGO!" banner element `#bingo-banner` becomes visible for ~2s instead.
  - `reset stops fireworks`: complete a line, click reset -> `"idle"` immediately.

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement** canvas particle fireworks: 4-6 rockets in red/yellow/white burst into ~60 particles each with gravity + fade, `requestAnimationFrame`, devicePixelRatio-aware, ~3s total; "BINGO!" banner (yellow, large) shown alongside; resize handler; under `prefers-reduced-motion: reduce` show banner only.

- [ ] **Step 4: Run all tests, verify pass**

Run: `node tests/el-clasico-bingo.test.js`
Expected: all PASS.

- [ ] **Step 5: Screenshot check** - Playwright screenshots at 390x844 and 844x390 into the scratchpad; inspect visually against the artifact look.

- [ ] **Step 6: Commit** `feat: add bingo fireworks`, then `git push -u origin claude/busy-brahmagupta-06c23l`.
