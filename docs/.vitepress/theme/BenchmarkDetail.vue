<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, withBase } from 'vitepress'

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
  results_per_pair: ResultRow[]
  results_per_enter_tag: ResultRow[]
  exit_reason_summary: ResultRow[]
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
  trading_mode: string
  margin_mode: string
  minimal_roi: Record<string, number>
}

const props = defineProps<{ data: StrategyData }>()
const router = useRouter()

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

function pct(v: number, decimals = 2) {
  if (v === undefined || v === null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(decimals) + '%'
}

function num(v: number, decimals = 2) {
  if (v === undefined || v === null) return '—'
  return v.toFixed(decimals)
}

function abs(v: number) {
  if (v === undefined || v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return sign + '$' + Math.abs(v).toLocaleString('en', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function pc(v: number) { return pct(v * 100) }

function formatPeriod(days: number): string {
  if (!days) return ''
  const y = Math.floor(days / 365)
  const rem1 = days - y * 365
  const mo = Math.floor(rem1 / 30)
  const rem2 = rem1 - mo * 30
  const w = Math.floor(rem2 / 7)
  const d = rem2 % 7
  const parts: string[] = []
  if (y)  parts.push(`${y}y`)
  if (mo) parts.push(`${mo}m`)
  if (w)  parts.push(`${w}w`)
  if (d)  parts.push(`${d}d`)
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
    </div>

    <!-- Backtest config card -->
    <details class="config-card">
      <summary class="config-header">
        <span class="config-title">
          <span class="config-chevron">▶</span> backtest.config.json
        </span>
        <span class="config-lang">JSON</span>
      </summary>
      <pre class="config-pre"><code v-html="highlightJson(configJson)" /></pre>
    </details>

    <!-- Key metrics card -->
    <div class="meta-card">
      <div class="meta-top">
        <div class="meta-badges">
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
              <td class="mt-name">Balance</td>
              <td class="mt-desc">Final portfolio value at the end of the backtest, starting from the initial balance.</td>
              <td class="mt-thresh mt-no-thresh">—</td>
              <td class="mt-value">
                <span class="mt-primary mt-mono">${{ s.final_balance?.toLocaleString('en', { maximumFractionDigits: 0 }) }}</span>
                <span class="mt-secondary">from ${{ s.starting_balance?.toLocaleString('en', { maximumFractionDigits: 0 }) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

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
              <th class="sortable num" @click="pairSort.toggle('profit_total_abs')">Total Profit $ <span class="sort-icon">{{ pairSort.icon('profit_total_abs') }}</span></th>
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
              <th class="sortable num" @click="enterSort.toggle('profit_total_abs')">Total Profit $ <span class="sort-icon">{{ enterSort.icon('profit_total_abs') }}</span></th>
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
              <th class="sortable num" @click="exitSort.toggle('profit_total_abs')">Total Profit $ <span class="sort-icon">{{ exitSort.icon('profit_total_abs') }}</span></th>
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

/* ── Header ──────────────────────────────────────────── */
.detail-header {
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

.back-btn:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

/* ── Config card (JSON viewer) ───────────────────────── */
.config-card {
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1.25rem;
  font-size: 0.85rem;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
  cursor: pointer;
  list-style: none;
  user-select: none;
}

/* Remove default triangle on all browsers */
.config-header::-webkit-details-marker { display: none; }
.config-header::marker { display: none; }

.config-card[open] .config-header {
  border-bottom: 1px solid var(--vp-c-border);
}

.config-card:not([open]) .config-header {
  border-bottom: none;
}

.config-title {
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.config-chevron {
  font-size: 0.6rem;
  color: var(--vp-c-text-3);
  transition: transform 0.2s;
  display: inline-block;
}

.config-card[open] .config-chevron {
  transform: rotate(90deg);
}

.config-lang {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
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
  padding: 0.55rem 1rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mt-th-desc  { width: 100%; }
.mt-th-value { text-align: right; white-space: nowrap; }

.metrics-table tr {
  border-bottom: 1px solid var(--vp-c-divider);
}

.metrics-table tbody tr:last-child { border-bottom: none; }

.metrics-table tbody tr:hover { background: var(--vp-c-bg-soft); }

.mt-name {
  padding: 0.65rem 1rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  width: 1%;
  vertical-align: middle;
}

.mt-value {
  padding: 0.65rem 1rem;
  text-align: right;
  white-space: nowrap;
  width: 1%;
  vertical-align: middle;
}

.mt-value.positive { color: var(--bd-positive); }
.mt-value.neutral  { color: var(--bd-neutral); }
.mt-value.negative { color: var(--bd-negative); }

.mt-value.tier-bad           { color: var(--bd-tier-bad); }
.mt-value.tier-ok            { color: var(--bd-tier-ok); }
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
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
  margin-top: 0.15rem;
  font-family: var(--vp-font-family-mono);
}

.mt-desc {
  padding: 0.65rem 1rem;
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
  line-height: 1.5;
  width: 100%;
  vertical-align: middle;
}

.mt-th-thresh { white-space: nowrap; }

.mt-thresh {
  padding: 0.65rem 1rem;
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
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin: 0 !important;
}

.table-wrap thead tr {
  background: var(--vp-c-bg-soft);
  border-bottom: 2px solid var(--vp-c-border);
}

.table-wrap th {
  padding: 0.6rem 0.85rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  font-size: 0.78rem;
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
  padding: 0.6rem 0.85rem;
  color: var(--vp-c-text-1);
  vertical-align: middle;
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

.pair-key {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

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
</style>
