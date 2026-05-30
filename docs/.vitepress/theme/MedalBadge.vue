<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useData } from 'vitepress'

const props = defineProps<{
  rank: 0 | 1 | 2
  profit: number
}>()

const MEDALS = ['🥇', '🥈', '🥉'] as const

const showRays = props.rank === 0 && props.profit > 50

// ── Sunbeam rays ──────────────────────────────────────
interface Ray {
  angle: number
  y1: number
  y2: number
  y2Min: number; y2Max: number
  width: number
  opMin: number; opMax: number
  opDur: number;  opDelay: number
  lenDur: number; lenDelay: number
  sharp: boolean  // ~25% of rays stay crisp in dark mode
}

function generateRays(): Ray[] {
  const n = 9 + Math.floor(Math.random() * 4)
  return Array.from({ length: n }, (_, i) => {
    const baseY2 = 9 + Math.random() * 4
    const baseOp = 0.3 + Math.random() * 0.45
    return {
      angle:    (360 / n) * i + (Math.random() - 0.5) * (360 / n) * 0.55,
      y1:       5 + Math.random() * 2,
      y2:       baseY2,
      y2Min:    +(baseY2 * 0.55).toFixed(2),
      y2Max:    +(baseY2 * 1.15).toFixed(2),
      width:    0.7 + Math.random() * 2,
      opMin:    +Math.max(0.05, baseOp - 0.25).toFixed(2),
      opMax:    +Math.min(0.90, baseOp + 0.25).toFixed(2),
      opDur:    +(0.6 + Math.random() * 2.2).toFixed(2),
      opDelay:  +((Math.random() - 0.5) * 6).toFixed(2),
      lenDur:   +(0.9 + Math.random() * 2.6).toFixed(2),
      lenDelay: +((Math.random() - 0.5) * 6).toFixed(2),
      sharp:    Math.random() < 0.28,
    }
  })
}

const sunRays = ref<Ray[]>([])
const { isDark } = useData()

// Generate client-side only — SSR would bake a fixed seed into the HTML,
// causing the same rays on every visit.
onMounted(() => {
  if (showRays) sunRays.value = generateRays()
})
</script>

<template>
  <span class="medal-badge">
    {{ MEDALS[rank] }}
    <svg
      v-if="showRays"
      class="rays-svg"
      viewBox="-18 -18 36 36"
      aria-hidden="true"
    >
      <defs>
        <!-- Soft rays: heavy blur in dark, light in light -->
        <filter id="rays-blur-soft">
          <feGaussianBlur :stdDeviation="isDark ? 2.5 : 0.3"/>
        </filter>
        <!-- Sharp rays: slightly softer than light mode, noticeably crisper than soft -->
        <filter id="rays-blur-sharp">
          <feGaussianBlur :stdDeviation="isDark ? 1.6 : 0.3"/>
        </filter>
      </defs>
      <g>
        <polygon
          v-for="(ray, ri) in sunRays"
          :key="ri"
          :points="`${-ray.width/2},${ray.y1} ${ray.width/2},${ray.y1} 0,${ray.y2}`"
          :filter="ray.sharp ? 'url(#rays-blur-sharp)' : 'url(#rays-blur-soft)'"
          :fill="isDark ? '#fef08a' : '#f59e0b'"
          :fill-opacity="isDark ? (ray.sharp ? ray.opMin * 0.55 : ray.opMin * 0.4) : ray.opMin"
          :transform="`rotate(${ray.angle})`"
        >
          <animate
            attributeName="fill-opacity"
            :values="isDark
              ? (ray.sharp
                  ? `${(ray.opMin*0.55).toFixed(2)};${(ray.opMax*0.55).toFixed(2)};${(ray.opMin*0.55).toFixed(2)}`
                  : `${(ray.opMin*0.4).toFixed(2)};${(ray.opMax*0.4).toFixed(2)};${(ray.opMin*0.4).toFixed(2)}`)
              : `${ray.opMin};${ray.opMax};${ray.opMin}`"
            :dur="`${ray.opDur}s`"
            :begin="`${ray.opDelay}s`"
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;0.5;1"
            keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
          />
          <animate
            attributeName="points"
            :values="[
              `${-ray.width/2},${ray.y1} ${ray.width/2},${ray.y1} 0,${ray.y2Min}`,
              `${-ray.width/2},${ray.y1} ${ray.width/2},${ray.y1} 0,${ray.y2Max}`,
              `${-ray.width/2},${ray.y1} ${ray.width/2},${ray.y1} 0,${ray.y2Min}`,
            ].join(';')"
            :dur="`${ray.lenDur}s`"
            :begin="`${ray.lenDelay}s`"
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;0.5;1"
            keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
          />
        </polygon>
      </g>
    </svg>
  </span>
</template>

<style scoped>
@keyframes sun-spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

.medal-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  isolation: isolate;
}

.rays-svg {
  position: absolute;
  top: 65%;
  left: 50%;
  width: 2.4rem;
  height: 2.4rem;
  transform: translate(-50%, -50%);
  animation: sun-spin 6s linear infinite;
  pointer-events: none;
  z-index: -1;
  overflow: visible;
  filter: drop-shadow(0 0 3px rgba(161, 82, 0, 0.6));
}

:global(.dark) .rays-svg {
  filter:
    drop-shadow(0 0 3px rgba(254, 240, 138, 0.5))
    drop-shadow(0 0 8px rgba(254, 240, 138, 0.2));
}
</style>
