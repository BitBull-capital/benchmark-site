<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { withBase } from 'vitepress'

const props = defineProps<{
  symbol: string
  size?: 'sm' | 'md'
  border?: boolean
}>()

const ASSET_COLORS: Record<string, string> = {
  BTC: '#f59e0b',
  ETH: '#6366f1',
  SOL: '#14b8a6',
  BNB: '#facc15',
  XRP: '#38bdf8',
  ADA: '#22c55e',
  DOGE: '#f97316',
  AVAX: '#ef4444',
  MATIC: '#a855f7',
  LTC: '#94a3b8',
  XMR: '#f97316',
  BCH: '#22c55e',
  USDT: '#26a17b',
  USDC: '#2775ca',
}

const error = ref(false)

// Reset error state when symbol changes
watch(() => props.symbol, () => { error.value = false })

const iconSrc = computed(() =>
  withBase(`/coins/${encodeURIComponent(props.symbol.toLowerCase())}.svg`)
)

const fallbackColor = computed(() =>
  ASSET_COLORS[props.symbol.toUpperCase()] ?? '#64748b'
)

const sizeClass = computed(() =>
  props.size === 'sm' ? 'coin-sm' : 'coin-md'
)
</script>

<template>
  <img
    v-if="!error"
    :src="iconSrc"
    :alt="symbol"
    :class="['coin-icon', sizeClass, border ? 'coin-border' : '']"
    @error="error = true"
  />
  <span
    v-else
    :class="['coin-fallback', sizeClass]"
    :style="{ backgroundColor: fallbackColor }"
  >
    {{ symbol.slice(0, 1).toUpperCase() }}
  </span>
</template>

<style scoped>
.coin-icon,
.coin-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.coin-md { width: 22px; height: 22px; font-size: 9px; }
.coin-sm { width: 18px; height: 18px; font-size: 8px; }

.coin-fallback {
  color: #fff;
  font-weight: 700;
  font-family: var(--vp-font-family-base);
}

.coin-border {
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
}
</style>
