<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'
import { useCurrency } from './useCurrency'

interface Trade {
  close_timestamp: number
  profit_abs: number
  is_open: boolean
}

const props = defineProps<{
  trades: Trade[]
  startingBalance: number
}>()

const W = 600, H = 110
const P = { t: 14, r: 12, b: 8, l: 12 }

const svgEl = ref<SVGSVGElement | null>(null)
const hoverSvgX = ref<number | null>(null)

const { convert, currency } = useCurrency()
const { isDark } = useData()

// Explicit colours — avoids SVG CSS fill inheritance issues in dark mode
const colLabel     = computed(() => isDark.value ? 'rgba(235,235,245,0.38)' : 'rgba(60,60,67,0.45)')
const colLabelIn   = computed(() => isDark.value ? 'rgba(235,235,245,0.70)' : 'rgba(60,60,67,0.70)')
const colKnockout  = computed(() => isDark.value ? '#1e1e20' : '#f6f6f7')

const fmtBal = (v: number) => {
  const cv  = convert(v)
  const abs = Math.abs(cv)
  const sign = cv < 0 ? '-' : ''
  const sym  = currency.value === 'DKK' ? 'kr' : '$'
  if (abs >= 1_000_000) return currency.value === 'DKK'
    ? `${sign}${(abs / 1_000_000).toFixed(2)}M ${sym}`
    : `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return currency.value === 'DKK'
    ? `${sign}${(abs / 1_000).toFixed(2)}k ${sym}`
    : `${sign}${sym}${(abs / 1_000).toFixed(2)}k`
  return currency.value === 'DKK'
    ? `${sign}${abs.toFixed(2)} ${sym}`
    : `${sign}${sym}${abs.toFixed(2)}`
}
const fmtShort = (v: number) => {
  const cv  = convert(v)
  const abs = Math.abs(cv)
  const sign = cv < 0 ? '-' : ''
  const sym  = currency.value === 'DKK' ? 'kr' : '$'
  if (abs >= 1_000_000) return currency.value === 'DKK'
    ? `${sign}${(abs / 1_000_000).toFixed(1)}M ${sym}`
    : `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return currency.value === 'DKK'
    ? `${sign}${(abs / 1_000).toFixed(0)}k ${sym}`
    : `${sign}${sym}${(abs / 1_000).toFixed(0)}k`
  return currency.value === 'DKK'
    ? `${sign}${abs.toFixed(0)} ${sym}`
    : `${sign}${sym}${abs.toFixed(0)}`
}
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

const chart = computed(() => {
  const closed = [...props.trades]
    .filter(t => !t.is_open)
    .sort((a, b) => a.close_timestamp - b.close_timestamp)
  if (closed.length < 2) return null

  let bal = props.startingBalance
  const pts: { ts: number; bal: number }[] = [{ ts: closed[0].close_timestamp, bal }]
  for (const t of closed) {
    bal += t.profit_abs
    pts.push({ ts: t.close_timestamp, bal })
  }

  const tsMin = pts[0].ts, tsMax = pts[pts.length - 1].ts
  const allBals = pts.map(p => p.bal)
  const bMin = Math.min(...allBals), bMax = Math.max(...allBals)
  const bRange = bMax - bMin || 1
  const gW = W - P.l - P.r, gH = H - P.t - P.b

  const toX = (ts: number) => P.l + ((ts - tsMin) / (tsMax - tsMin || 1)) * gW
  const toY = (b: number)  => P.t + gH - ((b - bMin) / bRange) * gH

  // ── Line segments split at startingBalance threshold ──────────────
  const segments: { pts: string; above: boolean }[] = []
  {
    let cur: string[] = []
    let isAbove = pts[0].bal >= props.startingBalance
    cur.push(`${toX(pts[0].ts).toFixed(1)},${toY(pts[0].bal).toFixed(1)}`)

    for (let i = 1; i < pts.length; i++) {
      const prevAbove = pts[i - 1].bal >= props.startingBalance
      const nextAbove = pts[i].bal >= props.startingBalance

      if (prevAbove !== nextAbove) {
        // Exact crossing point
        const t = (props.startingBalance - pts[i - 1].bal) / (pts[i].bal - pts[i - 1].bal)
        const tsCross = pts[i - 1].ts + t * (pts[i].ts - pts[i - 1].ts)
        const cx = toX(tsCross).toFixed(1)
        const cy = toY(props.startingBalance).toFixed(1)
        cur.push(`${cx},${cy}`)
        segments.push({ pts: cur.join(' '), above: isAbove })
        cur = [`${cx},${cy}`]
        isAbove = nextAbove
      }
      cur.push(`${toX(pts[i].ts).toFixed(1)},${toY(pts[i].bal).toFixed(1)}`)
    }
    if (cur.length > 1) segments.push({ pts: cur.join(' '), above: isAbove })
  }

  const bY = (P.t + gH).toFixed(1)
  const areaPts = `${P.l},${bY} ${pts.map(p => `${toX(p.ts).toFixed(1)},${toY(p.bal).toFixed(1)}`).join(' ')} ${(P.l + gW).toFixed(1)},${bY}`

  const finalBal = pts[pts.length - 1].bal
  const profitable = finalBal >= props.startingBalance

  const baseY = toY(props.startingBalance)
  // Only show the baseline label when it has enough clearance from the max/min labels.
  // yMax label baseline is at P.t+9, yMin is at P.t+gH-3; each label is ~8px tall.
  const showBase = baseY > P.t + 22 && baseY < P.t + gH - 14

  return {
    pts, toX, toY, gW, gH, tsMin, tsMax,
    segments, areaPts, profitable, finalBal,
    dotX: toX(tsMax), dotY: toY(finalBal),
    baseY, showBase,
    leftX: P.l, rightX: P.l + gW,
    bottomY: P.t + gH, topY: P.t,
    lblMax:   fmtShort(bMax),  yMax: P.t + 9,
    lblMin:   fmtShort(bMin),  yMin: P.t + gH - 3,
    lblBase:  fmtShort(props.startingBalance),
    dateStart: fmtDate(tsMin),
    dateEnd:   fmtDate(tsMax),
    pnl:    finalBal - props.startingBalance,
    pnlPct: (finalBal - props.startingBalance) / props.startingBalance * 100,
    tradeCount: closed.length,
  }
})

// ── Mouse handling ─────────────────────────────────────────────────────────
function handleMouseMove(e: MouseEvent) {
  const c = chart.value
  if (!c || !svgEl.value) return
  const pt = svgEl.value.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const { x: svgX } = pt.matrixTransform(svgEl.value.getScreenCTM()!.inverse())
  if (svgX < P.l || svgX > P.l + c.gW) { hoverSvgX.value = null; return }
  hoverSvgX.value = svgX
}
function handleMouseLeave() { hoverSvgX.value = null }

// ── Hovered point ──────────────────────────────────────────────────────────
const hoverPt = computed(() => {
  const c = chart.value
  if (hoverSvgX.value === null || !c) return null

  const frac = (hoverSvgX.value - P.l) / c.gW
  const ts   = c.tsMin + frac * (c.tsMax - c.tsMin)

  let i0 = 0
  for (let i = 0; i < c.pts.length - 1; i++) {
    if (c.pts[i].ts <= ts) i0 = i; else break
  }
  const i1 = Math.min(i0 + 1, c.pts.length - 1)

  let interpBal: number
  if (i0 === i1 || c.pts[i0].ts === c.pts[i1].ts) {
    interpBal = c.pts[i0].bal
  } else {
    const t = (ts - c.pts[i0].ts) / (c.pts[i1].ts - c.pts[i0].ts)
    interpBal = c.pts[i0].bal + t * (c.pts[i1].bal - c.pts[i0].bal)
  }

  const nearest = Math.abs(ts - c.pts[i0].ts) <= Math.abs(ts - c.pts[i1].ts)
    ? c.pts[i0] : c.pts[i1]
  const pnl = nearest.bal - props.startingBalance
  const pct = pnl / props.startingBalance * 100
  const profitable = interpBal >= props.startingBalance

  return {
    x: hoverSvgX.value,
    y: c.toY(interpBal),
    profitable,
    balLabel:  fmtBal(nearest.bal),
    pnlLabel:  `${pnl >= 0 ? '+' : ''}${fmtShort(pnl)}`,
    pctLabel:  `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
    dateLabel: fmtDate(nearest.ts),
    pnl,
  }
})
</script>

<template>
  <div v-if="chart" class="equity-wrap">

    <!-- Header -->
    <div class="equity-header">
      <span class="equity-title">Equity Curve</span>
      <template v-if="hoverPt">
        <span class="equity-date">{{ hoverPt.dateLabel }}</span>
        <span class="equity-bal">{{ hoverPt.balLabel }}</span>
        <span class="equity-pnl" :class="hoverPt.profitable ? 'pos' : 'neg'">
          {{ hoverPt.pnlLabel }}&nbsp;({{ hoverPt.pctLabel }})
        </span>
      </template>
      <template v-else>
        <span class="equity-trades">{{ chart.tradeCount }} trades</span>
        <span class="equity-pnl" :class="chart.profitable ? 'pos' : 'neg'">
          {{ chart.profitable ? '+' : '' }}{{ fmtShort(chart.pnl) }}
          &nbsp;({{ chart.profitable ? '+' : '' }}{{ chart.pnlPct.toFixed(2) }}%)
        </span>
      </template>
    </div>

    <!-- Chart -->
    <svg
      ref="svgEl"
      class="equity-svg"
      :viewBox="`0 0 ${W} ${H}`"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    >
      <defs>
        <linearGradient id="eq-grad-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(22,163,74,0.28)" />
          <stop offset="100%" stop-color="rgba(22,163,74,0.02)" />
        </linearGradient>
        <linearGradient id="eq-grad-dn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(220,38,38,0.28)" />
          <stop offset="100%" stop-color="rgba(220,38,38,0.02)" />
        </linearGradient>

        <!-- Clip paths for split area fill when baseline is visible -->
        <template v-if="chart.showBase">
          <clipPath id="eq-clip-above">
            <rect
              :x="chart.leftX" :y="chart.topY"
              :width="chart.gW" :height="chart.baseY - chart.topY"
            />
          </clipPath>
          <clipPath id="eq-clip-below">
            <rect
              :x="chart.leftX" :y="chart.baseY"
              :width="chart.gW" :height="chart.bottomY - chart.baseY"
            />
          </clipPath>
        </template>
      </defs>

      <!-- Area fill: two layers clipped at baseline, or single if baseline is off-range -->
      <template v-if="chart.showBase">
        <polygon :points="chart.areaPts" fill="url(#eq-grad-up)" stroke="none" clip-path="url(#eq-clip-above)" />
        <polygon :points="chart.areaPts" fill="url(#eq-grad-dn)" stroke="none" clip-path="url(#eq-clip-below)" />
      </template>
      <polygon v-else :points="chart.areaPts" :fill="chart.profitable ? 'url(#eq-grad-up)' : 'url(#eq-grad-dn)'" stroke="none" />

      <!-- Baseline reference -->
      <line
        v-if="chart.showBase"
        :x1="chart.leftX"  :y1="chart.baseY"
        :x2="chart.rightX" :y2="chart.baseY"
        class="baseline"
      />

      <!-- Equity line: one polyline per segment, green above / red below -->
      <polyline
        v-for="(seg, i) in chart.segments"
        :key="i"
        :points="seg.pts"
        fill="none"
        :class="seg.above ? 'line-up' : 'line-dn'"
      />

      <!-- Static end-dot -->
      <circle
        v-if="hoverSvgX === null"
        :cx="chart.dotX" :cy="chart.dotY" r="2"
        :class="chart.profitable ? 'dot-up' : 'dot-dn'"
      />

      <!-- Y-axis labels (inside chart) -->
      <text :x="chart.leftX + 4" :y="chart.yMax" class="lbl lbl-in" text-anchor="start"
        :style="{ fill: colLabelIn, stroke: colKnockout, paintOrder: 'stroke fill', strokeWidth: '3', strokeLinejoin: 'round' }"
      >{{ chart.lblMax }}</text>
      <text :x="chart.leftX + 4" :y="chart.yMin" class="lbl lbl-in" text-anchor="start"
        :style="{ fill: colLabelIn, stroke: colKnockout, paintOrder: 'stroke fill', strokeWidth: '3', strokeLinejoin: 'round' }"
      >{{ chart.lblMin }}</text>
      <text
        v-if="chart.showBase"
        :x="chart.leftX + 4" :y="chart.baseY - 2"
        class="lbl lbl-in lbl-base" text-anchor="start"
        :style="{ fill: colLabelIn, stroke: colKnockout, paintOrder: 'stroke fill', strokeWidth: '3', strokeLinejoin: 'round' }"
      >{{ chart.lblBase }}</text>


      <!-- Hover crosshair -->
      <g v-if="hoverPt">
        <line
          :x1="hoverPt.x" :y1="chart.topY"
          :x2="hoverPt.x" :y2="chart.bottomY"
          class="crosshair-v"
        />
        <line
          :x1="chart.leftX" :y1="hoverPt.y"
          :x2="chart.rightX" :y2="hoverPt.y"
          class="crosshair-h"
        />
        <circle
          :cx="hoverPt.x" :cy="hoverPt.y" r="3"
          :class="hoverPt.profitable ? 'dot-up' : 'dot-dn'"
          class="hover-dot"
        />
      </g>
    </svg>

    <!-- X-axis date labels as HTML — immune to SVG fill colour issues -->
    <div class="equity-dates">
      <span>{{ chart.dateStart }}</span>
      <span>{{ chart.dateEnd }}</span>
    </div>
  </div>
</template>

<style scoped>
.equity-wrap {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1.25rem;
}

.equity-dates {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0.75rem 0.35rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.65rem;
  color: var(--vp-c-text-3);
}

.equity-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--vp-c-border);
  min-height: 2.4rem;
}

.equity-title {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
  flex-shrink: 0;
}

.equity-trades,
.equity-date {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  margin-right: auto;
}

.equity-bal {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
  margin-right: auto;
}

.equity-pnl {
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  font-weight: 600;
}
.equity-pnl.pos { color: var(--bd-positive); }
.equity-pnl.neg { color: var(--bd-negative); }

.equity-svg {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
}

.equity-svg :deep(polygon) { stroke: none !important; }

.equity-svg :deep(.baseline) {
  stroke: var(--vp-c-text-3);
  stroke-width: 0.8;
  stroke-dasharray: 3 3;
}
.equity-svg :deep(.line-up) {
  stroke: var(--bd-positive);
  stroke-width: 1;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.equity-svg :deep(.line-dn) {
  stroke: var(--bd-negative);
  stroke-width: 1;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.equity-svg :deep(.dot-up)    { fill: var(--bd-positive); }
.equity-svg :deep(.dot-dn)    { fill: var(--bd-negative); }
.equity-svg :deep(.hover-dot) { stroke: var(--vp-c-bg); stroke-width: 1.5; }

.equity-svg :deep(.lbl) {
  font-size: 6px;
  font-family: var(--vp-font-family-mono);
}

.equity-svg :deep(.crosshair-v) {
  stroke: var(--vp-c-text-3);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  pointer-events: none;
}
.equity-svg :deep(.crosshair-h) {
  stroke: var(--vp-c-text-3);
  stroke-width: 0.6;
  stroke-dasharray: 2 4;
  pointer-events: none;
}
</style>
