<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, withBase, useData } from 'vitepress'
import type { BenchmarkSummary } from '../../benchmarks.data'
import { useCurrency } from './useCurrency'

const props = defineProps<{ benchmarks: BenchmarkSummary[] }>()

const router = useRouter()
const { isDark } = useData()
const { currency, toggle: toggleCurrency, convert } = useCurrency()

function fmtPnl(usd: number): string {
  const val = convert(usd)
  const abs = Math.abs(val)
  const sign = val >= 0 ? '+' : '-'
  const sym  = currency.value === 'DKK' ? 'kr' : '$'
  let formatted: string
  if (abs >= 1_000_000)     formatted = (abs / 1_000_000).toFixed(1) + 'M'
  else if (abs >= 1_000)    formatted = (abs / 1_000).toFixed(1) + 'k'
  else                      formatted = abs.toFixed(0)
  return currency.value === 'DKK' ? `${sign}${formatted} ${sym}` : `${sign}${sym}${formatted}`
}
const search = ref('')
const sortKey = ref<keyof BenchmarkSummary>('profit')
const sortDir = ref<1 | -1>(-1)

// Canonical timeframe order — unknown TFs fall to the end
const TF_ORDER = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w']
function tfRank(tf: string) {
  const i = TF_ORDER.indexOf(tf)
  return i === -1 ? 999 : i
}

// Timeframes that always get a section, even when empty
const PINNED_TFS = ['1m', '5m', '15m', '30m']

const filtered = computed(() => {
  let items = [...props.benchmarks]
  if (search.value) {
    const q = search.value.toLowerCase()
    items = items.filter(b =>
      b.strategy.toLowerCase().includes(q) ||
      b.timerange.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q)
    )
  }
  return items
})

// Groups sorted by canonical TF order; rows within each group sorted by current sort state
const groups = computed(() => {
  const map = new Map<string, BenchmarkSummary[]>()

  // Seed pinned timeframes so they always appear
  for (const tf of PINNED_TFS) map.set(tf, [])

  for (const b of filtered.value) {
    if (!map.has(b.timeframe)) map.set(b.timeframe, [])
    map.get(b.timeframe)!.push(b)
  }

  const sorted = [...map.entries()].sort(([a], [b]) => tfRank(a) - tfRank(b))

  return sorted.map(([tf, rows]) => {
    const sortedRows = [...rows].sort((a, b) => {
      const va: any = a[sortKey.value]
      const vb: any = b[sortKey.value]
      if (va == null) return 1
      if (vb == null) return -1
      if (va < vb) return -1 * sortDir.value
      if (va > vb) return 1 * sortDir.value
      return 0
    })
    // Top 3 by profit within this timeframe group — only positive profit earns a medal
    const byProfit = [...rows]
      .filter(b => b.profit != null && b.profit > 0)
      .sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity))
      .slice(0, 3)
    const podium = new Map<string, number>()
    byProfit.forEach((b, i) => podium.set(b.id, i))
    return { tf, rows: sortedRows, podium }
  })
})

const totalFiltered = computed(() => filtered.value.length)

function navigate(id: string) {
  router.go(withBase(`/benchmarks/${id}`))
}

function toggleSort(key: keyof BenchmarkSummary) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === -1 ? 1 : -1
  } else {
    sortKey.value = key
    sortDir.value = -1
  }
}

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPct(v?: number | null) {
  if (v === undefined || v === null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function profitClass(v?: number | null) {
  if (v === undefined || v === null) return ''
  return v >= 0 ? 'positive' : 'negative'
}

function sortIcon(key: string) {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === -1 ? '↓' : '↑'
}

function formatPeriod(days: number): string {
  if (!days) return '—'
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
  return parts.length ? parts.join(' ') : '—'
}

const MEDALS = ['🥇', '🥈', '🥉'] as const

// ── Equity sparklines ─────────────────────────────────
function sparklinePts(curve: number[]): string {
  const n = curve.length
  if (n < 2) return '26,9'
  const minV = Math.min(...curve), maxV = Math.max(...curve)
  const range = maxV - minV || 1
  return curve.map((v, i) => {
    const x = (i / (n - 1)) * 52
    const y = 16 - ((v - minV) / range) * 14
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function sparklineColor(curve: number[]): string {
  if (curve.length < 2) return 'var(--vp-c-text-3)'
  return curve[curve.length - 1] >= curve[0] ? 'var(--bd-positive)' : 'var(--bd-negative)'
}
</script>

<template>
  <div class="benchmark-list">
    <h1 class="page-title">Benchmark Hub</h1>

    <!-- Toolbar -->
    <div class="list-toolbar">
      <span class="result-count">{{ totalFiltered }} result{{ totalFiltered !== 1 ? 's' : '' }}</span>
      <div class="toolbar-right">
        <input
          v-model="search"
          type="search"
          placeholder="Search strategy…"
          class="search-input"
        />
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
          <!-- Sun (shown in dark mode → click to go light) -->
          <svg v-if="isDark" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <!-- Moon (shown in light mode → click to go dark) -->
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Empty state (no data at all) -->
    <div v-if="groups.length === 0" class="empty-outer">
      <span class="empty-icon">📭</span>
      <p>No benchmark results found.</p>
      <p v-if="search" class="empty-hint">Try clearing your search.</p>
      <p v-else class="empty-hint">Push a backtest result to see it listed here.</p>
    </div>

    <!-- One section per timeframe -->
    <section v-for="group in groups" :key="group.tf" class="tf-section">
      <div class="tf-heading">
        <span class="tf-label">{{ group.tf }}</span>
        <span class="tf-count">{{ group.rows.length }} run{{ group.rows.length !== 1 ? 's' : '' }}</span>
      </div>

      <div class="table-wrap">
        <table class="benchmark-table">
          <thead>
            <tr>
              <th class="medal-th"></th>
              <th class="sortable" @click="toggleSort('strategy')">
                Strategy <span class="sort-icon">{{ sortIcon('strategy') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('timeframe')">
                TF <span class="sort-icon">{{ sortIcon('timeframe') }}</span>
              </th>
              <th class="trend-th" title="Profit trend across runs of the same strategy &amp; timeframe">Trend</th>
              <th class="sortable" @click="toggleSort('backtestDays')">
                Period <span class="sort-icon">{{ sortIcon('backtestDays') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('date')">
                Date <span class="sort-icon">{{ sortIcon('date') }}</span>
              </th>
              <th class="sortable num" @click="toggleSort('profit')">
                Profit % <span class="sort-icon">{{ sortIcon('profit') }}</span>
              </th>
              <th class="sortable num" @click="toggleSort('profitUsdt')">
                PnL {{ currency }} <span class="sort-icon">{{ sortIcon('profitUsdt') }}</span>
              </th>
              <th class="sortable num" @click="toggleSort('totalTrades')">
                Trades <span class="sort-icon">{{ sortIcon('totalTrades') }}</span>
              </th>
              <th class="sortable num" @click="toggleSort('winRate')">
                Win Rate <span class="sort-icon">{{ sortIcon('winRate') }}</span>
              </th>
              <th class="sortable num" @click="toggleSort('sharpe')">
                Sharpe <span class="sort-icon">{{ sortIcon('sharpe') }}</span>
              </th>
              <th class="sortable num" @click="toggleSort('maxDrawdown')">
                Max DD <span class="sort-icon">{{ sortIcon('maxDrawdown') }}</span>
              </th>
              <th class="arrow-th"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in group.rows"
              :key="b.id"
              class="benchmark-row"
              @click="navigate(b.id)"
            >
              <td class="medal-td">
                <MedalBadge
                  v-if="group.podium.has(b.id)"
                  :rank="(group.podium.get(b.id) as 0|1|2)"
                  :profit="b.profit ?? 0"
                />
              </td>
              <td>
                <span class="strategy-badge">{{ b.strategy }}</span>
              </td>
              <td>
                <span class="timeframe-badge">{{ b.timeframe }}</span>
              </td>
              <td class="trend-td">
                <svg class="sparkline" viewBox="0 0 52 18" aria-hidden="true">
                  <polyline
                    :points="sparklinePts(b.equityCurve)"
                    fill="none"
                    :stroke="sparklineColor(b.equityCurve)"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                </svg>
              </td>
              <td class="mono period-cell">{{ formatPeriod(b.backtestDays) }}</td>
              <td class="mono">{{ formatDate(b.date) }}</td>
              <td class="num">
                <span class="profit-pill" :class="profitClass(b.profit)">
                  {{ formatPct(b.profit) }}
                </span>
              </td>
              <td class="mono num" :class="profitClass(b.profitUsdt)">
                {{ b.profitUsdt != null ? fmtPnl(b.profitUsdt) : '—' }}
              </td>
              <td class="mono num">{{ b.totalTrades?.toLocaleString() ?? '—' }}</td>
              <td class="mono num">
                {{ b.winRate != null ? b.winRate.toFixed(1) + '%' : '—' }}
              </td>
              <td class="mono num">{{ b.sharpe?.toFixed(2) ?? '—' }}</td>
              <td class="mono num" :class="profitClass(b.maxDrawdown)">
                {{ b.maxDrawdown != null ? b.maxDrawdown.toFixed(2) + '%' : '—' }}
              </td>
              <td class="arrow-td">
                <span class="arrow">→</span>
              </td>
            </tr>

            <tr v-if="group.rows.length === 0" class="empty-row">
              <td colspan="13" class="empty-tf">No runs yet</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.benchmark-list {
  margin-top: 0.5rem;
}

.page-title {
  font-family: 'Space Grotesk', var(--vp-font-family-base);
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 1.5rem 0 1.25rem;
  border: none !important;
  padding: 0 !important;

  /* Gradient text */
  background: linear-gradient(120deg, #16a34a 0%, #2563eb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

:global(.dark) .page-title {
  background: linear-gradient(120deg, #4ade80 0%, #60a5fa 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

/* ── Toolbar ─────────────────────────────────────────── */
.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.result-count {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-input {
  height: 2rem;
  box-sizing: border-box;
  padding: 0 0.75rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s;
  width: 200px;
}

.search-input:focus {
  border-color: var(--vp-c-brand-1);
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

/* Sun icon — fill the circle */
.theme-toggle svg circle {
  fill: currentColor;
  stroke: none;
}

/* ── Timeframe section ───────────────────────────────── */
.tf-section {
  margin-bottom: 2.5rem;
}

.tf-heading {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}

.tf-label {
  font-family: var(--vp-font-family-mono);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.tf-count {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
}

/* ── Table ───────────────────────────────────────────── */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
}

.benchmark-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.benchmark-table thead tr {
  background: var(--vp-c-bg-soft);
  border-bottom: 2px solid var(--vp-c-border);
}

.benchmark-table th {
  padding: 0.32rem 0.85rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  user-select: none;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-left: none;
  border-right: none;
}

.benchmark-table th.num { text-align: right; }

.benchmark-table th.sortable { cursor: pointer; }

.benchmark-table th.sortable:hover { color: var(--vp-c-text-1); }

.sort-icon {
  font-size: 0.7rem;
  margin-left: 3px;
  opacity: 0.45;
}

/* ── Rows ────────────────────────────────────────────── */
.benchmark-row {
  cursor: pointer;
  border-bottom: 1px solid var(--vp-c-divider);
  transition: background 0.12s;
}

.benchmark-row:last-child { border-bottom: none; }

.benchmark-row:hover { background: var(--vp-c-bg-soft); }

.benchmark-table td {
  padding: 0.32rem 0.85rem;
  color: var(--vp-c-text-1);
  vertical-align: middle;
  white-space: nowrap;
  border-left: none;
  border-right: none;
}

.benchmark-table td.num { text-align: right; }

.mono {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
}

/* ── Badges ──────────────────────────────────────────── */
.strategy-badge {
  display: inline-block;
  vertical-align: middle;
  padding: 0.2rem 0.65rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-radius: 5px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

/* ── Timeframe badge ─────────────────────────────────── */
.timeframe-badge {
  display: inline-block;
  vertical-align: middle;
  padding: 0.2rem 0.5rem;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border-radius: 5px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
  white-space: nowrap;
}

/* ── Colors ──────────────────────────────────────────── */
.profit-pill {
  display: inline-block;
  vertical-align: middle;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.profit-pill.positive { color: var(--bd-positive); }
.profit-pill.negative { color: var(--bd-negative); }

.benchmark-table td.positive { color: var(--bd-positive); }
.benchmark-table td.negative { color: var(--bd-negative); }

/* ── Trend sparkline ─────────────────────────────────── */
.trend-th {
  width: 60px;
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.trend-td {
  width: 60px;
  padding-top: 0;
  padding-bottom: 0;
}
.sparkline {
  display: block;
  width: 52px;
  height: 18px;
}

/* ── Period ──────────────────────────────────────────── */
.period-cell {
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

/* ── Medal ───────────────────────────────────────────── */
.medal-th { width: 1.5rem; padding: 0; }
.medal-td { width: 1.5rem; text-align: center; padding: 0 0 0 0.5rem; }
.medal     { font-size: 1rem; line-height: 1; }

/* ── Arrow ───────────────────────────────────────────── */
.arrow-th { width: 2rem; }

.arrow-td {
  text-align: right;
  padding-right: 1rem;
}

.arrow {
  color: var(--vp-c-text-3);
  transition: color 0.15s, transform 0.15s;
  display: inline-block;
  font-size: 1rem;
}

.benchmark-row:hover .arrow {
  color: var(--vp-c-brand-1);
  transform: translateX(4px);
}


/* ── Empty tf row ────────────────────────────────────── */
.empty-tf {
  padding: 1rem 0.85rem !important;
  color: var(--vp-c-text-3);
  font-size: 0.82rem;
  font-style: italic;
}

/* ── Empty state ─────────────────────────────────────── */
.empty-outer {
  text-align: center;
  padding: 3.5rem 1rem;
}

.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
}

.empty-outer p { margin: 0.2rem 0; color: var(--vp-c-text-2); }

.empty-hint {
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
}
</style>
