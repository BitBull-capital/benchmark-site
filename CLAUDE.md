# trade-bot-site — Claude context

## What this project is
A **VitePress static site** that acts as a benchmark results dashboard for freqtrade backtests.
The site is hosted on **GitHub Pages** at `/<repo>/trade-bot-site/`.
It is aimed at developers — the UI uses tables, JSON viewers, and mono fonts throughout.

---

## How backtest data flows in

1. A freqtrade backtest produces a **`.zip`** (containing the JSON result) and a **`.meta.json`** file.
2. These are pushed into `benchmarks/` in the repo root (e.g. `backtest-result-2026-05-27_08-32-28.zip`).
3. `npm run prepare-data` (also wired into `docs:dev` and `docs:build`) extracts the main JSON from each zip into `docs/public/benchmarks-data/*.json`, making them static assets.
4. At build time, `docs/benchmarks.data.ts` reads those JSONs and produces a flat `BenchmarkSummary[]` used by the index page.
5. On the detail page, the JSON is fetched at runtime via `withBase('/benchmarks-data/{id}.json')` in `onMounted`.

```
benchmarks/*.zip  →  prepare-data script  →  docs/public/benchmarks-data/*.json
                                                    ↓                     ↓
                                         benchmarks.data.ts        detail page fetch
                                         (build-time index)        (runtime detail)
```

---

## Key files

| File | Role |
|---|---|
| `docs/.vitepress/config.mts` | VitePress config. `base: '/trade-bot-site/'`, `cleanUrls: true`, `title: "Benchmark Hub"` |
| `docs/.vitepress/theme/index.ts` | Registers 5 global components: `BenchmarkList`, `BenchmarkMeta`, `BenchmarkDetail`, `CoinIcon`, `PairSymbol` |
| `docs/.vitepress/theme/custom.css` | Global CSS: max-width 1600px layout, semantic colour tokens (`--bd-*`), 6-tier rating scale |
| `docs/benchmarks.data.ts` | Build-time data loader. Returns `BenchmarkSummary[]` sorted by profit descending |
| `docs/benchmarks/[id].paths.ts` | Dynamic route params — one path per JSON file in `benchmarks-data/` |
| `docs/benchmarks/[id].md` | Detail page. `layout: page`. Fetches full JSON at runtime, renders `<BenchmarkDetail>` |
| `docs/index.md` | Index page. `layout: page`. Uses `<BenchmarkList :benchmarks="benchmarks" />` |
| `benchmarks/` | Upload target for `.zip` + `.meta.json` pairs from the trading bot CI |

---

## Vue components

### `BenchmarkList.vue`
Index table. Props: `BenchmarkSummary[]`.
- Search input + timeframe filter
- Sortable columns (default: profit % descending)
- Profit text coloured green/red via `--bd-positive` / `--bd-negative` (no background pill)
- Row click → `router.go(withBase('/benchmarks/${id}'))`

### `BenchmarkDetail.vue`
Full detail page. Props: `{ data: StrategyData }`.

Three sections in order:
1. **Backtest Config** — foldable `<details>` showing strategy config as syntax-highlighted JSON (`backtest.config.json`)
2. **Performance Metrics** — table with columns: Metric | What it means | Thresholds | Value. Values colour-coded by a 6-tier system (bad→ok→good→excellent→extraordinary→legendary)
3. **Data tables** — Results per Pair (with row numbers + `PairSymbol` icons), Enter Tag Stats, Exit Reason Stats. Each table has independent sort state via `useTableSort()`.

### `CoinIcon.vue`
Loads `/coins/{SYMBOL}.svg` from `docs/public/coins/` (484 SVGs copied from trade-journal repo).
Falls back to a coloured circle if the SVG is missing (e.g. TAO).

### `PairSymbol.vue`
Parses `BTC/USDT:USDT` → `{ base: 'BTC', quote: 'USDT' }`. Strips `:USDT` futures suffix.
Stacks two `CoinIcon`s with `-6px` overlap. Pair label is plain mono text (no brand colour).

---

## Colour system (`custom.css`)

```css
/* Binary positive/negative (tables, list) */
--bd-positive / --bd-positive-bg
--bd-negative / --bd-negative-bg

/* 6-tier rating (metrics table value column) */
--bd-tier-bad           → red
--bd-tier-ok            → amber  (shown in neutral text colour in threshold chips)
--bd-tier-good          → green
--bd-tier-excellent     → blue
--bd-tier-extraordinary → purple
--bd-tier-legendary     → orange
```

Dark mode overrides all tokens to lighter, more readable shades.

### Tier thresholds (in `BenchmarkDetail.vue`)
```ts
const METRIC_SCALES = {
  sharpe:       [-∞, 0.5,  1.0,  1.5,  2.0,  3.0],
  sortino:      [-∞, 0.5,  1.0,  2.0,  3.0,  5.0],
  calmar:       [-∞, 0.2,  0.5,  1.0,  2.0,  4.0],
  totalProfit:  [-∞, 0.05, 0.20, 0.50, 1.00, 2.00],  // fractions
  cagr:         [-∞, 0.05, 0.15, 0.30, 0.50, 1.00],
  winrate:      [-∞, 0.45, 0.55, 0.65, 0.75, 0.80],
  drawdown:     [-∞,-0.30,-0.20,-0.10,-0.05,-0.02],   // pass negated max_dd_account
  profitFactor: [-∞, 1.1,  1.3,  1.5,  2.0,  3.0],
  expectancy:   [-∞, 1,    5,    15,   30,   50  ],
}
```

---

## Important VitePress gotchas

- **`withBase()`** is required for ALL internal navigation and asset URLs because `base: '/trade-bot-site/'`. Without it, links 404 on GitHub Pages.
  - Navigation: `router.go(withBase('/benchmarks/${id}'))`
  - Fetch: `withBase('/benchmarks-data/${id}.json')`
  - Coin icons: `withBase('/coins/${symbol}.svg')`
- **`layout: page`** is used on both pages (not `layout: doc`). `layout: doc` limits content width to ~752px. `layout: page` requires manual padding — done via `.VPPage` in `custom.css`.
- **CSS specificity**: `.table-wrap td.positive` is needed (not just `.positive`) to beat the `.table-wrap td { color: var(--vp-c-text-1) }` rule.
- **Data loader shape**: `benchmarks.data.ts` returns a flat array (`BenchmarkSummary[]`), NOT the `{ url, frontmatter }` shape that `createContentLoader` uses.

---

## freqtrade JSON field notes

All values are raw fractions unless stated:
- `profit_total`: fraction → multiply ×100 for %
- `winrate`: fraction → multiply ×100 for %
- `max_drawdown_account`: positive fraction (e.g. 0.15 = 15% drawdown)
- `cagr`, `stoploss`, `trailing_stop_positive`: fractions
- `holding_avg`, `winner_holding_avg` etc.: Python `timedelta` strings like `"0:40:00"` or `"1 day, 2:30:00"` — parsed by `formatDuration()` in `BenchmarkDetail.vue`
- `backtest_days`: integer, used by `formatPeriod()` to render e.g. `(2m 1d)` next to the timerange badge
- `pairlist`: string array of pair names like `"BTC/USDT:USDT"`

---

## Local development

```bash
npm run docs:dev      # extracts zips + starts dev server
npm run docs:build    # extracts zips + builds static site
npm run docs:preview  # preview the built site
```

Coin SVGs live in `docs/public/coins/` — copied from `/Users/pm.hoveling/trade-journal/public/coins/`.
If a symbol has no SVG (e.g. TAO), `CoinIcon.vue` renders a coloured circle fallback.

---

## Deployment

Push to `master` → GitHub Actions builds and deploys to GitHub Pages automatically.
The workflow extracts JSONs from zips before running `vitepress build`.
