# Benchmark Hub

A VitePress static site that lists and details trading strategy backtest results.
Deployed to GitHub Pages at `https://201508876pmh.github.io/trade-bot-site/`.

## How it works

```
Backtest bot               This repo                          GitHub Pages
─────────────────────────────────────────────────────────────────────────
freqtrade backtest  →  push .zip + .meta.json  →  GitHub Action builds & deploys
```

1. Your backtest runner pushes two files to the **`benchmarks/`** folder:
   - `backtest-result-TIMESTAMP.zip` — contains the main JSON results  
   - `backtest-result-TIMESTAMP.meta.json` — lightweight run metadata
2. The **deploy GitHub Action** automatically extracts the main JSON from the zip into
   `docs/public/benchmarks-data/` before running the VitePress build.
3. VitePress reads all JSONs at build time, generates the index list and one detail
   page per run, then deploys to GitHub Pages.

## Expected file format

### `backtest-result-TIMESTAMP.meta.json`

```json
{
  "strategy_name": {
    "run_id": "...",
    "backtest_start_time": 1779870395,
    "timeframe": "1m",
    "backtest_start_ts": 1774396800,
    "backtest_end_ts": 1779667200
  }
}
```

### `backtest-result-TIMESTAMP.zip`

Must contain a file named `backtest-result-TIMESTAMP.json` — the standard
freqtrade backtest output format with keys `strategy` and `strategy_comparison`.

The strategy object must include at minimum:

| Field | Description |
|-------|-------------|
| `strategy_name` | Display name |
| `timeframe` | e.g. `1m`, `15m` |
| `timerange` | e.g. `20260325-20260525` |
| `total_trades` | Integer |
| `winrate` | Float 0–1 |
| `profit_total` | Float fraction (multiply × 100 for %) |
| `profit_total_abs` | USDT P&L |
| `sharpe` / `sortino` / `calmar` | Ratios |
| `max_drawdown_account` | Float fraction |
| `holding_avg` | Duration string |
| `backtest_run_end_ts` | Unix timestamp of the run |
| `results_per_pair` | Array of per-pair stats |
| `results_per_enter_tag` | Array of per-tag stats |
| `exit_reason_summary` | Array of exit-reason stats |

## Local development

```bash
npm install
npm run docs:dev    # dev server at http://localhost:5173/trade-bot-site/
npm run docs:build  # production build → docs/.vitepress/dist/
npm run docs:preview
```

To test locally with an actual backtest result:

```bash
# Extract the JSON from a zip first
unzip -p backtest-result-TIMESTAMP.zip backtest-result-TIMESTAMP.json \
  > docs/public/benchmarks-data/backtest-result-TIMESTAMP.json

npm run docs:build
```

## Debug mode

```bash
npm run docs:dev -- --debug
DEBUG=vite:* npm run docs:dev
```
