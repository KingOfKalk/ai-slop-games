# ai-slop-games

Simple browser games, hosted on GitHub Pages.

## Games

- [El Clásico Bingo](https://kingofkalk.github.io/ai-slop-games/el-clasico-bingo/) - `el-clasico-bingo/`
- [Bahn-Verspätungswürfel](https://kingofkalk.github.io/ai-slop-games/bahn-verspaetungs-wuerfel/) - `bahn-verspaetungs-wuerfel/`

## Adding a game

- Create a top-level folder with a self-contained `index.html`.
- Push to `main`: `.github/workflows/pages.yml` deploys every top-level folder that contains an `index.html`.
- `docs/` and `tests/` are never published.

## One-time setup

- Repo Settings > Pages > Source: **GitHub Actions**.

## Tests

```bash
node tests/el-clasico-bingo.test.js
node tests/bahn-verspaetungs-wuerfel.test.js
```
