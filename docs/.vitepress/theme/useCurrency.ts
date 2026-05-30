import { ref, computed } from 'vue'

// Update this rate as needed
const USD_TO_DKK = 6.9

type Currency = 'USD' | 'DKK'

// Module-level ref — shared across all component instances
const currency = ref<Currency>('USD')

// Hydrate from localStorage once on the client
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('bd-currency') as Currency | null
  if (stored === 'USD' || stored === 'DKK') currency.value = stored
}

export function useCurrency() {
  function toggle() {
    currency.value = currency.value === 'USD' ? 'DKK' : 'USD'
    if (typeof window !== 'undefined') {
      localStorage.setItem('bd-currency', currency.value)
    }
  }

  function convert(usdAmount: number): number {
    return currency.value === 'DKK' ? usdAmount * USD_TO_DKK : usdAmount
  }

  // Format a USD source value as the active currency, with sign prefix
  function fmtAbs(usdAmount: number): string {
    const val   = convert(usdAmount)
    const sign  = val >= 0 ? '+' : '-'
    const abs   = Math.abs(val)
    const sym   = currency.value === 'DKK' ? 'kr' : '$'
    const formatted = abs.toLocaleString('en', { maximumFractionDigits: 0 })
    return currency.value === 'DKK'
      ? `${sign}${formatted} ${sym}`
      : `${sign}${sym}${formatted}`
  }

  // Same but no forced sign (for balance display etc.)
  function fmtBalance(usdAmount: number): string {
    const val = convert(usdAmount)
    const abs = Math.abs(val)
    const sym = currency.value === 'DKK' ? 'kr' : '$'
    const formatted = abs.toLocaleString('en', { maximumFractionDigits: 0 })
    return currency.value === 'DKK' ? `${formatted} ${sym}` : `${sym}${formatted}`
  }

  const symbol   = computed(() => currency.value === 'DKK' ? 'kr' : '$')
  const isDKK    = computed(() => currency.value === 'DKK')

  return { currency, toggle, convert, fmtAbs, fmtBalance, symbol, isDKK }
}
