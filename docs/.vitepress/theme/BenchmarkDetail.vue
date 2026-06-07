<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, withBase, useData } from 'vitepress'
import EquityCurve from './EquityCurve.vue'
import { useCurrency } from './useCurrency'

interface Trade {
  close_timestamp: number
  profit_abs: number
  is_open: boolean
  is_short: boolean
  trade_duration: number   // minutes
}

interface ResultRow {
  key: string
  trades: number
  profit_mean_pct: number
  profit_total_pct: number
  profit_total_abs: number
  duration_avg: string
  wins: number
  draws: number
  losses: number
  winrate: number
}

interface StrategyData {
  strategy_name: string
  timeframe: string
  timerange: string
  backtest_start: string
  backtest_end: string
  backtest_run_end_ts: number
  total_trades: number
  winrate: number
  profit_total: number
  profit_total_abs: number
  sharpe: number
  sortino: number
  calmar: number
  sqn: number
  profit_factor: number
  max_drawdown_account: number
  max_drawdown_abs: number
  holding_avg: string
  starting_balance: number
  final_balance: number
  trades_per_day: number
  cagr: number
  expectancy: number
  expectancy_ratio: number
  backtest_best_day: number
  backtest_worst_day: number
  wins: number
  losses: number
  draws: number
  backtest_days: number
  max_consecutive_wins: number
  max_consecutive_losses: number
  winning_days: number
  losing_days: number
  draw_days: number
  winner_holding_avg: string
  loser_holding_avg: string
  drawdown_duration: string
  market_change: number
  trades: Trade[]
  results_per_pair: ResultRow[]
  results_per_enter_tag: ResultRow[]
  exit_reason_summary: ResultRow[]
  // Long / short breakdown (futures only)
  trade_count_long: number
  trade_count_short: number
  profit_total_long: number
  profit_total_long_abs: number
  profit_total_short: number
  profit_total_short_abs: number
  trading_mode: string
  // Periodic breakdown
  periodic_breakdown?: {
    month?: Array<{
      date: string        // "DD/MM/YYYY"
      date_ts: number
      profit_abs: number
      wins: number
      draws: number
      losses: number
      trades: number
      profit_factor: number
    }>
  }
  // Config fields
  pairlist: string[]
  stake_amount: number | string
  stake_currency: string
  max_open_trades: number
  stoploss: number
  use_custom_stoploss: boolean
  trailing_stop: boolean
  trailing_stop_positive: number | null
  trailing_stop_positive_offset: number
  trailing_only_offset_is_reached: boolean
  margin_mode: string
  minimal_roi: Record<string, number>
}

const props = defineProps<{ data: StrategyData; medal?: 0 | 1 | 2; benchmarkId?: string }>()
const router = useRouter()
const { isDark } = useData()
const { currency, toggle: toggleCurrency, fmtAbs, fmtBalance } = useCurrency()

const s = computed(() => props.data)

// ── Reusable per-table sort state ─────────────────────
function useTableSort(defaultKey: keyof ResultRow = 'trades') {
  const sortKey = ref<keyof ResultRow>(defaultKey)
  const sortDir = ref<1 | -1>(-1)

  function toggle(key: keyof ResultRow) {
    if (sortKey.value === key) sortDir.value = sortDir.value === -1 ? 1 : -1
    else { sortKey.value = key; sortDir.value = -1 }
  }

  function icon(key: keyof ResultRow) {
    if (sortKey.value !== key) return '↕'
    return sortDir.value === -1 ? '↓' : '↑'
  }

  function sort(rows: ResultRow[]) {
    return [...rows].sort((a, b) => {
      const va = a[sortKey.value] as any
      const vb = b[sortKey.value] as any
      if (va == null) return 1
      if (vb == null) return -1
      if (va < vb) return -1 * sortDir.value
      if (va > vb) return 1 * sortDir.value
      return 0
    })
  }

  return { sortKey, sortDir, toggle, icon, sort }
}

const pairSort    = useTableSort('trades')
const enterSort   = useTableSort('trades')
const exitSort    = useTableSort('trades')

const pairRows = computed(() =>
  pairSort.sort((s.value.results_per_pair ?? []).filter(r => r.key !== 'TOTAL' && r.key !== ''))
)

const enterTagRows = computed(() =>
  enterSort.sort((s.value.results_per_enter_tag ?? []).filter(r => r.key !== 'TOTAL' && r.key !== ''))
)

const exitReasonRows = computed(() =>
  exitSort.sort((s.value.exit_reason_summary ?? []).filter(r => r.key !== 'TOTAL' && r.key !== ''))
)

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const fmtMoney = (v: number) =>
  (v >= 0 ? '+' : '') + v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const formatTransitionDate = (iso: string) => {
  const [yr, mo, dy] = iso.split('-')
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(dy, 10)}, ${yr}`
}


function parseMonthLabel(date: string): string {
  // date is "DD/MM/YYYY"
  const parts = date.split('/')
  if (parts.length !== 3) return date
  const mo = parseInt(parts[1], 10) - 1
  const yr = parts[2]
  return `${MONTH_NAMES[mo] ?? parts[1]} ${yr}`
}

const monthRows = computed(() => s.value.periodic_breakdown?.month ?? [])

const monthYearOrder = computed(() => {
  const seen: string[] = []
  for (const r of monthRows.value) {
    const yr = r.date.slice(-4)
    if (!seen.includes(yr)) seen.push(yr)
  }
  return seen
})

const monthBarMax = computed(() => {
  const rows = monthRows.value
  if (!rows.length) return 1
  return Math.max(...rows.map(r => Math.abs(r.profit_abs)), 1)
})

function monthBarWidth(profit_abs: number): number {
  return Math.min(100, Math.round((Math.abs(profit_abs) / monthBarMax.value) * 100))
}

// ── Long / Short breakdown ────────────────────────────
function formatMinutes(mins: number): string {
  if (!mins) return '—'
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = Math.floor(mins % 60)
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m && d < 1) parts.push(`${m}m`)
  return parts.length ? parts.join(' ') : '< 1m'
}

const longShortStats = computed(() => {
  const closed = (s.value.trades ?? []).filter(t => !t.is_open)
  const longs  = closed.filter(t => !t.is_short)
  const shorts = closed.filter(t =>  t.is_short)

  const wins = (arr: Trade[]) => arr.filter(t => t.profit_abs > 0).length
  const avgDur = (arr: Trade[]) =>
    arr.length ? arr.reduce((sum, t) => sum + (t.trade_duration ?? 0), 0) / arr.length : 0

  return {
    hasShorts: (s.value.trade_count_short ?? 0) > 0,
    rows: [
      {
        dir: 'Long',
        icon: '📈',
        trades:    longs.length,
        wins:      wins(longs),
        losses:    longs.length - wins(longs),
        winrate:   longs.length ? wins(longs) / longs.length : 0,
        profitPct: (s.value.profit_total_long ?? 0) * 100,
        profitAbs:  s.value.profit_total_long_abs ?? 0,
        avgDurMins: avgDur(longs),
      },
      {
        dir: 'Short',
        icon: '📉',
        trades:    shorts.length,
        wins:      wins(shorts),
        losses:    shorts.length - wins(shorts),
        winrate:   shorts.length ? wins(shorts) / shorts.length : 0,
        profitPct: (s.value.profit_total_short ?? 0) * 100,
        profitAbs:  s.value.profit_total_short_abs ?? 0,
        avgDurMins: avgDur(shorts),
      },
    ],
  }
})

function pct(v: number, decimals = 2) {
  if (v === undefined || v === null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(decimals) + '%'
}

function num(v: number, decimals = 2) {
  if (v === undefined || v === null) return '—'
  if (!isFinite(v)) return '∞'
  return v.toFixed(decimals)
}

function abs(v: number) {
  if (v === undefined || v === null) return '—'
  return fmtAbs(v)
}

function pc(v: number) { return pct(v * 100) }

function formatPeriod(days: number): string {
  if (!days) return ''
  const y  = Math.floor(days / 365)
  const mo = Math.floor(days / 30)
  const w  = Math.floor(days / 7)
  if (y  >= 1) return `${y}y`
  if (mo >= 1) return `${mo}m`
  if (w  >= 1) return `${w}w`
  const parts: string[] = [`${days}d`]
  return parts.join(' ')
}

function formatDuration(s?: string): string {
  if (!s) return '—'
  let days = 0, hours = 0, minutes = 0
  // "D day(s), H:MM:SS"
  const withDays = s.match(/(\d+)\s+days?,\s*(\d+):(\d+)/)
  if (withDays) {
    days = +withDays[1]; hours = +withDays[2]; minutes = +withDays[3]
  } else {
    // "H:MM:SS"
    const hms = s.match(/^(\d+):(\d+):(\d+)/)
    if (hms) {
      const h = +hms[1]
      days = Math.floor(h / 24); hours = h % 24; minutes = +hms[2]
    }
  }
  const parts: string[] = []
  if (days)    parts.push(`${days}d`)
  if (hours)   parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  return parts.length ? parts.join(' ') : '< 1m'
}

function winrateClass(v: number) {
  if (v >= 0.5) return 'positive'
  if (v >= 0.35) return 'neutral'
  return 'negative'
}

function valueClass(v: number) {
  return v >= 0 ? 'positive' : 'negative'
}

// ── 6-tier metric rating ──────────────────────────────
// Each scale is [bad_min, poor_min, ok_min, good_min, excellent_min, extraordinary_min]
// Value must be >= the breakpoint to reach that tier.
// For drawdown pass the NEGATED fraction so "closer to 0" = better tier.
// Tiers: bad (red) · ok · good · excellent · extraordinary · legendary
// Anything below the "ok" breakpoint falls to tier-bad (red).
const TIER_LABELS = ['tier-bad', 'tier-ok', 'tier-good', 'tier-excellent', 'tier-extraordinary', 'tier-legendary'] as const

const METRIC_SCALES: Record<string, number[]> = {
  //               bad        ok     good   excel  xord   legend
  totalProfit:  [-Infinity,  0.05,  0.20,  0.50,  1.00,  2.00],
  cagr:         [-Infinity,  0.05,  0.15,  0.30,  0.50,  1.00],
  winrate:      [-Infinity,  0.45,  0.55,  0.65,  0.75,  0.80],
  sharpe:       [-Infinity,  0.5,   1.0,   1.5,   2.0,   3.0 ],
  sortino:      [-Infinity,  0.5,   1.0,   2.0,   3.0,   5.0 ],
  calmar:       [-Infinity,  0.2,   0.5,   1.0,   2.0,   4.0 ],
  drawdown:     [-Infinity, -0.30, -0.20, -0.10, -0.05, -0.02],
  profitFactor: [-Infinity,  1.1,   1.3,   1.5,   2.0,   3.0 ],
  expectancy:   [-Infinity,  1,     5,     15,    30,    50  ],
  sqn:          [-Infinity,  1.0,   2.0,   3.0,   5.0,   7.0 ],
}

function metricTier(key: string, value: number): string {
  const scale = METRIC_SCALES[key]
  if (!scale || value == null) return ''
  let t = 0
  for (let i = 0; i < scale.length; i++) {
    if (value >= scale[i]) t = i
  }
  return TIER_LABELS[t]
}

interface TierThreshold { label: string; value: string; cls: string }

function metricThresholds(key: string): TierThreshold[] {
  const scale = METRIC_SCALES[key]
  if (!scale) return []
  const defs = [
    { i: 1, label: 'OK',            cls: 'tier-ok'            },
    { i: 2, label: 'Good',          cls: 'tier-good'          },
    { i: 3, label: 'Excellent',     cls: 'tier-excellent'     },
    { i: 4, label: 'Extraordinary', cls: 'tier-extraordinary' },
    { i: 5, label: 'Legendary',     cls: 'tier-legendary'     },
  ]
  return defs.map(({ i, label, cls }) => {
    const v = scale[i]
    let formatted: string
    if (key === 'drawdown') {
      formatted = `< ${(-v * 100).toFixed(0)}%`
    } else if (['totalProfit', 'cagr', 'winrate'].includes(key)) {
      formatted = `≥ ${(v * 100).toFixed(0)}%`
    } else {
      formatted = `≥ ${Number.isInteger(v) ? v : v.toFixed(1)}`
    }
    return { label, value: formatted, cls }
  })
}

// Exit reasons that are inherently "good" regardless of win rate
const GOOD_EXIT_REASONS = new Set([
  'trailing_stop_loss',
  'roi',
  'take_profit',
  'force_exit',
])

function exitBadgeClass(key: string, winrate: number) {
  if (GOOD_EXIT_REASONS.has(key)) return 'tag-good'
  if (winrate === 0) return 'tag-bad'
  if (winrate >= 0.8) return 'tag-good'
  return ''
}

// ── Grade breakdown ───────────────────────────────────
const GRADE_ANCHORS = {
  sharpe:   { lower: 0.5, upper: 2.5 },
  profit:   { lower: 0.0, upper: 0.5 },
  drawdown: { lower: 0.25, upper: 0.05 },
}
const GRADE_WEIGHTS = { sharpe: 0.40, profit: 0.30, drawdown: 0.30 }
const GRADE_DEAL_BREAKERS = { minTrades: 30, maxDrawdown: 0.50 }

function gradeNormalize(value: number, lower: number, upper: number, inverse: boolean): number {
  if (inverse) {
    const clamped = Math.max(upper, Math.min(lower, value))
    return ((lower - clamped) / (lower - upper)) * 100
  }
  const clamped = Math.max(lower, Math.min(upper, value))
  return ((clamped - lower) / (upper - lower)) * 100
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'S+'
  if (score >= 80) return 'S'
  if (score >= 65) return 'A'
  if (score >= 50) return 'B'
  if (score >= 35) return 'C'
  if (score >= 20) return 'D'
  return 'E'
}

const GRADE_CLASS_MAP: Record<string, string> = {
  'S+': 'g-splus', 'S': 'g-s', 'A': 'g-a',
  'B': 'g-b', 'C': 'g-c', 'D': 'g-d', 'E': 'g-e', 'F': 'g-f',
}
function gradeBadgeClass(grade: string): string { return GRADE_CLASS_MAP[grade] ?? '' }

const gradeBreakdown = computed(() => {
  const dd     = s.value.max_drawdown_account ?? 0
  const trades = s.value.total_trades ?? 0
  const profit = s.value.profit_total ?? 0
  const sharpe = s.value.sharpe ?? 0

  const tradePassed = trades >= GRADE_DEAL_BREAKERS.minTrades
  const ddPassed    = dd <= GRADE_DEAL_BREAKERS.maxDrawdown
  const passed      = tradePassed && ddPassed

  const sharpeScore   = gradeNormalize(sharpe, GRADE_ANCHORS.sharpe.lower,   GRADE_ANCHORS.sharpe.upper,   false)
  const profitScore   = gradeNormalize(profit, GRADE_ANCHORS.profit.lower,   GRADE_ANCHORS.profit.upper,   false)
  const ddScore       = gradeNormalize(dd,     GRADE_ANCHORS.drawdown.lower, GRADE_ANCHORS.drawdown.upper, true)

  const sharpeContrib  = sharpeScore  * GRADE_WEIGHTS.sharpe
  const profitContrib  = profitScore  * GRADE_WEIGHTS.profit
  const ddContrib      = ddScore      * GRADE_WEIGHTS.drawdown
  const totalScore     = passed ? +(sharpeContrib + profitContrib + ddContrib).toFixed(1) : 0

  return {
    passed,
    tradePassed,
    ddPassed,
    rows: [
      {
        metric: 'Sharpe',
        value: sharpe.toFixed(2),
        anchors: `${GRADE_ANCHORS.sharpe.lower} → ${GRADE_ANCHORS.sharpe.upper}`,
        score:  +sharpeScore.toFixed(1),
        weight: '40%',
        contrib: +sharpeContrib.toFixed(1),
      },
      {
        metric: 'Profit',
        value: (profit * 100).toFixed(2) + '%',
        anchors: `${(GRADE_ANCHORS.profit.lower * 100).toFixed(0)}% → ${(GRADE_ANCHORS.profit.upper * 100).toFixed(0)}%`,
        score:  +profitScore.toFixed(1),
        weight: '30%',
        contrib: +profitContrib.toFixed(1),
      },
      {
        metric: 'Max DD',
        value: (dd * 100).toFixed(2) + '%',
        anchors: `≤ ${(GRADE_ANCHORS.drawdown.lower * 100).toFixed(0)}% → ${(GRADE_ANCHORS.drawdown.upper * 100).toFixed(0)}%`,
        score:  +ddScore.toFixed(1),
        weight: '30%',
        contrib: +ddContrib.toFixed(1),
      },
    ],
    totalScore,
    grade: passed ? gradeFromScore(totalScore) : 'F',
  }
})

// ── HyroTrader 2-Step Challenge Simulator ─────────────────
const HYDRO = {
  phase1Target:  0.10,
  phase2Target:  0.05,
  maxDailyLoss:  0.05,
  maxTotalLoss:  0.10,
  phase1MinDays: 10,
  phase2MinDays: 5,
} as const

type ChallengePhase = 'phase1' | 'phase2' | 'funded' | 'busted'

interface ChallengeMonthRow {
  kind: 'month'
  key: string; label: string
  pnlPct: number; worstDayPct: number; maxLossFromInitPct: number
  tradingDays: number; phase: ChallengePhase; bustReason: string
  totalProgressPct: number
  phaseProgressPct: number   // cumulative within phase at month-end (used for label)
  barValuePct: number        // bar fill position 0–100, snapped for transition months
  barZeroPct: number         // where 0% profit sits on the bar
  barIsNeg: boolean
  phaseTarget: number
}

interface ChallengeTransitionRow {
  kind: 'transition'
  fromPhase: 'phase1' | 'phase2'
  toPhase: 'phase2' | 'funded'
  date: string   // ISO "YYYY-MM-DD"
  barZeroPct: number
  phasePct: number  // actual cumulative phase P&L at completion
}

type ChallengeRow = ChallengeMonthRow | ChallengeTransitionRow

const hydroChallenge = computed(() => {
  const closed = (s.value.trades ?? []).filter(t => !t.is_open)
  if (!closed.length) return null
  const initBal = s.value.starting_balance
  if (!initBal) return null

  // Group closed-trade P&L by calendar day
  const dayMap = new Map<string, number>()
  for (const t of closed) {
    const d = new Date(t.close_timestamp).toISOString().slice(0, 10)
    dayMap.set(d, (dayMap.get(d) ?? 0) + t.profit_abs)
  }
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (!days.length) return null

  let balance          = initBal
  let phaseStartBal    = initBal
  let phase: ChallengePhase = 'phase1'
  let bustPhase: ChallengePhase = 'phase1'
  let phasePnl         = 0
  let phaseTradingDays = 0
  let phase1EndIdx     = -1
  let phase2EndIdx     = -1
  let phase1EndBalance = initBal  // balance when phase 1 target is hit

  interface SimDay {
    date: string; pnlPct: number; lossFromInitPct: number
    phase: ChallengePhase; bustReason: string
    totalProgressPct: number
    phaseProgressPct: number   // cumulative within current phase / phaseStartBal (resets each phase)
    phaseTarget: number
  }
  const simDays: SimDay[] = []

  for (let i = 0; i < days.length; i++) {
    const [date, pnlAbs] = days[i]
    const pnlPct = pnlAbs / initBal
    let bustReason = ''

    if (phase !== 'funded' && phase !== 'busted') {
      if (pnlPct < -HYDRO.maxDailyLoss)
        bustReason = `Daily loss −${(-pnlPct * 100).toFixed(1)}% > 5% limit`
    }

    balance += pnlAbs
    const lossFromInitPct = Math.max(0, (initBal - balance) / initBal)

    if (!bustReason && phase !== 'funded' && phase !== 'busted') {
      if (lossFromInitPct > HYDRO.maxTotalLoss)
        bustReason = `Total loss −${(lossFromInitPct * 100).toFixed(1)}% > 10% limit`
    }

    if (bustReason && phase !== 'busted') {
      bustPhase = phase
      phase = 'busted'
    }

    let phaseTarget = 0
    let phaseProgressPct = 0

    if (phase !== 'busted') {
      if (pnlAbs !== 0) phaseTradingDays++
      phasePnl += pnlAbs

      phaseTarget = phase === 'phase1' ? HYDRO.phase1Target : phase === 'phase2' ? HYDRO.phase2Target : 0
      // Snapshot before possible reset; funded has no target but still tracks cumulative P&L from funded-start
      phaseProgressPct = phasePnl / phaseStartBal

      if (phase === 'phase1' &&
          phasePnl / phaseStartBal >= HYDRO.phase1Target &&
          phaseTradingDays >= HYDRO.phase1MinDays) {
        phase1EndIdx = i
        phase1EndBalance = balance
        phase = 'phase2'; phaseStartBal = balance; phasePnl = 0; phaseTradingDays = 0
      } else if (phase === 'phase2' &&
          phasePnl / phaseStartBal >= HYDRO.phase2Target &&
          phaseTradingDays >= HYDRO.phase2MinDays) {
        phase2EndIdx = i
        phase = 'funded'; phaseStartBal = balance; phasePnl = 0; phaseTradingDays = 0
      }
    }

    simDays.push({
      date, pnlPct, lossFromInitPct, phase, bustReason,
      totalProgressPct: (balance - initBal) / initBal,
      phaseProgressPct,
      phaseTarget,
    })
  }

  // Compute combined target thresholds in totalProgressPct terms
  // Phase 1 hits at +10%; Phase 2 hits at +10% + 5% of (initBal × 1.10) / initBal ≈ +15.5%
  const p1TargetTotal = HYDRO.phase1Target
  const p2TargetTotal = (phase1EndBalance - initBal + phase1EndBalance * HYDRO.phase2Target) / initBal

  const calDaysBetween = (a: string, b: string) =>
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1

  const phase1CalDays = phase1EndIdx >= 0
    ? calDaysBetween(days[0][0], days[phase1EndIdx][0]) : -1
  const phase2CalDays = phase2EndIdx >= 0 && phase1EndIdx >= 0
    ? calDaysBetween(days[phase1EndIdx + 1]?.[0] ?? days[0][0], days[phase2EndIdx][0]) : -1

  // Monthly aggregation
  const phase1EndMonthKey = phase1EndIdx >= 0 ? days[phase1EndIdx][0].slice(0, 7) : null
  const phase2EndMonthKey = phase2EndIdx >= 0 ? days[phase2EndIdx][0].slice(0, 7) : null

  const monthMap2 = new Map<string, SimDay[]>()
  for (const d of simDays) {
    const mk = d.date.slice(0, 7)
    if (!monthMap2.has(mk)) monthMap2.set(mk, [])
    monthMap2.get(mk)!.push(d)
  }

  const monthRows: ChallengeMonthRow[] = []
  const rows: ChallengeRow[] = []
  for (const [key, mDays] of monthMap2) {
    const [yr, mo] = key.split('-')
    const lastDay = mDays[mDays.length - 1]
    const rawPhaseProgress = lastDay.phaseProgressPct
    const phaseTgt = lastDay.phaseTarget
    // Zero always at 50%; left half = -maxTotalLoss→0, right half = 0→phaseTarget (independent scales)
    const barZeroPct = 50
    const barRawPct = rawPhaseProgress < 0
      ? Math.max(0, 50 + 50 * (rawPhaseProgress / HYDRO.maxTotalLoss))
      : phaseTgt > 0
        ? Math.min(100, 50 + 50 * (rawPhaseProgress / phaseTgt))
        : 50

    const monthRow: ChallengeMonthRow = {
      kind: 'month',
      key,
      label: `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${yr}`,
      pnlPct:            mDays.reduce((acc, d) => acc + d.pnlPct, 0),
      worstDayPct:       Math.min(...mDays.map(d => d.pnlPct)),
      maxLossFromInitPct: Math.max(...mDays.map(d => d.lossFromInitPct)),
      tradingDays:       mDays.filter(d => d.pnlPct !== 0).length,
      phase:             lastDay.phase,
      bustReason:        mDays.find(d => d.bustReason)?.bustReason ?? '',
      totalProgressPct:  lastDay.totalProgressPct,
      phaseProgressPct:  lastDay.phaseProgressPct,
      barValuePct:       barRawPct,
      barZeroPct,
      barIsNeg:          rawPhaseProgress < 0,
      phaseTarget:       phaseTgt,
    }
    monthRows.push(monthRow)

    // Insert transition marker before the month where the new phase begins
    if (key === phase1EndMonthKey && phase1EndIdx >= 0) {
      rows.push({ kind: 'transition', fromPhase: 'phase1', toPhase: 'phase2', date: days[phase1EndIdx][0], barZeroPct: 50, phasePct: simDays[phase1EndIdx].phaseProgressPct })
    }
    if (key === phase2EndMonthKey && phase2EndIdx >= 0) {
      rows.push({ kind: 'transition', fromPhase: 'phase2', toPhase: 'funded', date: days[phase2EndIdx][0], barZeroPct: 50, phasePct: simDays[phase2EndIdx].phaseProgressPct })
    }

    rows.push(monthRow)
  }

  const fundedStartKey = phase2EndIdx >= 0 ? days[phase2EndIdx][0].slice(0, 7) : null
  const fundedStartMonthIdx = fundedStartKey
    ? monthRows.findIndex(m => m.key >= fundedStartKey) : -1
  const fundedRows = fundedStartMonthIdx >= 0 ? monthRows.slice(fundedStartMonthIdx) : []

  const bustSimDay = simDays.find(d => d.bustReason)

  return {
    monthRows,
    rows,
    funded:            phase2EndIdx >= 0,
    busted:            !!bustSimDay,
    bustPhase:         bustSimDay ? bustPhase : null,
    bustDate:          bustSimDay?.date ?? null,
    bustReason:        bustSimDay?.bustReason ?? '',
    initBal,
    phase1CalDays,
    phase2CalDays,
    totalCalDays:      phase1CalDays >= 0 && phase2CalDays >= 0 ? phase1CalDays + phase2CalDays : -1,
    phase1EndDate:     phase1EndIdx >= 0 ? days[phase1EndIdx][0] : null,
    phase2EndDate:     phase2EndIdx >= 0 ? days[phase2EndIdx][0] : null,
    fundedMonthsTotal: fundedRows.length,
    fundedMonthsPass:  fundedRows.filter(m => !m.bustReason && m.phase !== 'busted').length,
    p1TargetTotal,
    p2TargetTotal,
  }
})

// Shared bar coordinate system: -10% (left) to +25% (right)
const hydroBarCfg = computed(() => {
  const barMin = -HYDRO.maxTotalLoss  // -0.10
  const barMax = 0.25
  const range  = barMax - barMin       // 0.35
  const toPos  = (v: number) => Math.max(0, Math.min(100, (v - barMin) / range * 100))
  const p1 = hydroChallenge.value?.p1TargetTotal ?? HYDRO.phase1Target
  const p2 = hydroChallenge.value?.p2TargetTotal ?? (HYDRO.phase1Target + HYDRO.phase2Target * 1.1)
  return { barMin, barMax, range, toPos, zeroPct: toPos(0), p1Pct: toPos(p1), p2Pct: toPos(p2) }
})

const showConfig = ref(false)

const configJson = computed(() => {
  const cfg = {
    strategy:                      s.value.strategy_name,
    timeframe:                     s.value.timeframe,
    trading_mode:                  s.value.trading_mode,
    margin_mode:                   s.value.margin_mode,
    stake_amount:                  s.value.stake_amount,
    stake_currency:                s.value.stake_currency,
    starting_balance:              s.value.starting_balance,
    max_open_trades:               s.value.max_open_trades,
    stoploss:                      s.value.stoploss,
    use_custom_stoploss:           s.value.use_custom_stoploss,
    trailing_stop:                 s.value.trailing_stop,
    trailing_stop_positive:        s.value.trailing_stop_positive,
    trailing_stop_positive_offset: s.value.trailing_stop_positive_offset,
    trailing_only_offset_is_reached: s.value.trailing_only_offset_is_reached,
    minimal_roi:                   s.value.minimal_roi,
    pairlist:                      s.value.pairlist,
  }
  return JSON.stringify(cfg, null, 2)
})

function highlightJson(raw: string): string {
  // Escape HTML first
  const esc = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return esc
    // keys
    .replace(/^(\s*)("[\w_]+")\s*:/gm, '$1<span class="j-key">$2</span>:')
    // string values
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="j-str">$1</span>')
    // boolean values
    .replace(/:\s*(true|false)\b/g, ': <span class="j-bool">$1</span>')
    // null values
    .replace(/:\s*(null)\b/g, ': <span class="j-null">$1</span>')
    // number values
    .replace(/:\s*(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi, ': <span class="j-num">$1</span>')
    // strings inside arrays
    .replace(/^\s*("(?:[^"\\]|\\.)*")/gm, (m, s) => m.replace(s, `<span class="j-str">${s}</span>`))
}

const trailingLabel = computed(() => {
  if (!s.value.trailing_stop) return 'Off'
  const pos = s.value.trailing_stop_positive
  const off = s.value.trailing_stop_positive_offset
  if (pos != null && pos > 0) return `${pct(pos * 100)} / offset ${pct(off * 100)}`
  return 'On'
})

const stoplossLabel = computed(() => {
  if (s.value.use_custom_stoploss) return 'Custom'
  return pct(s.value.stoploss * 100)
})

const runDate = computed(() => {
  if (s.value.backtest_run_end_ts) {
    return new Date(s.value.backtest_run_end_ts * 1000).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }
  return '—'
})
</script>

<template>
  <div class="benchmark-detail">

    <!-- Back button + title -->
    <div class="detail-header">
      <button class="back-btn" @click="router.go(withBase('/'))">← All benchmarks</button>
      <div class="header-right">
        <button class="currency-toggle" @click="toggleCurrency" :title="`Switch to ${currency === 'USD' ? 'DKK' : 'USD'}`">
          <span :class="{ active: currency === 'USD' }">USD</span>
          <span class="cur-sep">/</span>
          <span :class="{ active: currency === 'DKK' }">DKK</span>
        </button>
        <button
          class="theme-toggle"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="isDark = !isDark"
        >
          <svg v-if="isDark" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ── TLDR pill badges + config toggle ─────────── -->
    <div class="tldr-row">
      <div class="tldr-pills">
        <span class="tldr-pill" :class="s.profit_total_abs >= 0 ? 'pos' : 'neg'">
          <span class="pill-label">Made</span>
          <span class="pill-number">{{ fmtAbs(s.profit_total_abs) }}</span>
        </span>
        <span class="tldr-pill" :class="s.profit_total >= 0 ? 'pos' : 'neg'">
          <span class="pill-label">Profit</span>
          <span class="pill-number">{{ s.profit_total >= 0 ? '+' : '' }}{{ (s.profit_total * 100).toFixed(2) }}%</span>
        </span>
        <span class="tldr-pill" :class="s.winrate >= 0.5 ? 'pos' : 'neg'">
          <span class="pill-label">Win Rate</span>
          <span class="pill-number">{{ (s.winrate * 100).toFixed(1) }}%</span>
        </span>
        <span class="tldr-pill pos">
          <span class="pill-label">Wins</span>
          <span class="pill-number">{{ s.wins }}</span>
        </span>
        <span class="tldr-pill neg">
          <span class="pill-label">Losses</span>
          <span class="pill-number">{{ s.losses }}</span>
        </span>
      </div>
      <div class="config-toggle-row">
        <button class="config-toggle" @click="showConfig = !showConfig">
          <span class="config-chevron" :class="{ open: showConfig }">▶</span>
          backtest.config.json
        </button>
        <a
          class="badge-source-link"
          :href="`https://github.com/BitBull-capital/benchmarks/blob/master/benchmarks/${props.benchmarkId}/${s.strategy_name}.py`"
          target="_blank"
          rel="noopener noreferrer"
          title="link to source"
        ><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg></a>
      </div>
    </div>

    <!-- Backtest config card -->
    <div v-if="showConfig" class="config-card">
      <pre class="config-pre"><code v-html="highlightJson(configJson)" /></pre>
    </div>

    <!-- Equity curve -->
    <EquityCurve :trades="s.trades ?? []" :starting-balance="s.starting_balance" />

    <!-- Key metrics card -->
    <div class="meta-card">
      <div class="meta-top">
        <div class="meta-badges">
          <MedalBadge
            v-if="props.medal != null"
            :rank="props.medal"
            :grade="gradeBreakdown.grade"
          />
          <span class="badge-strategy">{{ s.strategy_name }}</span>
          <span class="badge-tf">{{ s.timeframe }}</span>
          <span class="badge-range">{{ s.timerange }}<span v-if="s.backtest_days" class="badge-period"> ({{ formatPeriod(s.backtest_days) }})</span></span>
        </div>
        <div class="meta-run-info">
          <span class="run-label">Run:</span>
          <span class="run-date">{{ runDate }}</span>
          &nbsp;·&nbsp;
          <span>{{ s.backtest_start?.slice(0, 10) }} → {{ s.backtest_end?.slice(0, 10) }}</span>
        </div>
      </div>

      <div class="metrics-table-wrap">
        <table class="metrics-table">
          <thead>
            <tr>
              <th class="mt-th-name">Metric</th>
              <th class="mt-th-desc">What it means</th>
              <th class="mt-th-thresh">Thresholds</th>
              <th class="mt-th-value">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="mt-name">Total Profit</td>
              <td class="mt-desc">Total return on invested capital across all closed trades in the backtest period.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('totalProfit')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('totalProfit', s.profit_total)">
                <span class="mt-primary">{{ pc(s.profit_total) }}</span>
                <span class="mt-secondary">{{ abs(s.profit_total_abs) }}</span>
              </td>
            </tr>
            <tr>
              <td class="mt-name">CAGR</td>
              <td class="mt-desc">Compound Annual Growth Rate — equivalent yearly return if all profits were continuously reinvested.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('cagr')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('cagr', s.cagr)"><span class="mt-primary">{{ pc(s.cagr) }}</span></td>
            </tr>
            <tr>
              <td class="mt-name">Win Rate</td>
              <td class="mt-desc">Share of trades that closed with a profit (wins ÷ total trades).</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('winrate')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('winrate', s.winrate)">
                <span class="mt-primary">{{ (s.winrate * 100).toFixed(1) }}%</span>
                <span class="mt-secondary">{{ s.wins }}W / {{ s.losses }}L</span>
              </td>
            </tr>
            <tr>
              <td class="mt-name">Trades</td>
              <td class="mt-desc">Total completed trades and average daily trading frequency over the period.</td>
              <td class="mt-thresh mt-no-thresh">—</td>
              <td class="mt-value">
                <span class="mt-primary">{{ s.total_trades?.toLocaleString() }}</span>
                <span class="mt-secondary">{{ num(s.trades_per_day, 1) }}/day</span>
              </td>
            </tr>
            <tr>
              <td class="mt-name">Avg Duration</td>
              <td class="mt-desc">How long the strategy holds a position open on average before closing.</td>
              <td class="mt-thresh mt-no-thresh">—</td>
              <td class="mt-value"><span class="mt-primary mt-mono">{{ formatDuration(s.holding_avg) }}</span></td>
            </tr>
            <tr>
              <td class="mt-name">Sharpe</td>
              <td class="mt-desc">How much return you earn above a risk-free position per unit of total volatility you take on.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('sharpe')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('sharpe', s.sharpe)"><span class="mt-primary">{{ num(s.sharpe) }}</span></td>
            </tr>
            <tr>
              <td class="mt-name">Sortino</td>
              <td class="mt-desc">Like Sharpe, but only penalises downside volatility — better reflects strategies where upside swings aren't considered risk.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('sortino')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('sortino', s.sortino)"><span class="mt-primary">{{ num(s.sortino) }}</span></td>
            </tr>
            <tr>
              <td class="mt-name">Calmar</td>
              <td class="mt-desc">Annualised return divided by maximum drawdown. Shows how efficiently the strategy recovers from its worst loss period.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('calmar')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('calmar', s.calmar)"><span class="mt-primary">{{ num(s.calmar) }}</span></td>
            </tr>
            <tr>
              <td class="mt-name">Max Drawdown</td>
              <td class="mt-desc">Largest peak-to-trough portfolio loss during the period — the worst scenario an investor holding through the backtest would have experienced.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('drawdown')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('drawdown', -s.max_drawdown_account)">
                <span class="mt-primary">{{ pct(-s.max_drawdown_account * 100) }}</span>
                <span class="mt-secondary">{{ abs(-s.max_drawdown_abs) }}</span>
              </td>
            </tr>
            <tr>
              <td class="mt-name">Profit Factor</td>
              <td class="mt-desc">Gross profit divided by gross loss. Above 1.0 means the strategy is net profitable.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('profitFactor')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('profitFactor', s.profit_factor)"><span class="mt-primary">{{ num(s.profit_factor) }}</span></td>
            </tr>
            <tr>
              <td class="mt-name">Expectancy</td>
              <td class="mt-desc">Average gain or loss per trade in absolute USDT terms. A positive value means each trade earns money on average.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('expectancy')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('expectancy', s.expectancy)"><span class="mt-primary">{{ num(s.expectancy) }}</span></td>
            </tr>
            <tr>
              <td class="mt-name">SQN</td>
              <td class="mt-desc">System Quality Number — measures how consistently the strategy generates returns relative to its variance. Van Tharp scale: ≥ 2 good, ≥ 3 excellent, ≥ 5 outstanding, ≥ 7 Holy Grail.</td>
              <td class="mt-thresh"><span v-for="t in metricThresholds('sqn')" :key="t.cls" class="thresh-item" :class="t.cls">{{ t.value }}</span></td>
              <td class="mt-value" :class="metricTier('sqn', s.sqn)"><span class="mt-primary">{{ num(s.sqn) }}</span></td>
            </tr>
            <tr>
              <td class="mt-name">Balance</td>
              <td class="mt-desc">Final portfolio value at the end of the backtest, starting from the initial balance.</td>
              <td class="mt-thresh mt-no-thresh">—</td>
              <td class="mt-value">
                <span class="mt-primary mt-mono">{{ fmtBalance(s.final_balance ?? 0) }}</span>
                <span class="mt-secondary">from {{ fmtBalance(s.starting_balance ?? 0) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Grade breakdown ──────────────────────────────── -->
    <section class="detail-section">
      <div class="grade-section-header">
        <h2 class="section-title" style="margin-bottom:0">Grade</h2>
        <span class="grade-result-badge" :class="gradeBadgeClass(gradeBreakdown.grade)">
          {{ gradeBreakdown.grade }}
        </span>
        <span v-if="gradeBreakdown.passed" class="grade-total-score-pill">
          {{ gradeBreakdown.totalScore }} / 100
        </span>
      </div>

      <!-- Deal breaker checks -->
      <div class="db-row">
        <span class="db-chip" :class="gradeBreakdown.tradePassed ? 'db-pass' : 'db-fail'">
          <span class="db-icon">{{ gradeBreakdown.tradePassed ? '✓' : '✗' }}</span>
          Trades ≥ {{ 30 }}
          <span class="db-actual">({{ s.total_trades }})</span>
        </span>
        <span class="db-chip" :class="gradeBreakdown.ddPassed ? 'db-pass' : 'db-fail'">
          <span class="db-icon">{{ gradeBreakdown.ddPassed ? '✓' : '✗' }}</span>
          Max DD ≤ 50%
          <span class="db-actual">({{ (s.max_drawdown_account * 100).toFixed(1) }}%)</span>
        </span>
        <span v-if="!gradeBreakdown.passed" class="db-fail-note">Deal breaker triggered — grade F</span>
      </div>

      <!-- Score breakdown table -->
      <div v-if="gradeBreakdown.passed" class="table-wrap">
        <table class="grade-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th class="num">Raw Value</th>
              <th>Anchors (worst → best)</th>
              <th class="num">Score / 100</th>
              <th class="num">Weight</th>
              <th class="num">Contribution</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in gradeBreakdown.rows" :key="row.metric">
              <td class="gt-metric">{{ row.metric }}</td>
              <td class="num mono">{{ row.value }}</td>
              <td class="gt-anchors mono">{{ row.anchors }}</td>
              <td class="num">
                <div class="gt-score-cell">
                  <div class="score-bar-wrap">
                    <div class="score-bar" :style="{ width: row.score + '%' }" />
                  </div>
                  <span class="mono gt-score-num">{{ row.score }}</span>
                </div>
              </td>
              <td class="num mono">{{ row.weight }}</td>
              <td class="num mono gt-contrib">{{ row.contrib }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="gt-total-row">
              <td colspan="5" class="gt-total-label">Total score</td>
              <td class="num mono gt-total-value">{{ gradeBreakdown.totalScore }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <!-- ── HyroTrader 2-Step Challenge ──────────────────── -->
    <section v-if="hydroChallenge" class="detail-section">
      <details class="hydro-details">
        <summary class="hydro-summary">
          <h2 class="section-title" style="margin-bottom:0">🏆 HyroTrader 2-Step Challenge</h2>
          <div class="hydro-rules">
            <span class="hr-chip">Phase 1 +10%</span>
            <span class="hr-chip">Phase 2 +5%</span>
            <span class="hr-chip hr-chip-limit">Daily −5%</span>
            <span class="hr-chip hr-chip-limit">Max DD −10%</span>
            <span class="hr-chip">Min {{ HYDRO.phase1MinDays }} / {{ HYDRO.phase2MinDays }} days</span>
          </div>
        </summary>

      <!-- Summary cards -->
      <div class="hydro-cards">
        <div class="hydro-card" :class="hydroChallenge.phase1CalDays >= 0 ? 'hc-pass' : 'hc-fail'">
          <div class="hc-label">Phase 1</div>
          <div class="hc-value">{{ hydroChallenge.phase1CalDays >= 0 ? hydroChallenge.phase1CalDays + 'd' : '—' }}</div>
          <div class="hc-sub">{{ hydroChallenge.phase1EndDate ?? 'not reached' }}</div>
        </div>
        <div class="hydro-card" :class="hydroChallenge.phase2CalDays >= 0 ? 'hc-pass' : 'hc-fail'">
          <div class="hc-label">Phase 2</div>
          <div class="hc-value">{{ hydroChallenge.phase2CalDays >= 0 ? hydroChallenge.phase2CalDays + 'd' : '—' }}</div>
          <div class="hc-sub">{{ hydroChallenge.phase2EndDate ?? 'not reached' }}</div>
        </div>
        <div class="hydro-card" :class="hydroChallenge.funded ? 'hc-pass' : 'hc-fail'">
          <div class="hc-label">Time to funded</div>
          <div class="hc-value">{{ hydroChallenge.totalCalDays >= 0 ? hydroChallenge.totalCalDays + 'd' : '—' }}</div>
          <div class="hc-sub">
            <span v-if="hydroChallenge.totalCalDays >= 0">≈ {{ Math.round(hydroChallenge.totalCalDays / 7) }}w</span>
            <span v-else>busted in {{ hydroChallenge.bustPhase === 'phase1' ? 'Phase 1' : 'Phase 2' }}</span>
          </div>
        </div>
        <div v-if="hydroChallenge.funded" class="hydro-card" :class="hydroChallenge.fundedMonthsPass === hydroChallenge.fundedMonthsTotal ? 'hc-pass' : hydroChallenge.fundedMonthsPass > 0 ? 'hc-warn' : 'hc-fail'">
          <div class="hc-label">Funded stability</div>
          <div class="hc-value">{{ hydroChallenge.fundedMonthsPass }} / {{ hydroChallenge.fundedMonthsTotal }}</div>
          <div class="hc-sub">months within rules</div>
        </div>
      </div>

      <!-- Bust notice -->
      <div v-if="hydroChallenge.busted" class="hydro-bust-banner">
        ✗ Challenge busted {{ hydroChallenge.bustDate }} — {{ hydroChallenge.bustReason }}
      </div>

      <!-- Monthly breakdown table -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Phase</th>
              <th class="hm-th-progress" title="Cumulative P&L since this phase started, as % of phase-start balance. Resets each phase.">Phase P&L</th>
              <th class="num" title="Total P&L for this calendar month, as % of initial balance. In transition months this includes days from the prior phase.">Month P&L</th>
              <th class="num">Worst Day</th>
              <th class="num">Max Loss</th>
              <th class="num">Trading Days</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in hydroChallenge.rows" :key="row.kind === 'month' ? row.key : `t-${row.date}`">
              <!-- Phase transition milestone row -->
              <tr v-if="row.kind === 'transition'" class="hm-transition-row">
                <td class="mono">{{ formatTransitionDate(row.date) }}</td>
                <td>
                  <span class="hm-phase" :class="row.fromPhase === 'phase1' ? 'hmp-phase1' : 'hmp-phase2'">
                    {{ row.fromPhase === 'phase1' ? 'Phase 1' : 'Phase 2' }}
                  </span>
                  <span class="hm-transition-arrow">→</span>
                  <span class="hm-phase" :class="row.toPhase === 'phase2' ? 'hmp-phase2' : 'hmp-funded'">
                    {{ row.toPhase === 'phase2' ? 'Phase 2' : 'Funded' }}
                  </span>
                </td>
                <td class="hm-progress-cell">
                  <div class="hm-bipolar-wrap">
                    <div class="hm-fill"
                      :class="row.toPhase === 'funded' ? 'hm-fill-funded' : 'hm-fill-pos'"
                      :style="{ left: row.barZeroPct + '%', width: (100 - row.barZeroPct) + '%' }" />
                    <div class="hm-marker hm-marker-zero" :style="{ left: row.barZeroPct + '%' }" />
                  </div>
                  <span class="hm-prog-label mono" :class="row.toPhase === 'funded' ? 'hpl-funded' : ''">
                    {{ pct(row.phasePct * 100, 1) }} ✓
                  </span>
                </td>
                <td colspan="5" class="hm-transition-note">
                  {{ row.fromPhase === 'phase1' ? 'Challenge passed' : 'Funded 🎉' }}
                </td>
              </tr>
              <!-- Regular month row -->
              <tr v-else :class="{ 'hrow-bust': row.bustReason }">
                <td class="mono">{{ row.label }}</td>
                <td>
                  <span class="hm-phase" :class="`hmp-${row.phase}`">
                    {{ row.phase === 'phase1' ? 'Phase 1' : row.phase === 'phase2' ? 'Phase 2' : row.phase === 'funded' ? 'Funded' : '—' }}
                  </span>
                </td>
                <td class="hm-progress-cell">
                  <!-- Per-phase bar: left edge = −10% (bust), right edge = phase target (win) -->
                  <div v-if="row.phase === 'phase1' || row.phase === 'phase2'" class="hm-bipolar-wrap">
                    <div v-if="row.barIsNeg" class="hm-fill hm-fill-neg"
                      :style="{ left: row.barValuePct + '%', width: (row.barZeroPct - row.barValuePct) + '%' }" />
                    <div v-else class="hm-fill hm-fill-pos"
                      :style="{ left: row.barZeroPct + '%', width: (row.barValuePct - row.barZeroPct) + '%' }" />
                    <div class="hm-marker hm-marker-zero" :style="{ left: row.barZeroPct + '%' }" />
                  </div>
                  <span v-if="row.phase === 'phase1' || row.phase === 'phase2'" class="hm-prog-label mono" :class="row.barIsNeg ? 'hpl-negative' : ''">
                    {{ pct(row.phaseProgressPct * 100, 1) }} / {{ pct(row.phaseTarget * 100, 0) }}
                  </span>
                  <span v-else-if="row.phase === 'funded'" class="hm-prog-label hpl-funded mono">
                    {{ pct(row.phaseProgressPct * 100, 1) }}
                    <span class="hm-take-home"
                      :data-tooltip="`Month gross: ${fmtMoney(row.pnlPct * hydroChallenge.initBal)} × 90% (HyroTrader split)`">
                      {{ fmtMoney(row.pnlPct * hydroChallenge.initBal * 0.9) }}
                    </span>
                  </span>
                </td>
                <td class="num mono" :class="row.pnlPct >= 0 ? 'positive' : 'negative'">{{ pct(row.pnlPct * 100, 1) }}</td>
                <td class="num mono" :class="row.worstDayPct < -HYDRO.maxDailyLoss ? 'negative' : ''">{{ pct(row.worstDayPct * 100, 1) }}</td>
                <td class="num mono" :class="row.maxLossFromInitPct > HYDRO.maxTotalLoss ? 'negative' : ''">
                  {{ row.maxLossFromInitPct > 0.001 ? pct(-row.maxLossFromInitPct * 100, 1) : '—' }}
                </td>
                <td class="num mono">{{ row.tradingDays }}</td>
                <td>
                  <span v-if="!row.bustReason" class="hm-ok">✓</span>
                  <span v-else class="hm-fail" :title="row.bustReason">✗ {{ row.bustReason }}</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      </details>
    </section>

    <!-- ── Additional statistics ────────────────────────── -->
    <section class="detail-section">
      <h2 class="section-title">📊 Additional Statistics</h2>
      <div class="table-wrap">
        <table class="addl-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th class="num">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="addl-name">Best / Worst Day</td>
              <td class="num mono">
                <span class="positive">{{ pct(s.backtest_best_day * 100) }}</span>
                <span class="addl-sep">/</span>
                <span class="negative">{{ pct(s.backtest_worst_day * 100) }}</span>
              </td>
            </tr>
            <tr>
              <td class="addl-name">Consecutive Wins / Losses</td>
              <td class="num mono">
                <span class="positive">{{ s.max_consecutive_wins }}W</span>
                <span class="addl-sep">/</span>
                <span class="negative">{{ s.max_consecutive_losses }}L</span>
              </td>
            </tr>
            <tr>
              <td class="addl-name">Winning / Losing Days</td>
              <td class="num mono">
                <span class="positive">{{ s.winning_days }}W</span>
                <span class="addl-sep">/</span>
                <span class="negative">{{ s.losing_days }}L</span>
                <span class="addl-muted"> / {{ s.draw_days }} flat &nbsp;(of {{ s.backtest_days }})</span>
              </td>
            </tr>
            <tr>
              <td class="addl-name">Winner / Loser Avg Hold</td>
              <td class="num mono">
                <span>{{ s.winner_holding_avg || '—' }}</span>
                <span class="addl-sep">/</span>
                <span>{{ s.loser_holding_avg || '—' }}</span>
              </td>
            </tr>
            <tr>
              <td class="addl-name">Market Change <span class="addl-muted">(buy &amp; hold)</span></td>
              <td class="num mono" :class="valueClass(s.market_change)">{{ pct(s.market_change * 100) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Monthly PnL breakdown ───────────────────────── -->
    <section v-if="monthRows.length > 0" class="detail-section">
      <h2 class="section-title">📅 Monthly PnL</h2>
      <div class="table-wrap">
        <table class="month-table">
          <thead>
            <tr>
              <th>Month</th>
              <th class="num">PnL {{ currency }}</th>
              <th class="num">Trades</th>
              <th class="num">W / D / L</th>
              <th class="num">Profit Factor</th>
              <th class="month-bar-th"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in monthRows" :key="row.date_ts">
                <td class="mono month-label">{{ MONTH_NAMES[parseInt(row.date.split('/')[1], 10) - 1] }} <span class="month-year-tag" :class="`year-color-${monthYearOrder.indexOf(row.date.slice(-4)) % 4}`">{{ row.date.slice(-4) }}</span></td>
                <td class="num mono" :class="valueClass(row.profit_abs)">{{ abs(row.profit_abs) }}</td>
                <td class="num mono">{{ row.trades }}</td>
                <td class="num mono">
                  <span class="positive">{{ row.wins }}W</span>
                  <span v-if="row.draws" class="addl-muted"> {{ row.draws }}D</span>
                  <span class="addl-sep">/</span>
                  <span class="negative">{{ row.losses }}L</span>
                </td>
                <td class="num mono" :class="valueClass(row.profit_factor - 1)">{{ num(row.profit_factor) }}</td>
                <td class="month-bar-td">
                  <div class="month-bar-wrap">
                    <div
                      class="month-bar"
                      :class="row.profit_abs >= 0 ? 'bar-pos' : 'bar-neg'"
                      :style="{ width: monthBarWidth(row.profit_abs) + '%' }"
                    />
                  </div>
                </td>
              </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Long vs Short breakdown ─────────────────────── -->
    <section v-if="longShortStats.hasShorts" class="detail-section">
      <h2 class="section-title">⚖️ Long vs Short</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Direction</th>
              <th class="num">Trades</th>
              <th class="num">W / L</th>
              <th class="num">Win %</th>
              <th class="num">Total Profit %</th>
              <th class="num">Total Profit {{ currency }}</th>
              <th class="num">Avg Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in longShortStats.rows" :key="row.dir">
              <td>
                <span class="dir-badge">
                  <svg
                    viewBox="0 0 24 24"
                    :class="row.dir === 'Short' ? 'dir-icon-short' : 'dir-icon-long'"
                    aria-hidden="true"
                  >
                    <path d="M3.293,14.707a1,1,0,0,1,1.414-1.414L11,19.586V2a1,1,0,0,1,2,0V19.586l6.293-6.293a1,1,0,0,1,1.414,1.414l-8,8a1,1,0,0,1-.325.216.986.986,0,0,1-.764,0,1,1,0,0,1-.325-.216Z"/>
                  </svg>
                  {{ row.dir }}
                </span>
              </td>
              <td class="num mono">{{ row.trades }}</td>
              <td class="num mono">{{ row.wins }} / {{ row.losses }}</td>
              <td class="num mono" :class="winrateClass(row.winrate)">
                {{ (row.winrate * 100).toFixed(1) }}%
              </td>
              <td class="num mono" :class="valueClass(row.profitPct)">
                {{ pct(row.profitPct) }}
              </td>
              <td class="num mono" :class="valueClass(row.profitAbs)">
                {{ abs(row.profitAbs) }}
              </td>
              <td class="num mono">{{ formatMinutes(row.avgDurMins) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Results per pair ───────────────────────────── -->
    <section class="detail-section">
      <h2 class="section-title">📈 Results per Pair</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="row-num-th">#</th>
              <th class="sortable" @click="pairSort.toggle('key')">Pair <span class="sort-icon">{{ pairSort.icon('key') }}</span></th>
              <th class="sortable num" @click="pairSort.toggle('trades')">Trades <span class="sort-icon">{{ pairSort.icon('trades') }}</span></th>
              <th class="sortable num" @click="pairSort.toggle('profit_mean_pct')">Avg Profit % <span class="sort-icon">{{ pairSort.icon('profit_mean_pct') }}</span></th>
              <th class="sortable num" @click="pairSort.toggle('profit_total_pct')">Total Profit % <span class="sort-icon">{{ pairSort.icon('profit_total_pct') }}</span></th>
              <th class="sortable num" @click="pairSort.toggle('profit_total_abs')">Total Profit {{ currency }} <span class="sort-icon">{{ pairSort.icon('profit_total_abs') }}</span></th>
              <th class="sortable num" @click="pairSort.toggle('duration_avg')">Avg Duration <span class="sort-icon">{{ pairSort.icon('duration_avg') }}</span></th>
              <th class="sortable num" @click="pairSort.toggle('wins')">W / L <span class="sort-icon">{{ pairSort.icon('wins') }}</span></th>
              <th class="sortable num" @click="pairSort.toggle('winrate')">Win % <span class="sort-icon">{{ pairSort.icon('winrate') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in pairRows" :key="row.key">
              <td class="row-num">{{ i + 1 }}</td>
              <td><PairSymbol :pair="row.key" /></td>
              <td class="num mono">{{ row.trades }}</td>
              <td class="num mono" :class="valueClass(row.profit_mean_pct)">{{ pct(row.profit_mean_pct) }}</td>
              <td class="num mono" :class="valueClass(row.profit_total_pct)">{{ pct(row.profit_total_pct) }}</td>
              <td class="num mono" :class="valueClass(row.profit_total_abs)">{{ abs(row.profit_total_abs) }}</td>
              <td class="num mono">{{ formatDuration(row.duration_avg) }}</td>
              <td class="num mono">{{ row.wins }} / {{ row.losses }}</td>
              <td class="num mono">{{ (row.winrate * 100).toFixed(1) }}%</td>
            </tr>
            <tr v-if="pairRows.length === 0">
              <td colspan="9" class="empty-row">No pair data</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Enter tag stats ───────────────────────────── -->
    <section v-if="enterTagRows.length > 0" class="detail-section">
      <h2 class="section-title">🏷️ Enter Tag Stats</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="sortable" @click="enterSort.toggle('key')">Tag <span class="sort-icon">{{ enterSort.icon('key') }}</span></th>
              <th class="sortable num" @click="enterSort.toggle('trades')">Trades <span class="sort-icon">{{ enterSort.icon('trades') }}</span></th>
              <th class="sortable num" @click="enterSort.toggle('profit_mean_pct')">Avg Profit % <span class="sort-icon">{{ enterSort.icon('profit_mean_pct') }}</span></th>
              <th class="sortable num" @click="enterSort.toggle('profit_total_pct')">Total Profit % <span class="sort-icon">{{ enterSort.icon('profit_total_pct') }}</span></th>
              <th class="sortable num" @click="enterSort.toggle('profit_total_abs')">Total Profit {{ currency }} <span class="sort-icon">{{ enterSort.icon('profit_total_abs') }}</span></th>
              <th class="sortable num" @click="enterSort.toggle('duration_avg')">Avg Duration <span class="sort-icon">{{ enterSort.icon('duration_avg') }}</span></th>
              <th class="sortable num" @click="enterSort.toggle('wins')">W / L <span class="sort-icon">{{ enterSort.icon('wins') }}</span></th>
              <th class="sortable num" @click="enterSort.toggle('winrate')">Win % <span class="sort-icon">{{ enterSort.icon('winrate') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in enterTagRows" :key="row.key">
              <td><span class="tag-badge">{{ row.key || '(untagged)' }}</span></td>
              <td class="num mono">{{ row.trades }}</td>
              <td class="num mono" :class="valueClass(row.profit_mean_pct)">{{ pct(row.profit_mean_pct) }}</td>
              <td class="num mono" :class="valueClass(row.profit_total_pct)">{{ pct(row.profit_total_pct) }}</td>
              <td class="num mono" :class="valueClass(row.profit_total_abs)">{{ abs(row.profit_total_abs) }}</td>
              <td class="num mono">{{ formatDuration(row.duration_avg) }}</td>
              <td class="num mono">{{ row.wins }} / {{ row.losses }}</td>
              <td class="num mono">{{ (row.winrate * 100).toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Exit reason stats ─────────────────────────── -->
    <section class="detail-section">
      <h2 class="section-title">🚪 Exit Reason Stats</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="sortable" @click="exitSort.toggle('key')">Reason <span class="sort-icon">{{ exitSort.icon('key') }}</span></th>
              <th class="sortable num" @click="exitSort.toggle('trades')">Trades <span class="sort-icon">{{ exitSort.icon('trades') }}</span></th>
              <th class="sortable num" @click="exitSort.toggle('profit_mean_pct')">Avg Profit % <span class="sort-icon">{{ exitSort.icon('profit_mean_pct') }}</span></th>
              <th class="sortable num" @click="exitSort.toggle('profit_total_pct')">Total Profit % <span class="sort-icon">{{ exitSort.icon('profit_total_pct') }}</span></th>
              <th class="sortable num" @click="exitSort.toggle('profit_total_abs')">Total Profit {{ currency }} <span class="sort-icon">{{ exitSort.icon('profit_total_abs') }}</span></th>
              <th class="sortable num" @click="exitSort.toggle('duration_avg')">Avg Duration <span class="sort-icon">{{ exitSort.icon('duration_avg') }}</span></th>
              <th class="sortable num" @click="exitSort.toggle('wins')">W / L <span class="sort-icon">{{ exitSort.icon('wins') }}</span></th>
              <th class="sortable num" @click="exitSort.toggle('winrate')">Win % <span class="sort-icon">{{ exitSort.icon('winrate') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in exitReasonRows" :key="row.key">
              <td><span class="tag-badge" :class="exitBadgeClass(row.key, row.winrate)">{{ row.key }}</span></td>
              <td class="num mono">{{ row.trades }}</td>
              <td class="num mono" :class="valueClass(row.profit_mean_pct)">{{ pct(row.profit_mean_pct) }}</td>
              <td class="num mono" :class="valueClass(row.profit_total_pct)">{{ pct(row.profit_total_pct) }}</td>
              <td class="num mono" :class="valueClass(row.profit_total_abs)">{{ abs(row.profit_total_abs) }}</td>
              <td class="num mono">{{ formatDuration(row.duration_avg) }}</td>
              <td class="num mono">{{ row.wins }} / {{ row.losses }}</td>
              <td class="num mono">{{ (row.winrate * 100).toFixed(1) }}%</td>
            </tr>
            <tr v-if="exitReasonRows.length === 0">
              <td colspan="8" class="empty-row">No exit data</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>
</template>

<style scoped>
.benchmark-detail {
  padding-bottom: 3rem;
}

/* ── TLDR pill badges ────────────────────────────────── */
.tldr-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tldr-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 5px;
  font-family: 'Space Grotesk', var(--vp-font-family-mono);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.tldr-pill.pos .pill-number { color: var(--bd-positive); }
.tldr-pill.neg .pill-number { color: var(--bd-negative); }

.pill-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--vp-c-text-3);
}

/* ── Currency toggle ─────────────────────────────────── */
.currency-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0 0.6rem;
  height: 2rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s;
}

.currency-toggle:hover { border-color: var(--vp-c-brand-1); }

.currency-toggle span.active {
  color: var(--vp-c-text-1);
}

.cur-sep {
  color: var(--vp-c-text-3);
  font-weight: 300;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

/* ── Header ──────────────────────────────────────────── */
.detail-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.75rem;
  margin-bottom: 1.25rem;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}

.theme-toggle:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.theme-toggle svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.theme-toggle svg circle {
  fill: currentColor;
  stroke: none;
}

.back-btn {
  padding: 0.3rem 0.85rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.back-btn:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

/* ── Config card (JSON viewer) ───────────────────────── */
.tldr-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.config-toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
.config-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 5px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.config-toggle:hover {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
}

.config-chevron {
  font-size: 0.6rem;
  color: var(--vp-c-text-3);
  transition: transform 0.2s;
  display: inline-block;
}

.config-chevron.open {
  transform: rotate(90deg);
}

.config-card {
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1.25rem;
  font-size: 0.85rem;
}

.config-pre {
  margin: 0 !important;
  padding: 1rem 1.25rem !important;
  background: var(--vp-code-block-bg) !important;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  border-radius: 0 !important;
}

/* JSON syntax colours */
.j-key  { color: #9cdcfe; }
.j-str  { color: #ce9178; }
.j-num  { color: #b5cea8; }
.j-bool { color: #569cd6; }
.j-null { color: #808080; }

/* ── Meta card ───────────────────────────────────────── */
.meta-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem 1.5rem;
  margin-bottom: 2.5rem;
}

.meta-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.meta-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge-strategy {
  display: inline-block;
  padding: 0.3rem 0.8rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 700;
}

.badge-period {
  color: var(--vp-c-text-3);
  font-weight: 400;
}

.badge-source-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  padding: 0 0.5rem;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border-radius: 5px;
  text-decoration: none;
  border: 1px solid var(--vp-c-border);
}
.badge-source-link:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-soft);
}

.badge-tf,
.badge-range {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border-radius: 5px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
}

.meta-run-info {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}

.run-label { color: var(--vp-c-text-3); }
.run-date  { color: var(--vp-c-text-2); }

/* ── Metrics table ───────────────────────────────────── */
.metrics-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
}

.metrics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin: 0 !important;
}

.metrics-table thead tr {
  background: var(--vp-c-bg-soft);
  border-bottom: 2px solid var(--vp-c-border);
}

.metrics-table th {
  padding: 0.3rem 0.85rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mt-th-desc  { width: 100%; }
.mt-th-value { text-align: right; white-space: nowrap; }

@media (max-width: 768px) {
  .mt-th-desc, .mt-desc { display: none; }
}

.metrics-table tr {
  border-bottom: 1px solid var(--vp-c-divider);
}

.metrics-table tbody tr:last-child { border-bottom: none; }

.metrics-table tbody tr:hover { background: var(--vp-c-bg-soft); }

.mt-name {
  padding: 0.3rem 0.85rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  width: 1%;
  vertical-align: middle;
}

.mt-value {
  padding: 0.3rem 0.85rem;
  text-align: right;
  white-space: nowrap;
  width: 1%;
  vertical-align: middle;
}

.mt-value.positive { color: var(--bd-positive); }
.mt-value.neutral  { color: var(--bd-neutral); }
.mt-value.negative { color: var(--bd-negative); }

.mt-value.tier-bad           { color: var(--bd-tier-bad); }
.mt-value.tier-ok            { color: var(--vp-c-text-1); }
.mt-value.tier-good          { color: var(--bd-tier-good); }
.mt-value.tier-excellent     { color: var(--bd-tier-excellent); }
.mt-value.tier-extraordinary { color: var(--bd-tier-extraordinary); }
.mt-value.tier-legendary     { color: var(--bd-tier-legendary); }

.mt-primary {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  line-height: 1.2;
}

.mt-mono {
  font-family: var(--vp-font-family-mono);
}

.mt-secondary {
  display: block;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  margin-top: 0.05rem;
  font-family: var(--vp-font-family-mono);
}

.mt-desc {
  padding: 0.3rem 0.85rem;
  color: var(--vp-c-text-3);
  font-size: 0.82rem;
  line-height: 1.45;
  width: 100%;
  vertical-align: middle;
}

.mt-th-thresh { white-space: nowrap; }

.mt-thresh {
  padding: 0.3rem 0.85rem;
  vertical-align: middle;
  white-space: nowrap;
}

.mt-no-thresh { color: var(--vp-c-text-3); font-size: 0.8rem; }

.thresh-item {
  display: inline-block;
  font-size: 0.85rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  margin-right: 0.4rem;
}

.thresh-item:last-child { margin-right: 0; }

.thresh-item.tier-ok            { color: var(--vp-c-text-2); }
.thresh-item.tier-good          { color: var(--bd-tier-good); }
.thresh-item.tier-excellent     { color: var(--bd-tier-excellent); }
.thresh-item.tier-extraordinary { color: var(--bd-tier-extraordinary); }
.thresh-item.tier-legendary     { color: var(--bd-tier-legendary); }

/* ── Sections ────────────────────────────────────────── */
.detail-section {
  margin-bottom: 2.5rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--vp-c-text-1);
  border: none !important;
  padding: 0 !important;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
}

.table-wrap table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin: 0 !important;
}

.table-wrap thead tr {
  background: var(--vp-c-bg-soft);
  border-bottom: 2px solid var(--vp-c-border);
}

.table-wrap th {
  padding: 0.3rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  user-select: none;
}

.table-wrap th.num { text-align: right; }

.table-wrap th.sortable {
  cursor: pointer;
}

.table-wrap th.sortable:hover {
  color: var(--vp-c-text-1);
}

.sort-icon {
  font-size: 0.7rem;
  margin-left: 3px;
  opacity: 0.45;
}

.table-wrap tr {
  border-bottom: 1px solid var(--vp-c-divider);
}

.table-wrap tbody tr:last-child { border-bottom: none; }

.table-wrap tbody tr:hover {
  background: var(--vp-c-bg-soft);
}

.table-wrap td {
  padding: 0.28rem 0.75rem;
  color: var(--vp-c-text-1);
  vertical-align: middle;
  white-space: nowrap;
}

.table-wrap td.num { text-align: right; }

/* ── Cell styling ────────────────────────────────────── */
.mono { font-family: var(--vp-font-family-mono); }

.table-wrap td.positive { color: var(--bd-positive); font-weight: 600; }
.table-wrap td.neutral  { color: var(--bd-neutral);  font-weight: 600; }
.table-wrap td.negative { color: var(--bd-negative); font-weight: 600; }

.row-num-th {
  width: 2rem;
  text-align: center;
  color: var(--vp-c-text-3) !important;
}

.row-num {
  text-align: center;
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  user-select: none;
}

@media (max-width: 768px) {
  .row-num-th,
  .row-num { display: none; }
}

.pair-key {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

/* ── Additional stats table ──────────────────────────── */
.addl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin: 0 !important;
}

.addl-table thead tr {
  background: var(--vp-c-bg-soft);
  border-bottom: 2px solid var(--vp-c-border);
}

.addl-table th {
  padding: 0.3rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.addl-table th.num { text-align: right; }

.addl-table tr {
  border-bottom: 1px solid var(--vp-c-divider);
}

.addl-table tbody tr:last-child { border-bottom: none; }
.addl-table tbody tr:hover { background: var(--vp-c-bg-soft); }

.addl-name {
  padding: 0.3rem 0.75rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
  white-space: nowrap;
}

.addl-table td.num {
  padding: 0.3rem 0.75rem;
  text-align: right;
}

.addl-sep {
  color: var(--vp-c-text-3);
  margin: 0 0.3rem;
}

.addl-muted {
  color: var(--vp-c-text-3);
  font-size: 0.82em;
}

.dir-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  font-size: 0.82rem;
}

.dir-icon-long,
.dir-icon-short {
  width: 0.85em;
  height: 0.85em;
  flex-shrink: 0;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.dir-icon-long {
  fill: #6A9FE0;
  stroke: #6A9FE0;
  transform: rotate(180deg);
}

.dir-icon-short {
  fill: #D96070;
  stroke: #D96070;
}

/* Lighter tints in dark mode */
:global(.dark) .dir-icon-long  { fill: #C1D8FF; stroke: #C1D8FF; }
:global(.dark) .dir-icon-short { fill: #a3a3a3; stroke: #a3a3a3; }

.tag-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border-radius: 4px;
  font-size: 0.78rem;
  font-family: var(--vp-font-family-mono);
}

.tag-badge.tag-good {
  background: var(--bd-positive-bg);
  color: var(--bd-positive);
}

.tag-badge.tag-bad {
  background: var(--bd-negative-bg);
  color: var(--bd-negative);
}

.empty-row {
  text-align: center;
  color: var(--vp-c-text-3);
  padding: 1.5rem !important;
}

/* ── Monthly PnL table ───────────────────────────────── */
.month-year-tag {
  font-size: 0.68rem;
  font-weight: 600;
  margin-left: 0.3rem;
}
.year-color-0 { color: #A0ABD9; }
.year-color-1 { color: #A0C9AB; }
.year-color-2 { color: #D9B8A0; }
.year-color-3 { color: #C4A0D9; }

.month-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.month-bar-th {
  width: 120px;
  min-width: 80px;
}

.month-bar-td {
  padding: 0.28rem 0.75rem;
  width: 120px;
  min-width: 80px;
}

.month-bar-wrap {
  height: 8px;
  background: var(--vp-c-bg-mute);
  border-radius: 4px;
  overflow: hidden;
}

.month-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
  min-width: 2px;
}

.bar-pos { background: var(--bd-positive); }
.bar-neg { background: var(--bd-negative); }

/* ── Grade section ───────────────────────────────────── */
.grade-section-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.grade-result-badge {
  display: inline-block;
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
}

.grade-result-badge.g-splus { color: var(--bd-grade-splus); background: var(--bd-grade-splus-bg); }
.grade-result-badge.g-s     { color: var(--bd-grade-s);    background: var(--bd-grade-s-bg); }
.grade-result-badge.g-a     { color: var(--bd-grade-a);    background: var(--bd-grade-a-bg); }
.grade-result-badge.g-b     { color: var(--bd-grade-b);    background: var(--bd-grade-b-bg); }
.grade-result-badge.g-c     { color: var(--bd-grade-c);    background: var(--bd-grade-c-bg); }
.grade-result-badge.g-d     { color: var(--bd-grade-d);    background: var(--bd-grade-d-bg); }
.grade-result-badge.g-e     { color: var(--bd-grade-e);    background: var(--bd-grade-e-bg); }
.grade-result-badge.g-f     { color: var(--bd-grade-f);    background: var(--bd-grade-f-bg); }

.grade-total-score-pill {
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
}

/* Deal breaker chips */
.db-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}

.db-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 5px;
  font-size: 0.78rem;
  font-family: var(--vp-font-family-mono);
  border: 1px solid transparent;
}

.db-chip.db-pass {
  background: rgba(22, 163, 74, 0.08);
  color: var(--bd-tier-good);
  border-color: rgba(22, 163, 74, 0.2);
}

.db-chip.db-fail {
  background: rgba(220, 38, 38, 0.08);
  color: var(--bd-tier-bad);
  border-color: rgba(220, 38, 38, 0.2);
}

.db-icon { font-weight: 700; }

.db-actual {
  opacity: 0.7;
  margin-left: 0.1rem;
}

.db-fail-note {
  font-size: 0.78rem;
  color: var(--bd-tier-bad);
  font-style: italic;
}

/* Score breakdown table */
.grade-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin: 0 !important;
}

.grade-table thead tr {
  background: var(--vp-c-bg-soft);
  border-bottom: 2px solid var(--vp-c-border);
}

.grade-table th {
  padding: 0.3rem 0.85rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.grade-table th.num { text-align: right; }

.grade-table tr { border-bottom: 1px solid var(--vp-c-divider); }
.grade-table tbody tr:last-child { border-bottom: none; }
.grade-table tbody tr:hover { background: var(--vp-c-bg-soft); }

.grade-table td {
  padding: 0.32rem 0.85rem;
  vertical-align: middle;
  white-space: nowrap;
  color: var(--vp-c-text-1);
}

.grade-table td.num { text-align: right; }

.gt-metric {
  font-weight: 600;
  min-width: 6rem;
}

.gt-anchors {
  color: var(--vp-c-text-3);
  font-size: 0.78rem;
}

.gt-score-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.score-bar-wrap {
  width: 60px;
  height: 6px;
  background: var(--vp-c-bg-mute);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.score-bar {
  height: 100%;
  background: var(--vp-c-brand-1);
  border-radius: 3px;
  transition: width 0.3s ease;
  min-width: 2px;
}

.gt-score-num {
  width: 2.5rem;
  text-align: right;
}

.gt-contrib {
  font-weight: 600;
}

/* Total row in tfoot */
.gt-total-row {
  background: var(--vp-c-bg-soft) !important;
  border-top: 2px solid var(--vp-c-border) !important;
}

.gt-total-label {
  padding: 0.35rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}

.gt-total-value {
  padding: 0.35rem 0.85rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  text-align: right;
}

/* ── HyroTrader Challenge Section ────────────────────────── */
.hydro-details { border: none; }
.hydro-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  cursor: pointer;
  list-style: none;
  user-select: none;
  transition: background 0.15s, border-color 0.15s;
}
.hydro-summary:hover {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-brand-1);
}
.hydro-summary::-webkit-details-marker { display: none; }
.hydro-summary::marker { display: none; }
.hydro-summary .section-title {
  margin-bottom: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.hydro-summary .section-title::after {
  content: '▸';
  font-size: 0.7em;
  color: var(--vp-c-text-3);
  transition: transform 0.15s;
}
.hydro-details[open] .hydro-summary .section-title::after {
  transform: rotate(90deg);
}
.hydro-details[open] .hydro-summary {
  border-radius: 8px 8px 0 0;
  border-bottom-color: transparent;
  margin-bottom: 0;
}
.hydro-details[open] > :not(summary) {
  border: 1px solid var(--vp-c-border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 1rem 0.75rem 0.75rem;
}

.hydro-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
  padding-top: 0.15rem;
}

.hr-chip {
  display: inline-block;
  padding: 0.12rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
}

.hr-chip-limit {
  background: rgba(220, 38, 38, 0.06);
  color: var(--bd-tier-bad);
  border-color: rgba(220, 38, 38, 0.18);
}

.hydro-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.hydro-card {
  flex: 1;
  min-width: 110px;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
}

.hydro-card.hc-pass { border-color: rgba(22, 163, 74, 0.30); background: rgba(22, 163, 74, 0.05); }
.hydro-card.hc-fail { border-color: rgba(220, 38, 38, 0.25); background: rgba(220, 38, 38, 0.04); }
.hydro-card.hc-warn { border-color: rgba(245, 158, 11, 0.30); background: rgba(245, 158, 11, 0.05); }

.hc-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  margin-bottom: 0.2rem;
}

.hc-value {
  font-family: var(--vp-font-family-mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  line-height: 1.1;
}

.hc-sub {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  margin-top: 0.15rem;
  font-family: var(--vp-font-family-mono);
}

.hydro-bust-banner {
  padding: 0.5rem 0.85rem;
  border-radius: 6px;
  background: rgba(220, 38, 38, 0.07);
  border: 1px solid rgba(220, 38, 38, 0.2);
  color: var(--bd-tier-bad);
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 0.85rem;
}

.hm-phase {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  white-space: nowrap;
}

.hmp-phase1 { background: rgba(99,  102, 241, 0.10); color: #818cf8; }
.hmp-phase2 { background: rgba(245, 158,  11, 0.10); color: #d97706; }
.hmp-funded { background: rgba(22,  163,  74, 0.10); color: var(--bd-tier-good); }
.hmp-busted { background: rgba(220,  38,  38, 0.10); color: var(--bd-tier-bad); }

.hrow-bust td { background: rgba(220, 38, 38, 0.035) !important; }

.hm-transition-row td { background: var(--vp-c-bg-soft) !important; }
.hm-transition-arrow { margin: 0 4px; color: var(--vp-c-text-3); font-size: 0.8rem; }
.hm-transition-note  { color: var(--vp-c-text-2); font-size: 0.8rem; }

.hm-ok   { color: var(--bd-tier-good); font-weight: 700; font-size: 0.9rem; }
.hm-fail { color: var(--bd-tier-bad);  font-size: 0.78rem; font-weight: 600; }

.hm-progress-cell {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  white-space: nowrap;
  padding: 0.28rem 0.75rem;
  width: 180px;
}

.hm-bipolar-wrap {
  position: relative;
  flex: 0 0 90px;
  width: 90px;
  height: 8px;
  background: var(--vp-c-bg-mute);
  border-radius: 9999px;
  border: 1px solid var(--vp-c-border);
  overflow: hidden;
}

.hm-fill {
  position: absolute;
  top: 0;
  bottom: 0;
}

.hm-fill-neg    { background: var(--bd-tier-bad); }
.hm-fill-pos    { background: var(--vp-c-brand-1); }
.hm-fill-funded { background: var(--bd-tier-good); }

.hm-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
}

.hm-marker-zero { background: var(--vp-c-text-2); opacity: 0.5; }
.hm-marker-p1   { background: var(--bd-tier-good); opacity: 0.6; }
.hm-marker-p2   { background: var(--bd-tier-extraordinary); opacity: 0.6; }

.hm-th-progress { width: 180px; min-width: 180px; }

.hm-prog-label {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  flex-shrink: 0;
}

.hpl-negative { color: var(--bd-tier-bad); }
.hpl-funded   { color: var(--bd-tier-good); }
.hm-take-home {
  position: relative;
  color: var(--vp-c-text-2);
  font-size: 0.78rem;
  margin-left: 0.25rem;
  cursor: default;
}
.hm-take-home::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0s;
  z-index: 10;
}
.hm-take-home:hover::after { opacity: 1; }

.hm-prog-funded {
  font-size: 0.75rem;
  color: var(--bd-tier-good);
}

.hm-prog-na {
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
}
</style>
