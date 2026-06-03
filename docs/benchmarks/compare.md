---
layout: page
---

<script setup>
import { ref, onMounted } from 'vue'
import { withBase } from 'vitepress'

const dataA    = ref(null)
const dataB    = ref(null)
const idA      = ref('')
const idB      = ref('')
const loading  = ref(true)
const error    = ref(null)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  idA.value = params.get('a') ?? ''
  idB.value = params.get('b') ?? ''

  if (!idA.value || !idB.value) {
    error.value = 'No strategies selected. Go back and select two benchmarks to compare.'
    loading.value = false
    return
  }

  try {
    const [resA, resB] = await Promise.all([
      fetch(withBase(`/benchmarks-data/${idA.value}.json`)),
      fetch(withBase(`/benchmarks-data/${idB.value}.json`)),
    ])
    if (!resA.ok) throw new Error(`Could not load ${idA.value} (HTTP ${resA.status})`)
    if (!resB.ok) throw new Error(`Could not load ${idB.value} (HTTP ${resB.status})`)
    const [jsonA, jsonB] = await Promise.all([resA.json(), resB.json()])
    dataA.value = Object.values(jsonA.strategy ?? {})[0] ?? null
    dataB.value = Object.values(jsonB.strategy ?? {})[0] ?? null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<div class="compare-page">
  <div v-if="loading" class="cmp-loading">⏳ Loading benchmarks…</div>
  <div v-else-if="error" class="cmp-error">⚠️ {{ error }}</div>
  <BenchmarkCompare
    v-else-if="dataA && dataB"
    :data-a="dataA"
    :data-b="dataB"
    :id-a="idA"
    :id-b="idB"
  />
</div>

<style>
.compare-page { padding-top: 1rem; }
.cmp-loading, .cmp-error {
  padding: 3rem;
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 1rem;
}
.cmp-error { color: #ef4444; }
</style>
