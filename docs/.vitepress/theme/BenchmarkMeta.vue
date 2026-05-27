<script setup lang="ts">
import { useData, useRouter } from 'vitepress'

const { frontmatter: fm } = useData()
const router = useRouter()

function formatPct(v?: number | null) {
  if (v === undefined || v === null) return '—'
  return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'
}

function formatNum(v?: number | null, decimals = 2) {
  if (v === undefined || v === null) return '—'
  return Number(v).toFixed(decimals)
}
</script>

<template>
  <div class="benchmark-meta">
    <!-- Header row -->
    <div class="meta-header">
      <div class="meta-identity">
        <span class="strategy-badge">{{ fm.strategy ?? 'Unknown' }}</span>
        <span class="timeframe-badge">{{ fm.timeframe ?? '—' }}</span>
        <span class="timerange-badge">{{ fm.timerange ?? '—' }}</span>
      </div>
      <button class="back-btn" @click="router.go('/')">← All benchmarks</button>
    </div>

    <!-- Metrics grid -->
    <div class="metrics-grid">
      <div class="metric" :class="fm.profit >= 0 ? 'good' : 'bad'">
        <div class="metric-label">Total Profit</div>
        <div class="metric-value">{{ formatPct(fm.profit) }}</div>
        <div v-if="fm.profitUsdt != null" class="metric-sub">≈ ${{ Number(fm.profitUsdt).toLocaleString('en', { maximumFractionDigits: 2 }) }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Total Trades</div>
        <div class="metric-value">{{ fm.totalTrades?.toLocaleString() ?? '—' }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">{{ fm.winRate != null ? fm.winRate.toFixed(1) + '%' : '—' }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Sharpe Ratio</div>
        <div class="metric-value">{{ formatNum(fm.sharpe) }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Sortino Ratio</div>
        <div class="metric-value">{{ formatNum(fm.sortino) }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Calmar Ratio</div>
        <div class="metric-value">{{ formatNum(fm.calmar) }}</div>
      </div>
      <div class="metric" :class="fm.maxDrawdown != null && fm.maxDrawdown < -20 ? 'bad' : ''">
        <div class="metric-label">Max Drawdown</div>
        <div class="metric-value">{{ fm.maxDrawdown != null ? fm.maxDrawdown.toFixed(2) + '%' : '—' }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Avg Duration</div>
        <div class="metric-value small">{{ fm.avgDuration ?? '—' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.benchmark-meta {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem 1.5rem;
  margin-bottom: 2.5rem;
}

/* ── Header ──────────────────────────────────────────── */
.meta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.meta-identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.strategy-badge {
  display: inline-block;
  padding: 0.3rem 0.8rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 700;
}

.timeframe-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border-radius: 5px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
}

.timerange-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-3);
  border-radius: 5px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
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

/* ── Metrics grid ────────────────────────────────────── */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 1rem 0.75rem;
}

.metric {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  text-align: center;
}

.metric.good {
  border-color: var(--bd-positive-bg);
  background: var(--bd-positive-bg);
}

.metric.bad {
  border-color: var(--bd-negative-bg);
  background: var(--bd-negative-bg);
}

.metric-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
  margin-bottom: 0.35rem;
  white-space: nowrap;
}

.metric-value {
  font-size: 1.3rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
  line-height: 1.2;
}

.metric-value.small {
  font-size: 1rem;
}

.metric-sub {
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
  margin-top: 0.2rem;
  font-family: var(--vp-font-family-mono);
}

.metric.good .metric-value { color: var(--bd-positive); }
.metric.bad  .metric-value { color: var(--bd-negative); }
</style>
