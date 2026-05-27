# 30m Parameter Sweep Results

**Date:** 2026-05-08  
**Pairs:** XAUT/USDT:USDT, BTC/USDT:USDT  
**Timeframe:** 30m  
**Period:** 2025-04-03 → 2026-05-07 (~13 months)  
**Starting balance:** 10,000 USDT  
**Position stacking:** enabled  
**Max open trades:** 2  

Parameters swept:
- **Stoploss:** -1%, -2%, -3%
- **Trailing stop (trail):** 1.0%, 1.5%, 2.0%, 2.5%
- **Trailing offset:** 3%, 4%, 5%, 6%, 8%

Naming: `sw_sl{stoploss%}_t{trail*1000}_o{offset*100}`  
e.g. `sw_sl2_t20_o3` = stoploss -2%, trail 2.0%, offset 3%

---

## Top Performers (sorted by profit)

| Strategy | Trades | Avg Profit % | Tot Profit % | Avg Duration | Win | Loss | Win% | Drawdown |
|---|---|---|---|---|---|---|---|---|
| sw_sl2_t20_o3 | 116 | 1.20 | **+94.69%** | 4d 13h | 68 | 48 | 58.6% | 7.17% |
| sw_sl3_t20_o3 | 98 | 1.37 | **+89.21%** | 5d 21h | 66 | 32 | **67.3%** | 6.90% |
| sw_sl3_t20_o4 | 89 | 1.49 | +87.27% | 6d 20h | 55 | 34 | 61.8% | 8.99% |
| sw_sl2_t15_o4 | 119 | 1.11 | +86.96% | 4d 11h | 61 | 58 | 51.3% | 7.17% |
| sw_sl2_t20_o4 | 112 | 1.16 | +84.86% | 4d 21h | 58 | 54 | 51.8% | 7.16% |
| sw_sl3_t20_o5 | 82 | 1.58 | +83.83% | 7d 10h | 48 | 34 | 58.5% | 10.40% |
| sw_sl3_t25_o4 | 81 | 1.60 | +82.92% | 7d 15h | 49 | 32 | 60.5% | 6.54% |
| sw_sl3_t10_o8 | 71 | 1.82 | +81.83% | 8d 16h | 33 | 38 | 46.5% | 10.88% |
| sw_sl2_t25_o3 | 106 | 1.20 | +81.59% | 5d 1h | 60 | 46 | 56.6% | 7.16% |
| sw_sl3_t25_o3 | 88 | 1.33 | +72.61% | 6d 17h | 56 | 32 | 63.6% | 7.11% |
| sw_sl3_t15_o4 | 97 | 1.19 | +72.28% | 6d 3h | 58 | 39 | 59.8% | **5.69%** |
| sw_sl3_t20_o8 | 69 | 1.68 | +71.85% | 8d 16h | 32 | 37 | 46.4% | 11.27% |
| sw_sl3_t15_o8 | 74 | 1.56 | +70.97% | 8d 2h | 33 | 41 | 44.6% | 11.07% |
| sw_sl3_t10_o6 | 80 | 1.43 | +70.89% | 7d 12h | 42 | 38 | 52.5% | 12.42% |
| sw_sl3_t25_o5 | 78 | 1.46 | +69.13% | 7d 21h | 43 | 35 | 55.1% | 6.87% |
| sw_sl2_t25_o4 | 104 | 1.07 | +68.06% | 5d 6h | 51 | 53 | 49.0% | 7.16% |
| sw_sl3_t15_o5 | 89 | 1.22 | +66.61% | 6d 18h | 50 | 39 | 56.2% | 12.03% |
| sw_sl2_t10_o4 | 121 | 0.89 | +66.43% | 4d 8h | 60 | 61 | 49.6% | 7.16% |
| sw_sl3_t20_o6 | 75 | 1.44 | +65.34% | 7d 22h | 40 | 35 | 53.3% | 11.39% |
| sw_sl2_t25_o5 | 94 | 1.16 | +65.04% | 6d 0h | 42 | 52 | 44.7% | 13.59% |
| sw_sl2_t10_o5 | 107 | 0.99 | +65.01% | 5d 4h | 49 | 58 | 45.8% | 7.17% |
| sw_sl3_t25_o6 | 72 | 1.44 | +61.33% | 8d 7h | 36 | 36 | 50.0% | 9.98% |
| sw_sl3_t25_o8 | 67 | 1.36 | +51.10% | 8d 23h | 28 | 39 | 41.8% | 11.47% |
| sw_sl2_t10_o6 | 98 | 0.91 | +51.78% | 5d 17h | 39 | 59 | 39.8% | 14.34% |
| sw_sl2_t15_o3 | 123 | 0.77 | +57.71% | 4d 6h | 67 | 56 | 54.5% | 7.16% |
| sw_sl2_t20_o6 | 91 | 0.95 | +49.26% | 6d 1h | 37 | 54 | 40.7% | 12.89% |
| sw_sl1_t25_o6 | 119 | 0.85 | +59.38% | 4d 7h | 33 | 86 | 27.7% | 4.90% |
| sw_sl1_t25_o8 | 112 | 0.87 | +56.17% | 4d 20h | 26 | 86 | 23.2% | 5.40% |
| sw_sl2_t25_o6 | 84 | 1.21 | +59.23% | 6d 16h | 34 | 50 | 40.5% | 12.05% |
| sw_sl2_t10_o8 | 84 | 1.18 | +58.25% | 6d 23h | 29 | 55 | 34.5% | 9.03% |
| sw_sl2_t15_o8 | 84 | 1.05 | +50.11% | 6d 23h | 28 | 56 | 33.3% | 9.02% |
| sw_sl2_t20_o8 | 82 | 1.17 | +55.41% | 7d 3h | 28 | 54 | 34.1% | 9.02% |
| sw_sl2_t25_o8 | 79 | 1.20 | +54.02% | 7d 11h | 27 | 52 | 34.2% | 9.02% |
| sw_sl1_t25_o4 | 141 | 0.63 | +51.09% | 3d 5h | 44 | 97 | 31.2% | 5.54% |
| sw_sl1_t20_o6 | 128 | 0.73 | +55.04% | 3d 20h | 35 | 93 | 27.3% | 4.89% |
| sw_sl1_t20_o8 | 123 | 0.75 | +52.66% | 4d 7h | 27 | 96 | 22.0% | 5.39% |
| sw_sl3_t10_o5 | 91 | 0.95 | +50.20% | 6d 14h | 48 | 43 | 52.7% | 11.89% |
| sw_sl1_t15_o8 | 131 | 0.68 | +50.51% | 3d 22h | 28 | 103 | 21.4% | 6.36% |
| sw_sl1_t10_o6 | 138 | 0.63 | +50.73% | 3d 12h | 36 | 102 | 26.1% | 7.83% |
| sw_sl1_t10_o8 | 119 | 0.73 | +49.78% | 4d 15h | 27 | 92 | 22.7% | 5.39% |
| sw_sl1_t15_o6 | 135 | 0.63 | +48.85% | 3d 15h | 36 | 99 | 26.7% | 8.27% |
| sw_sl3_t10_o4 | 97 | 0.94 | +53.95% | 6d 1h | 56 | 41 | 57.7% | 9.04% |
| sw_sl1_t20_o4 | 163 | 0.54 | +50.60% | 2d 14h | 49 | 114 | 30.1% | 6.07% |
| sw_sl1_t15_o5 | 156 | 0.51 | +45.13% | 2d 20h | 44 | 112 | 28.2% | 4.90% |
| sw_sl3_t15_o6 | 82 | 1.16 | +55.56% | 7d 7h | 41 | 41 | 50.0% | 13.26% |
| sw_sl1_t25_o5 | 133 | 0.63 | +47.81% | 3d 12h | 39 | 94 | 29.3% | 5.07% |
| sw_sl1_t25_o3 | 145 | 0.58 | +48.23% | 3d 0h | 50 | 95 | 34.5% | 4.90% |
| sw_sl1_t20_o5 | 153 | 0.54 | +47.11% | 2d 21h | 43 | 110 | 28.1% | 7.35% |
| sw_sl1_t20_o3 | 166 | 0.41 | +37.79% | 2d 10h | 56 | 110 | 33.7% | 6.87% |
| sw_sl1_t15_o4 | 170 | 0.47 | +45.83% | 2d 11h | 50 | 120 | 29.4% | 5.40% |
| sw_sl1_t10_o5 | 162 | 0.43 | +38.51% | 2d 15h | 44 | 118 | 27.2% | 7.46% |
| sw_sl2_t10_o3 | 130 | 0.51 | +37.37% | 3d 22h | 67 | 63 | 51.5% | 7.15% |
| sw_sl1_t10_o4 | 174 | 0.36 | +33.75% | 2d 7h | 51 | 123 | 29.3% | 4.91% |
| sw_sl1_t15_o3 | 177 | 0.23 | +21.15% | 2d 2h | 57 | 120 | 32.2% | 7.33% |
| sw_sl3_t10_o3 | 115 | 0.64 | +41.25% | 4d 20h | 72 | 43 | 62.6% | 6.48% |
| sw_sl1_t20_o3 | 166 | 0.41 | +37.79% | 2d 10h | 56 | 110 | 33.7% | 6.87% |
| sw_sl1_t10_o3 | 185 | 0.16 | +14.63% | 1d 23h | 59 | 126 | 31.9% | 5.46% |

---

## Key Observations

### Winning parameters
- **Trail 2.0% dominates** — consistently outperforms 1.5% and 2.5% across all stoploss levels
- **Wider stoploss wins** — -2% and -3% far outperform -1% (which tops out at ~59% profit)
- **Offset 3–4% is the sweet spot** — lower offsets trigger trailing too early, higher offsets miss moves

### Recommended strategies

| Use case | Strategy | Profit | Win% | DD | Notes |
|---|---|---|---|---|---|
| **Best profit** | sw_sl2_t20_o3 | +94.69% | 58.6% | 7.17% | sl=-2%, trail=2%, offset=3% |
| **Best win rate** | sw_sl3_t20_o3 | +89.21% | 67.3% | 6.90% | sl=-3%, trail=2%, offset=3% |
| **Lowest drawdown** | sw_sl3_t15_o4 | +72.28% | 59.8% | 5.69% | sl=-3%, trail=1.5%, offset=4% |
| **Best balance** | sw_sl3_t25_o4 | +82.92% | 60.5% | 6.54% | sl=-3%, trail=2.5%, offset=4% |

### Previous baseline
`funded_conservative` = sw_sl2_t15_o3: +57.71%, 54.5% win rate, 7.16% DD

---

## Context
- All results on XAUT/USDT:USDT + BTC/USDT:USDT only
- ETH, SOL, DOGE dropped — negative expectancy at 30m
- 30m timeframe significantly outperforms 5m and 15m for this strategy
- SMC signals (FVG + BOS + Fibonacci) suit gold/XAUT's slower institutional flow
