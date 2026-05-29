import { readdirSync, readFileSync } from 'fs'
import path from 'path'

/**
 * Build-time data loader.
 * Reads all backtest result JSONs from docs/public/benchmarks-data/
 * and returns a lightweight summary list for the index page.
 */

export interface BenchmarkSummary {
  /** filename without extension — used as the route param */
  id: string
  strategy: string
  timeframe: string
  timerange: string
  /** ISO date string (YYYY-MM-DD) of when the run completed */
  date: string
  totalTrades: number
  winRate: number      // 0–100 percentage
  profit: number       // percentage (can be negative)
  profitUsdt: number   // absolute USDT P&L
  sharpe: number
  sortino: number
  calmar: number
  maxDrawdown: number  // negative percentage, e.g. -35.5
  avgDuration: string
  startingBalance: number
  finalBalance: number
  backtestDays: number
  /** Downsampled equity curve: ~20 cumulative balance values, oldest→newest */
  equityCurve: number[]
}

export declare const data: BenchmarkSummary[]

/** Downsample a full equity curve to at most `n` evenly-spaced points */
function downsample(curve: number[], n = 20): number[] {
  if (curve.length <= n) return curve
  const result: number[] = []
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (curve.length - 1))
    result.push(+curve[idx].toFixed(2))
  }
  return result
}

/** Build a cumulative balance curve from raw trades */
function buildEquityCurve(trades: any[], startingBalance: number): number[] {
  const closed = (trades ?? [])
    .filter((t: any) => !t.is_open)
    .sort((a: any, b: any) => a.close_timestamp - b.close_timestamp)
  if (!closed.length) return [startingBalance]
  let bal = startingBalance
  const curve: number[] = [bal]
  for (const t of closed) {
    bal += t.profit_abs
    curve.push(bal)
  }
  return downsample(curve)
}

export default {
  load(): BenchmarkSummary[] {
    const dataDir = path.resolve(__dirname, 'public/benchmarks-data')

    let files: string[]
    try {
      files = readdirSync(dataDir).filter(
        f => f.match(/^backtest-result.*\.json$/) && !f.includes('_config')
      )
    } catch {
      // Directory doesn't exist yet (fresh clone before first run)
      return []
    }

    const results: BenchmarkSummary[] = []

    for (const file of files) {
      try {
        const raw = readFileSync(path.join(dataDir, file), 'utf-8')
        const data = JSON.parse(raw)

        for (const [, strat] of Object.entries(data.strategy ?? {})) {
          const s = strat as Record<string, any>

          // Derive the run date from the backtest_run_end_ts unix timestamp,
          // or fall back to the timestamp in the filename
          let date = ''
          if (s.backtest_run_end_ts) {
            date = new Date(s.backtest_run_end_ts * 1000).toISOString().split('T')[0]
          } else {
            const m = file.match(/(\d{4}-\d{2}-\d{2})/)
            date = m ? m[1] : ''
          }

          results.push({
            id: file.replace('.json', ''),
            strategy: s.strategy_name ?? 'Unknown',
            timeframe: s.timeframe ?? '?',
            timerange: s.timerange ?? '',
            date,
            totalTrades: s.total_trades ?? 0,
            winRate: +(s.winrate * 100).toFixed(2),
            profit: +(s.profit_total * 100).toFixed(2),
            profitUsdt: +(s.profit_total_abs ?? 0).toFixed(2),
            sharpe: +(s.sharpe ?? 0).toFixed(2),
            sortino: +(s.sortino ?? 0).toFixed(2),
            calmar: +(s.calmar ?? 0).toFixed(2),
            maxDrawdown: +(-(s.max_drawdown_account ?? 0) * 100).toFixed(2),
            avgDuration: s.holding_avg ?? '',
            startingBalance: s.starting_balance ?? 0,
            finalBalance: s.final_balance ?? 0,
            backtestDays: s.backtest_days ?? 0,
            equityCurve: buildEquityCurve(s.trades, s.starting_balance ?? 0),
          })
        }
      } catch (e) {
        console.warn(`[benchmarks.data] Failed to parse ${file}:`, e)
      }
    }

    // Newest first
    return results.sort((a, b) => b.date.localeCompare(a.date))
  }
}
