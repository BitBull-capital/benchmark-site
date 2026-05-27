<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, withBase } from 'vitepress'
import type { BenchmarkSummary } from '../../benchmarks.data'

const props = defineProps<{ benchmarks: BenchmarkSummary[] }>()

const router = useRouter()
const search = ref('')
const filterTimeframe = ref('')
const sortKey = ref<keyof BenchmarkSummary>('profit')
const sortDir = ref<1 | -1>(-1)

const timeframes = computed(() => {
  const tfs = new Set(props.benchmarks.map(b => b.timeframe).filter(Boolean))
  return Array.from(tfs).sort() as string[]
})

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

  if (filterTimeframe.value) {
    items = items.filter(b => b.timeframe === filterTimeframe.value)
  }

  items.sort((a, b) => {
    const va: any = a[sortKey.value]
    const vb: any = b[sortKey.value]
    if (va == null) return 1
    if (vb == null) return -1
    if (va < vb) return -1 * sortDir.value
    if (va > vb) return 1 * sortDir.value
    return 0
  })

  return items
})

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

const MEDALS = ['🥇', '🥈', '🥉'] as const

// Top 3 by profit across ALL benchmarks (ignores filters/sort)
const podium = computed(() => {
  const sorted = [...props.benchmarks]
    .filter(b => b.profit != null)
    .sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity))
    .slice(0, 3)
  const map = new Map<string, number>()
  sorted.forEach((b, i) => map.set(b.id, i))
  return map
})
</script>

<template>
  <div class="benchmark-list">
    <!-- Toolbar -->
    <div class="list-toolbar">
      <span class="result-count">{{ filtered.length }} result{{ filtered.length !== 1 ? 's' : '' }}</span>
      <div class="filters">
        <input
          v-model="search"
          type="search"
          placeholder="Search strategy…"
          class="search-input"
        />
        <select v-model="filterTimeframe" class="filter-select">
          <option value="">All timeframes</option>
          <option v-for="tf in timeframes" :key="tf" :value="tf">{{ tf }}</option>
        </select>
      </div>
    </div>

    <!-- Table -->
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
            <th class="sortable" @click="toggleSort('date')">
              Date <span class="sort-icon">{{ sortIcon('date') }}</span>
            </th>
            <th class="sortable num" @click="toggleSort('profit')">
              Profit % <span class="sort-icon">{{ sortIcon('profit') }}</span>
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
            v-for="b in filtered"
            :key="b.id"
            class="benchmark-row"
            @click="navigate(b.id)"
          >
            <td class="medal-td">
              <span v-if="podium.has(b.id)" class="medal">{{ MEDALS[podium.get(b.id)!] }}</span>
            </td>
            <td>
              <span class="strategy-badge">{{ b.strategy }}</span>
            </td>
            <td>
              <span class="timeframe-badge">{{ b.timeframe }}</span>
            </td>
            <td class="mono">{{ formatDate(b.date) }}</td>
            <td class="num">
              <span class="profit-pill" :class="profitClass(b.profit)">
                {{ formatPct(b.profit) }}
              </span>
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

          <tr v-if="filtered.length === 0">
            <td colspan="9" class="empty-state">
              <div class="empty-inner">
                <span class="empty-icon">📭</span>
                <p>No benchmark results found.</p>
                <p v-if="search || filterTimeframe" class="empty-hint">Try clearing your filters.</p>
                <p v-else class="empty-hint">Push a backtest result to see it listed here.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.benchmark-list {
  margin-top: 0.5rem;
}

/* ── Toolbar ─────────────────────────────────────────── */
.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.result-count {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.search-input,
.filter-select {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s;
  min-width: 0;
}

.search-input { width: 200px; }

.search-input:focus,
.filter-select:focus {
  border-color: var(--vp-c-brand-1);
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

/* ── Empty state ─────────────────────────────────────── */
.empty-state { text-align: center; padding: 0 !important; }

.empty-inner { padding: 3.5rem 1rem; }

.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
}

.empty-inner p { margin: 0.2rem 0; color: var(--vp-c-text-2); }

.empty-hint {
  font-size: 0.85rem;
  color: var(--vp-c-text-3) !important;
}
</style>
