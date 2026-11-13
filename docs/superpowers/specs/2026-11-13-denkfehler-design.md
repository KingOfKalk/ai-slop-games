# Design: Denkfehler in Diskussionen

## Intent

- Third page for the Pages site: the 25 cards from the "Denkfehler in Diskussionen" canvas (https://claude.ai/artifact/4z2J7iBKMNwwRxEFbizLcV) as a random card deck in `denkfehler/index.html`.
- Not a game: meant to make people think, viewed on a phone, one random card after another.

## Goals

- Card content 1:1 with the canvas: category, position, name, definition, A/B example, "So sprichst du es an". Hufeisen card keeps its extra note.
- Repo rules: single self-contained `index.html`, zero external requests (CSP), system fonts, mobile first.
- Visual: light theme only, white background, one font family, three sizes, 4px radius, category colors from the canvas.

## Non-goals

- No quiz, score or bingo.
- No overview page of all 25 cards (deep links cover sharing).
- No dark theme.

## Behaviour

- Start: random card, or the card named in the URL hash (`#strohmann`). Unknown hash: random card.
- Next: button, swipe left, ArrowRight or Space. Draws from a bag without repeats until all 25 were shown, then reshuffles (never the same card twice in a row).
- Back: button, swipe right or ArrowLeft. Walks a history; Next replays forward history before drawing new cards.
- Hash is kept in sync with the current card (`history.replaceState`), `hashchange` opens the named card.
- Counter "n / 25" for the current round.
- Share: Web Share API with clipboard fallback, no uncaught error if both are missing.
- Reduced motion: no slide animation.

## Category colors

- Vom Einzelfall aufs Ganze `#1D4ED8`, Ausweichen statt antworten `#C2410C`, PLURV `#047857`, Schiefe Vergleiche `#7C3AED`, Person statt Sache `#BE185D`.

## Tests

- `tests/denkfehler.test.js` (Playwright, same style as the other games): initial card, 25 without repeat plus new round, back/forward history, deep link and `hashchange`, unknown hash, Hufeisen note, swipe, share fallback, no external requests, no horizontal scroll at 320x568 / 390x844 / 844x390 / 1440x900 for every card.
