<script setup lang="ts">
import { computed } from 'vue'
import CoinIcon from './CoinIcon.vue'

const props = defineProps<{
  pair: string   // e.g. "BTC/USDT:USDT" or "BTCUSDT"
  size?: 'sm' | 'md'
}>()

const SYMBOL_QUOTES = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'EUR']

const parsed = computed(() => {
  // Strip futures settlement suffix: "BTC/USDT:USDT" → "BTC/USDT"
  const clean = props.pair.split(':')[0]
  const upper = clean.toUpperCase()

  if (upper.includes('/')) {
    const [base, quote] = upper.split('/')
    return { base, quote, label: `${base}/${quote}` }
  }

  const quote = SYMBOL_QUOTES.find(q => upper.endsWith(q))
  if (quote) {
    const base = upper.slice(0, -quote.length)
    return { base, quote, label: `${base}/${quote}` }
  }

  return { base: upper, quote: '', label: upper }
})
</script>

<template>
  <div class="pair-symbol">
    <div class="icons">
      <CoinIcon :symbol="parsed.base" :size="size ?? 'md'" />
      <CoinIcon
        v-if="parsed.quote"
        :symbol="parsed.quote"
        :size="size ?? 'md'"
        border
        class="icon-overlap"
      />
    </div>
    <span class="pair-label">{{ parsed.label }}</span>
  </div>
</template>

<style scoped>
.pair-symbol {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  gap: 0.5rem;
}

.icons {
  display: flex;
  align-items: center;
  /* Negative margin creates the overlapping stack */
}

.icon-overlap {
  margin-left: -6px;
}

.pair-label {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  white-space: nowrap;
}
</style>
