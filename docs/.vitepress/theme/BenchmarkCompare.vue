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
  trade_duration: number
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
  backtest_days: number
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
  starting_balance: number
  final_balance: number
  trades_per_day: number
  cagr: number
  expectancy: number
  wins: number
  losses: number
  draws: number
  trades: Trade[]
  results_per_pair: ResultRow[]
  results_per_enter_tag: ResultRow[]
  exit_reason_summary: ResultRow[]
  periodic_breakdown?: {
    month?: Array<{
      date: string
      date_ts: number
      profit_abs: number
      wins: number
      draws: number
      losses: number
      trades: number
    }>
  }
}

const props = defineProps<{ dataA: StrategyData; dataB: StrategyData; idA: string; idB: string }>()
const router = useRouter()
const { isDark } = useData()
const { currency, toggle: toggleCurrency, fmtAbs, fmtBalance } = useCurrency()

const sharedTs = ref<number | null>(null)

function pct(v: number, d = 2) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(d) + '%'
}
function num(v: number, d = 2) {
  if (v == null) return '—'
  return v.toFixed(d)
}
function pc(v: number) { return pct(v * 100) }

function formatPeriod(days: number) {
  if (!days) return ''
  const y = Math.round(days / 365), mo = Math.round(days / 30), w = Math.round(days / 7)
  if (y >= 1) return `${y}y`; if (mo >= 1) return `${mo}m`; if (w >= 1) return `${w}w`
  return `${days}d`
}

function formatDuration(s?: string): string {
  if (!s) return '—'
  let days = 0, hours = 0, minutes = 0
  const wd = s.match(/(\d+)\s+days?,\s*(\d+):(\d+)/)
  if (wd) { days = +wd[1]; hours = +wd[2]; minutes = +wd[3] }
  else { const hms = s.match(/^(\d+):(\d+):(\d+)/); if (hms) { const h = +hms[1]; days = Math.floor(h/24); hours = h%24; minutes = +hms[2] } }
  const p: string[] = []
  if (days) p.push(`${days}d`); if (hours) p.push(`${hours}h`); if (minutes) p.push(`${minutes}m`)
  return p.length ? p.join(' ') : '< 1m'
}

// ── Metrics ───────────────────────────────────────────
type Winner = 'a' | 'b' | null

function winner(va: number, vb: number, higherBetter: boolean): Winner {
  if (va == null || vb == null) return null
  if (higherBetter) return va > vb ? 'a' : va < vb ? 'b' : null
  return va < vb ? 'a' : va > vb ? 'b' : null
}

// For cells in merged tables — returns 'winner'/'loser'/positive/negative/muted
function profitCls(mine: ResultRow | null, other: ResultRow | null): string {
  if (!mine) return 'muted'
  if (!other) return mine.profit_total_pct >= 0 ? 'positive' : 'negative'
  if (mine.profit_total_pct > other.profit_total_pct) return 'row-winner'
  if (mine.profit_total_pct < other.profit_total_pct) return 'row-loser'
  return mine.profit_total_pct >= 0 ? 'positive' : 'negative'
}

function winrateCls(mine: ResultRow | null, other: ResultRow | null): string {
  if (!mine || !other) return ''
  if (mine.winrate > other.winrate) return 'row-winner'
  if (mine.winrate < other.winrate) return 'row-loser'
  return ''
}

interface MetricRow {
  label: string
  subA?: string
  subB?: string
  valA: string
  valB: string
  winner: Winner
}

const metrics = computed<MetricRow[]>(() => {
  const a = props.dataA, b = props.dataB
  return [
    { label: 'Total Profit',   valA: pc(a.profit_total),             valB: pc(b.profit_total),             subA: fmtAbs(a.profit_total_abs), subB: fmtAbs(b.profit_total_abs), winner: winner(a.profit_total, b.profit_total, true) },
    { label: 'CAGR',           valA: pc(a.cagr),                     valB: pc(b.cagr),                     winner: winner(a.cagr, b.cagr, true) },
    { label: 'Win Rate',       valA: (a.winrate*100).toFixed(1)+'%', valB: (b.winrate*100).toFixed(1)+'%', subA: `${a.wins}W / ${a.losses}L`, subB: `${b.wins}W / ${b.losses}L`, winner: winner(a.winrate, b.winrate, true) },
    { label: 'Sharpe',         valA: num(a.sharpe),                  valB: num(b.sharpe),                  winner: winner(a.sharpe, b.sharpe, true) },
    { label: 'Sortino',        valA: num(a.sortino),                 valB: num(b.sortino),                 winner: winner(a.sortino, b.sortino, true) },
    { label: 'Calmar',         valA: num(a.calmar),                  valB: num(b.calmar),                  winner: winner(a.calmar, b.calmar, true) },
    { label: 'Max Drawdown',   valA: pct(-a.max_drawdown_account*100), valB: pct(-b.max_drawdown_account*100), subA: fmtAbs(-a.max_drawdown_abs), subB: fmtAbs(-b.max_drawdown_abs), winner: winner(a.max_drawdown_account, b.max_drawdown_account, false) },
    { label: 'Profit Factor',  valA: num(a.profit_factor),           valB: num(b.profit_factor),           winner: winner(a.profit_factor, b.profit_factor, true) },
    { label: 'Expectancy',     valA: num(a.expectancy),              valB: num(b.expectancy),              winner: winner(a.expectancy, b.expectancy, true) },
    { label: 'SQN',            valA: num(a.sqn),                     valB: num(b.sqn),                     winner: winner(a.sqn, b.sqn, true) },
    { label: 'Trades',         valA: a.total_trades?.toLocaleString() ?? '—', valB: b.total_trades?.toLocaleString() ?? '—', subA: num(a.trades_per_day,1)+'/day', subB: num(b.trades_per_day,1)+'/day', winner: null },
    { label: 'Final Balance',  valA: fmtBalance(a.final_balance),   valB: fmtBalance(b.final_balance),    subA: `from ${fmtBalance(a.starting_balance)}`, subB: `from ${fmtBalance(b.starting_balance)}`, winner: winner(a.final_balance, b.final_balance, true) },
  ]
})

// ── Merged comparison tables ──────────────────────────
function mergeRows(rowsA: ResultRow[], rowsB: ResultRow[]) {
  const mapA = new Map<string, ResultRow>()
  const mapB = new Map<string, ResultRow>()
  for (const r of rowsA ?? []) if (r.key && r.key !== 'TOTAL') mapA.set(r.key, r)
  for (const r of rowsB ?? []) if (r.key && r.key !== 'TOTAL') mapB.set(r.key, r)
  const keys = new Set([...mapA.keys(), ...mapB.keys()])
  return [...keys].sort().map(key => ({ key, a: mapA.get(key) ?? null, b: mapB.get(key) ?? null }))
}

const pairRows    = computed(() => mergeRows(props.dataA.results_per_pair, props.dataB.results_per_pair))
const enterRows   = computed(() => mergeRows(props.dataA.results_per_enter_tag, props.dataB.results_per_enter_tag))
const exitRows    = computed(() => mergeRows(props.dataA.exit_reason_summary, props.dataB.exit_reason_summary))

// ── Monthly PnL ───────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function monthLabel(date: string) {
  const p = date.split('/')
  return p.length === 3 ? (MONTH_NAMES[parseInt(p[1],10)-1] ?? p[1]) : date
}
function monthYear(date: string) { return date.slice(-4) }

type MonthRow = { date: string; date_ts: number; profit_abs: number; wins: number; draws: number; losses: number; trades: number }

const monthsA = computed(() => props.dataA.periodic_breakdown?.month ?? [])
const monthsB = computed(() => props.dataB.periodic_breakdown?.month ?? [])

function monthKey(date: string): string {
  const p = date.split('/')
  return p.length === 3 ? `${p[1]}/${p[2]}` : date  // "MM/YYYY"
}

const monthComparison = computed(() => {
  const mapA = new Map<string, MonthRow>()
  const mapB = new Map<string, MonthRow>()
  for (const r of monthsA.value) mapA.set(monthKey(r.date), r)
  for (const r of monthsB.value) mapB.set(monthKey(r.date), r)
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()])
  return [...allKeys]
    .sort((a, b) => {
      const [moA, yrA] = a.split('/')
      const [moB, yrB] = b.split('/')
      if (yrA !== yrB) return parseInt(yrA) - parseInt(yrB)
      return parseInt(moA) - parseInt(moB)
    })
    .map(key => {
      const [mo, yr] = key.split('/')
      return {
        key,
        label: `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${yr}`,
        year: yr,
        a: mapA.get(key) ?? null,
        b: mapB.get(key) ?? null,
      }
    })
})


const monthYearOrder = computed(() => {
  const seen: string[] = []
  for (const r of monthComparison.value) {
    if (!seen.includes(r.year)) seen.push(r.year)
  }
  return seen
})

function monthPnlCls(mine: MonthRow | null, other: MonthRow | null): string {
  if (!mine) return 'muted'
  if (!other) return mine.profit_abs >= 0 ? 'positive' : 'negative'
  if (mine.profit_abs > other.profit_abs) return 'row-winner'
  if (mine.profit_abs < other.profit_abs) return 'row-loser'
  return mine.profit_abs >= 0 ? 'positive' : 'negative'
}
</script>

<template>
  <div class="compare-wrap">

    <!-- Header -->
    <div class="cmp-header">
      <button class="back-btn" @click="router.go(withBase('/'))">← All benchmarks</button>
      <div class="header-right">
        <button class="currency-toggle" @click="toggleCurrency" :title="`Switch to ${currency === 'USD' ? 'DKK' : 'USD'}`">
          <span :class="{ active: currency === 'USD' }">USD</span>
          <span class="cur-sep">/</span>
          <span :class="{ active: currency === 'DKK' }">DKK</span>
        </button>
        <button class="theme-toggle" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="isDark = !isDark">
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

    <!-- Strategy titles -->
    <div class="cmp-titles">
      <button class="cmp-title-btn" @click="router.go(withBase(`/benchmarks/${idA}`))">
        <span class="cmp-strategy-name">{{ dataA.strategy_name }}</span>
        <span class="cmp-strategy-meta">{{ dataA.timeframe }} · {{ dataA.timerange }} · {{ formatPeriod(dataA.backtest_days) }}</span>
      </button>
      <div class="cmp-vs">vs</div>
      <button class="cmp-title-btn" @click="router.go(withBase(`/benchmarks/${idB}`))">
        <span class="cmp-strategy-name">{{ dataB.strategy_name }}</span>
        <span class="cmp-strategy-meta">{{ dataB.timeframe }} · {{ dataB.timerange }} · {{ formatPeriod(dataB.backtest_days) }}</span>
      </button>
    </div>

    <!-- ── Equity curves ─────────────────────────────── -->
    <section class="cmp-section">
      <h2 class="section-title">📈 Equity Curves</h2>
      <div class="cmp-curves">
        <div class="cmp-curve-col">
          <div class="cmp-curve-label side-a">{{ dataA.strategy_name }} · {{ dataA.timeframe }}</div>
          <EquityCurve :trades="dataA.trades ?? []" :starting-balance="dataA.starting_balance" :cross-ts="sharedTs" @hover-ts="sharedTs = $event" />
        </div>
        <div class="cmp-curve-col">
          <div class="cmp-curve-label side-b">{{ dataB.strategy_name }} · {{ dataB.timeframe }}</div>
          <EquityCurve :trades="dataB.trades ?? []" :starting-balance="dataB.starting_balance" :cross-ts="sharedTs" @hover-ts="sharedTs = $event" />
        </div>
      </div>
    </section>

    <!-- ── Metrics ───────────────────────────────────── -->
    <section class="cmp-section">
      <h2 class="section-title">📊 Metrics</h2>
      <div class="table-wrap">
        <table class="cmp-metrics-table">
          <thead>
            <tr>
              <th class="cmp-th-metric">Metric</th>
              <th class="cmp-th-val side-a-bg">{{ dataA.strategy_name }} <span class="th-tf">{{ dataA.timeframe }}</span></th>
              <th class="cmp-th-val side-b-bg cmp-div">{{ dataB.strategy_name }} <span class="th-tf">{{ dataB.timeframe }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in metrics" :key="m.label">
              <td class="cmp-metric-name">{{ m.label }}</td>
              <td class="cmp-val mono" :class="{ winner: m.winner === 'a', loser: m.winner === 'b' }">
                <span class="cmp-primary">{{ m.valA }}</span>
                <span v-if="m.subA" class="cmp-sub">{{ m.subA }}</span>
              </td>
              <td class="cmp-val mono cmp-div" :class="{ winner: m.winner === 'b', loser: m.winner === 'a' }">
                <span class="cmp-primary">{{ m.valB }}</span>
                <span v-if="m.subB" class="cmp-sub">{{ m.subB }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Monthly PnL ───────────────────────────────── -->
    <section v-if="monthComparison.length > 0" class="cmp-section">
      <h2 class="section-title">📅 Monthly PnL</h2>
      <div class="table-wrap">
        <table class="cmp-wide-table">
          <thead>
            <tr>
              <th rowspan="2" class="tag-col">Month</th>
              <th colspan="3" class="group-th side-a-bg">{{ dataA.strategy_name }} · {{ dataA.timeframe }}</th>
              <th colspan="3" class="group-th side-b-bg">{{ dataB.strategy_name }} · {{ dataB.timeframe }}</th>
            </tr>
            <tr>
              <th class="num sub-th">PnL {{ currency }}</th>
              <th class="num sub-th">Trades</th>
              <th class="num sub-th">W / L</th>
              <th class="num sub-th cmp-div">PnL {{ currency }}</th>
              <th class="num sub-th">Trades</th>
              <th class="num sub-th">W / L</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in monthComparison" :key="row.key">
                <td class="mono month-col-label">{{ row.label.split(' ')[0] }} <span class="month-year-tag" :class="`year-color-${monthYearOrder.indexOf(row.year) % 4}`">{{ row.year }}</span></td>
                <td class="num mono" :class="monthPnlCls(row.a, row.b)">{{ row.a ? fmtAbs(row.a.profit_abs) : '—' }}</td>
                <td class="num mono">{{ row.a?.trades ?? '—' }}</td>
                <td class="num mono">{{ row.a ? `${row.a.wins}W / ${row.a.losses}L` : '—' }}</td>
                <td class="num mono cmp-div" :class="monthPnlCls(row.b, row.a)">{{ row.b ? fmtAbs(row.b.profit_abs) : '—' }}</td>
                <td class="num mono">{{ row.b?.trades ?? '—' }}</td>
                <td class="num mono">{{ row.b ? `${row.b.wins}W / ${row.b.losses}L` : '—' }}</td>
              </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Per Pair ──────────────────────────────────── -->
    <section v-if="pairRows.length > 0" class="cmp-section">
      <h2 class="section-title">💱 Per Pair</h2>
      <div class="table-wrap">
        <table class="cmp-wide-table">
          <thead>
            <tr>
              <th rowspan="2" class="pair-col">Pair</th>
              <th colspan="4" class="group-th side-a-bg">{{ dataA.strategy_name }} · {{ dataA.timeframe }}</th>
              <th colspan="4" class="group-th side-b-bg">{{ dataB.strategy_name }} · {{ dataB.timeframe }}</th>
            </tr>
            <tr>
              <th class="num sub-th">Trades</th>
              <th class="num sub-th">Profit %</th>
              <th class="num sub-th">Win %</th>
              <th class="num sub-th">W/L</th>
              <th class="num sub-th cmp-div">Trades</th>
              <th class="num sub-th">Profit %</th>
              <th class="num sub-th">Win %</th>
              <th class="num sub-th">W/L</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pairRows" :key="row.key">
              <td><PairSymbol :pair="row.key" /></td>
              <td class="num mono">{{ row.a?.trades ?? '—' }}</td>
              <td class="num mono" :class="profitCls(row.a, row.b)">{{ row.a ? pct(row.a.profit_total_pct) : '—' }}</td>
              <td class="num mono" :class="winrateCls(row.a, row.b)">{{ row.a ? (row.a.winrate*100).toFixed(1)+'%' : '—' }}</td>
              <td class="num mono">{{ row.a ? `${row.a.wins}/${row.a.losses}` : '—' }}</td>
              <td class="num mono cmp-div">{{ row.b?.trades ?? '—' }}</td>
              <td class="num mono" :class="profitCls(row.b, row.a)">{{ row.b ? pct(row.b.profit_total_pct) : '—' }}</td>
              <td class="num mono" :class="winrateCls(row.b, row.a)">{{ row.b ? (row.b.winrate*100).toFixed(1)+'%' : '—' }}</td>
              <td class="num mono">{{ row.b ? `${row.b.wins}/${row.b.losses}` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Enter Tags ────────────────────────────────── -->
    <section v-if="enterRows.length > 0" class="cmp-section">
      <h2 class="section-title">🏷️ Enter Tags</h2>
      <div class="table-wrap">
        <table class="cmp-wide-table">
          <thead>
            <tr>
              <th rowspan="2" class="tag-col">Tag</th>
              <th colspan="4" class="group-th side-a-bg">{{ dataA.strategy_name }} · {{ dataA.timeframe }}</th>
              <th colspan="4" class="group-th side-b-bg">{{ dataB.strategy_name }} · {{ dataB.timeframe }}</th>
            </tr>
            <tr>
              <th class="num sub-th">Trades</th><th class="num sub-th">Profit %</th><th class="num sub-th">Win %</th><th class="num sub-th">Avg Dur</th>
              <th class="num sub-th cmp-div">Trades</th><th class="num sub-th">Profit %</th><th class="num sub-th">Win %</th><th class="num sub-th">Avg Dur</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in enterRows" :key="row.key">
              <td><span class="tag-badge">{{ row.key || '(untagged)' }}</span></td>
              <td class="num mono">{{ row.a?.trades ?? '—' }}</td>
              <td class="num mono" :class="profitCls(row.a, row.b)">{{ row.a ? pct(row.a.profit_total_pct) : '—' }}</td>
              <td class="num mono" :class="winrateCls(row.a, row.b)">{{ row.a ? (row.a.winrate*100).toFixed(1)+'%' : '—' }}</td>
              <td class="num mono">{{ row.a ? formatDuration(row.a.duration_avg) : '—' }}</td>
              <td class="num mono cmp-div">{{ row.b?.trades ?? '—' }}</td>
              <td class="num mono" :class="profitCls(row.b, row.a)">{{ row.b ? pct(row.b.profit_total_pct) : '—' }}</td>
              <td class="num mono" :class="winrateCls(row.b, row.a)">{{ row.b ? (row.b.winrate*100).toFixed(1)+'%' : '—' }}</td>
              <td class="num mono">{{ row.b ? formatDuration(row.b.duration_avg) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Exit Reasons ──────────────────────────────── -->
    <section v-if="exitRows.length > 0" class="cmp-section">
      <h2 class="section-title">🚪 Exit Reasons</h2>
      <div class="table-wrap">
        <table class="cmp-wide-table">
          <thead>
            <tr>
              <th rowspan="2" class="tag-col">Reason</th>
              <th colspan="4" class="group-th side-a-bg">{{ dataA.strategy_name }} · {{ dataA.timeframe }}</th>
              <th colspan="4" class="group-th side-b-bg">{{ dataB.strategy_name }} · {{ dataB.timeframe }}</th>
            </tr>
            <tr>
              <th class="num sub-th">Trades</th><th class="num sub-th">Profit %</th><th class="num sub-th">Win %</th><th class="num sub-th">Avg Dur</th>
              <th class="num sub-th cmp-div">Trades</th><th class="num sub-th">Profit %</th><th class="num sub-th">Win %</th><th class="num sub-th">Avg Dur</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in exitRows" :key="row.key">
              <td><span class="tag-badge">{{ row.key }}</span></td>
              <td class="num mono">{{ row.a?.trades ?? '—' }}</td>
              <td class="num mono" :class="profitCls(row.a, row.b)">{{ row.a ? pct(row.a.profit_total_pct) : '—' }}</td>
              <td class="num mono" :class="winrateCls(row.a, row.b)">{{ row.a ? (row.a.winrate*100).toFixed(1)+'%' : '—' }}</td>
              <td class="num mono">{{ row.a ? formatDuration(row.a.duration_avg) : '—' }}</td>
              <td class="num mono cmp-div">{{ row.b?.trades ?? '—' }}</td>
              <td class="num mono" :class="profitCls(row.b, row.a)">{{ row.b ? pct(row.b.profit_total_pct) : '—' }}</td>
              <td class="num mono" :class="winrateCls(row.b, row.a)">{{ row.b ? (row.b.winrate*100).toFixed(1)+'%' : '—' }}</td>
              <td class="num mono">{{ row.b ? formatDuration(row.b.duration_avg) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>
</template>

<style scoped>
.compare-wrap { padding-bottom: 3rem; }

/* ── Header & titles ─────────────────────────────────── */
.cmp-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.75rem;
  margin-bottom: 1.25rem;
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
.back-btn:hover { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

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
  transition: border-color 0.15s;
}
.currency-toggle:hover { border-color: var(--vp-c-brand-1); }
.currency-toggle span.active { color: var(--vp-c-text-1); }
.cur-sep { color: var(--vp-c-text-3); font-weight: 300; }

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
  transition: border-color 0.15s, color 0.15s;
}
.theme-toggle:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.theme-toggle svg {
  width: 1rem; height: 1rem;
  fill: none; stroke: currentColor;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.theme-toggle svg circle { fill: currentColor; stroke: none; }

.cmp-titles {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.cmp-title-btn {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s;
}
.cmp-title-btn:hover { border-color: var(--vp-c-brand-1); }

.cmp-strategy-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--vp-c-brand-1);
}

.cmp-strategy-meta {
  font-size: 0.78rem;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-3);
}

.cmp-vs {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--vp-c-text-3);
  flex-shrink: 0;
}

/* ── Equity curves ───────────────────────────────────── */
.cmp-curves {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 768px) {
  .cmp-curves { grid-template-columns: 1fr; }
}

.cmp-curve-col { display: flex; flex-direction: column; gap: 0.4rem; }

.cmp-curve-label {
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  letter-spacing: 0.03em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  align-self: flex-start;
}
.side-a { background: color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent); color: var(--vp-c-brand-1); }
.side-b { background: color-mix(in srgb, #a855f7 12%, transparent); color: #a855f7; }
:global(.dark) .side-b { color: #c084fc; }

/* ── Sections ────────────────────────────────────────── */
.cmp-section { margin-bottom: 2.5rem; }

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--vp-c-text-1);
  border: none !important;
  padding: 0 !important;
}

/* ── Shared table wrap ───────────────────────────────── */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
}

.table-wrap table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin: 0 !important;
}

.table-wrap thead tr { background: var(--vp-c-bg-soft); }
.table-wrap th {
  padding: 0.3rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--vp-c-border);
}
.table-wrap th.num { text-align: right; }
.table-wrap tr { border-bottom: 1px solid var(--vp-c-divider); }
.table-wrap tbody tr:last-child { border-bottom: none; }
.table-wrap tbody tr:hover { background: var(--vp-c-bg-soft); }
.table-wrap td { padding: 0.28rem 0.75rem; color: var(--vp-c-text-1); vertical-align: middle; white-space: nowrap; }
.table-wrap td.num { text-align: right; }

.mono { font-family: var(--vp-font-family-mono); }
.positive { color: var(--bd-positive); font-weight: 600; }
.negative { color: var(--bd-negative); font-weight: 600; }
.muted { color: var(--vp-c-text-3); }
.row-winner { color: var(--bd-positive) !important; font-weight: 600; }
.row-loser  { color: var(--vp-c-text-3) !important; font-weight: 400; }

/* ── Metrics table ───────────────────────────────────── */
.cmp-th-metric { width: 1%; white-space: nowrap; }
.cmp-th-val { width: 50%; }

.side-a-bg { background: color-mix(in srgb, var(--vp-c-brand-1) 6%, var(--vp-c-bg-soft)) !important; color: var(--vp-c-brand-1) !important; }
.side-b-bg { background: color-mix(in srgb, #a855f7 6%, var(--vp-c-bg-soft)) !important; color: #a855f7 !important; }
:global(.dark) .side-b-bg { color: #c084fc !important; }

.cmp-metric-name {
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  white-space: nowrap;
  width: 1%;
  padding: 0.3rem 0.85rem;
}

.cmp-val {
  padding: 0.3rem 0.85rem;
  vertical-align: middle;
}

.cmp-primary { display: block; font-weight: 700; font-size: 0.85rem; line-height: 1.2; }
.cmp-sub     { display: block; font-size: 0.72rem; color: var(--vp-c-text-3); margin-top: 0.05rem; }

.cmp-val.winner .cmp-primary { color: var(--bd-positive); }
.cmp-val.loser  .cmp-primary { color: var(--vp-c-text-3); }
.cmp-val.loser  .cmp-sub     { color: var(--vp-c-text-3); }

.th-tf {
  font-weight: 400;
  font-family: var(--vp-font-family-mono);
  font-size: 0.68rem;
  opacity: 0.7;
  margin-left: 0.3rem;
}

/* ── Wide comparison tables (per-pair etc.) ──────────── */
.group-th {
  text-align: center !important;
  border-bottom: 1px solid var(--vp-c-border);
  border-left: 1px solid var(--vp-c-border);
}

.side-b-bg.group-th { border-left: 2px solid var(--vp-c-divider); }

.table-wrap th.cmp-div,
.table-wrap td.cmp-div { border-left: 2px solid var(--vp-c-divider) !important; }

.sub-th {
  border-bottom: 2px solid var(--vp-c-border) !important;
  color: var(--vp-c-text-3) !important;
  font-size: 0.68rem !important;
}

.pair-col, .tag-col { white-space: nowrap; width: 1%; }

.tag-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border-radius: 4px;
  font-size: 0.78rem;
  font-family: var(--vp-font-family-mono);
}

/* ── Monthly PnL table ───────────────────────────────── */
.month-col-label {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.month-year-tag {
  font-size: 0.68rem;
  font-weight: 600;
  margin-left: 0.3rem;
}
.year-color-0 { color: #A0ABD9; }
.year-color-1 { color: #A0C9AB; }
.year-color-2 { color: #D9B8A0; }
.year-color-3 { color: #C4A0D9; }
</style>
