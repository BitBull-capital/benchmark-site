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
  /** Composite quality score 0–100 (0 = failed deal breaker) */
  score: number
  /** Letter grade derived from score: A+/A/A-/B+/B/B-/C/D/F */
  grade: string
  /** HyroTrader 2-step challenge outcome: 'yes' = funded & stable, 'partial' = funded then busted, 'no' = never funded */
  fundable: 'yes' | 'partial' | 'no'
}

// ── Scoring system ────────────────────────────────────────────────────────────
// Weights must sum to 1.0
const SCORE_WEIGHTS = { sharpe: 0.40, profit: 0.30, drawdown: 0.30 }
// Anchors: [lower (worst acceptable → score 0), upper (excellent cap → score 100)]
// Values outside the range are clamped (no bonus above upper, no penalty below lower).
const SCORE_ANCHORS = {
  sharpe:   { lower: 0.5, upper: 2.5 },
  profit:   { lower: 0.0, upper: 0.5 },   // raw fractions; 50 % return caps at 100
  drawdown: { lower: 0.25, upper: 0.05 }, // raw fraction; lower=worse (25 % bad, 5 % excellent)
}
const DEAL_BREAKERS = { minTrades: 30, maxDrawdown: 0.50 }

function normalize(value: number, lower: number, upper: number, inverse: boolean): number {
  if (inverse) {
    // Higher value = worse (e.g. drawdown): map [lower..upper] → [0..100]
    const clamped = Math.max(upper, Math.min(lower, value))
    return ((lower - clamped) / (lower - upper)) * 100
  }
  const clamped = Math.max(lower, Math.min(upper, value))
  return ((clamped - lower) / (upper - lower)) * 100
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'S+'
  if (score >= 80) return 'S'
  if (score >= 65) return 'A'
  if (score >= 50) return 'B'
  if (score >= 35) return 'C'
  if (score >= 20) return 'D'
  return 'E'
}

function calcScore(totalTrades: number, profitFraction: number, sharpe: number, drawdownFraction: number): { score: number; grade: string } {
  if (totalTrades < DEAL_BREAKERS.minTrades || drawdownFraction > DEAL_BREAKERS.maxDrawdown) {
    return { score: 0, grade: 'F' }
  }
  const sharpeScore    = normalize(sharpe, SCORE_ANCHORS.sharpe.lower, SCORE_ANCHORS.sharpe.upper, false)
  const profitScore    = normalize(profitFraction, SCORE_ANCHORS.profit.lower, SCORE_ANCHORS.profit.upper, false)
  const drawdownScore  = normalize(drawdownFraction, SCORE_ANCHORS.drawdown.lower, SCORE_ANCHORS.drawdown.upper, true)
  const score = sharpeScore * SCORE_WEIGHTS.sharpe
             + profitScore  * SCORE_WEIGHTS.profit
             + drawdownScore * SCORE_WEIGHTS.drawdown
  return { score: +score.toFixed(1), grade: scoreToGrade(score) }
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

// ── HyroTrader fundability check ─────────────────────────────────────────────
const HYDRO = { phase1Target: 0.10, phase2Target: 0.05, maxDailyLoss: 0.05, maxTotalLoss: 0.10, phase1MinDays: 10, phase2MinDays: 5 }

function calcFundable(trades: any[], initBal: number): 'yes' | 'partial' | 'no' {
  if (!initBal || !trades?.length) return 'no'
  const closed = trades.filter((t: any) => !t.is_open)
  if (!closed.length) return 'no'

  const dayMap = new Map<string, number>()
  for (const t of closed) {
    const ts = t.close_timestamp
    const d = new Date(ts > 1e10 ? ts : ts * 1000).toISOString().slice(0, 10)
    dayMap.set(d, (dayMap.get(d) ?? 0) + (t.profit_abs ?? 0))
  }
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))

  let bal = initBal, phaseStartBal = initBal, phasePnl = 0, tradingDays = 0
  let phase: 'phase1' | 'phase2' | 'funded' | 'busted' = 'phase1'
  let reachedFunded = false

  for (const [, pnlAbs] of days) {
    const pnlPct = pnlAbs / initBal
    bal += pnlAbs
    const lossFromInit = Math.max(0, (initBal - bal) / initBal)

    if (phase !== 'busted') {
      if (pnlPct < -HYDRO.maxDailyLoss || lossFromInit > HYDRO.maxTotalLoss) { phase = 'busted'; break }
    }

    if (pnlAbs !== 0) tradingDays++
    phasePnl += pnlAbs

    if (phase === 'phase1' && phasePnl / phaseStartBal >= HYDRO.phase1Target && tradingDays >= HYDRO.phase1MinDays) {
      phase = 'phase2'; phaseStartBal = bal; phasePnl = 0; tradingDays = 0
    } else if (phase === 'phase2' && phasePnl / phaseStartBal >= HYDRO.phase2Target && tradingDays >= HYDRO.phase2MinDays) {
      reachedFunded = true
      phase = 'funded'; phaseStartBal = bal; phasePnl = 0; tradingDays = 0
    }
  }
  if (phase === 'funded') return 'yes'
  if (reachedFunded) return 'partial'
  return 'no'
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

          const { score, grade } = calcScore(
            s.total_trades ?? 0,
            s.profit_total ?? 0,
            s.sharpe ?? 0,
            s.max_drawdown_account ?? 0,
          )

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
            score,
            grade,
            fundable: calcFundable(s.trades, s.starting_balance ?? 0),
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
