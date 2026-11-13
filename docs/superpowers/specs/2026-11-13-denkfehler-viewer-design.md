# Design: Denkfehler in Diskussionen, one-screen card viewer

Replaces `2026-11-13-denkfehler-design.md` (scrolling layout with buttons, light only). Issue: #5.

## Intent

- Turn `denkfehler/index.html` into a one-screen card viewer with the same concept and look as the Skandal-Quartett viewers: one card fills the screen, no page scrolling, next card by double-tap or swipe.
- Content of the 25 cards stays 1:1.

## Goals

- One-sided card with all content: category, position, name, definition, A/B example, "So sprichst du es an", Hufeisen note.
- The whole card fits the screen and scales with it; no page scroll at any size.
- Header strip in the category colour: category, position ("2 / 5" or "P wie"), round counter ("7 / 25"), share icon.
- Dark mode via `prefers-color-scheme`; safe-area insets.
- Repo rules: single self-contained `index.html`, existing CSP (zero external requests), system fonts.

## Non-goals

- No quiz, score or overview page (deep links cover sharing).
- No theme toggle; the system setting decides.
- No visible controls besides the share icon.

## Decisions (from the issue)

- Next: double-tap anywhere, swipe left, Space, Enter, ArrowRight. Back: swipe right, ArrowLeft.
- Removed: Zurück, Teilen and Nächste Karte buttons and the hint line. The gestures are described for screen readers in a visually hidden paragraph.
- Share: Web Share API, clipboard fallback, brief feedback ("Link kopiert" / "Teilen nicht möglich"), no uncaught error if both are missing. A tap on the share icon never counts toward a double-tap.
- Kept: bag without repeats over all 25 then reshuffle (never the same card twice in a row), history for back with forward replay, `#id` deep links and `hashchange`, `history.replaceState` sync, reduced motion, live region announcing the card.
- If a card does not fit, shrink the text of that card only.

## Approach

- `html, body` are `height: 100%; overflow: hidden`; `#stage` is a size container (`container: stage / size`).
- Everything is sized from one design unit, as in Quartett: `--u = min(available width / W, available height / H, 1.4px)`. Available size is the stage minus safe-area insets.
  - Portrait canvas `W x H = 360 x 640` (iPhone SE aspect): one column.
  - Landscape canvas `760 x 400` when the stage is at least 6:5 wide (`@container stage (min-aspect-ratio: 6 / 5)`): name and definition left, example and reply right, vertically centred.
  - The 1.4px cap keeps desktop text readable instead of slide-sized.
- Four text sizes in design units: 13 (labels, position, counter), 16 (header, example, note), 18 (definition, reply), 33 (name).
- When the screen is wider than the canvas, the content column is centred (`--side` padding); the header strip still spans the full width.
- Layout in portrait: name and definition on top, example box in the middle, the reply as a full-width tinted panel at the bottom. Spacers share some of the free height (each up to 48 units); the reply panel takes the rest, so tall phones show a full card instead of empty space.
- Colours: category colour `--g` on the header strip, borders and labels. Dark mode swaps the neutrals and lightens accent text with `color-mix(in srgb, var(--g) 45%, #fff)`; the reply panel uses a `color-mix` tint of the category colour. `theme-color` follows the category.
- Per-card fit step (script, after each render and on resize): first shrink the name only (`--nfit`) while a long word overflows the line, then shrink all text (`--fit`, steps of 0.03, floor 0.6) while the content overflows. With the sizes above no card needs it at 320x568, 390x844, 844x390 or 1440x900; it is a safety net for odd sizes.
- Pointer handling on the stage: `touch-action: pan-y pinch-zoom` (no double-tap zoom, pinch zoom stays). Horizontal drag of at least 50px is a swipe; two taps within 350ms and 40px are a double-tap; a press on the share icon or a second finger resets the tap state.
- Category colours unchanged: Vom Einzelfall aufs Ganze `#1D4ED8`, Ausweichen statt antworten `#C2410C`, PLURV `#047857`, Schiefe Vergleiche `#7C3AED`, Person statt Sache `#BE185D`.

## Tests

`tests/denkfehler.test.js` (Node + Playwright, same style as the other games):

- Every one of the 25 cards at 320x568, 390x844, 844x390 and 1440x900: no page scroll, no vertical or horizontal overflow of the card content, all text inside the viewport; smallest text at least 11px at 320x568 (actual: 11.5px). The run prints the smallest text size per viewport and any card that needed the fit step.
- Fit step: with enlarged text the card shrinks until it fits.
- Double-click and touch double-tap show the next card; single taps do not; taps on the share icon do not count.
- Swipe left and right; short or vertical drags do nothing.
- Keys: Space, Enter, ArrowRight, ArrowLeft; Enter on the focused share icon does not turn the card.
- History back and forward replay; 25 cards without repeat, then a new round.
- Deep link, `hashchange`, unknown hash, Hufeisen note.
- Share: Web Share API used when present; clipboard fallback with feedback; no page errors without Web Share and without or with a rejecting clipboard.
- Dark mode emulation changes background, text and accent colours.
- Slide animation only without reduced motion; no external requests.
