---
layout: page
---

<script setup>
import { useData, withBase } from 'vitepress'
import { ref, onMounted } from 'vue'

const { params } = useData()
const benchmarkData = ref(null)
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const url = withBase(`/benchmarks-data/${params.value.id}.json`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    // The JSON has a "strategy" key with one strategy entry
    const strategies = Object.values(json.strategy ?? {})
    benchmarkData.value = strategies[0] ?? null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<div class="detail-page">
  <div v-if="loading" class="loading-state">
    <span>⏳</span> Loading benchmark…
  </div>

  <div v-else-if="error" class="error-state">
    ⚠️ Failed to load benchmark data: {{ error }}
  </div>

  <BenchmarkDetail v-else-if="benchmarkData" :data="benchmarkData" />
</div>

<style>
.detail-page {
  padding-top: 1.5rem;
}

.loading-state,
.error-state {
  padding: 3rem;
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 1rem;
}

.error-state {
  color: #ef4444;
}
</style>
