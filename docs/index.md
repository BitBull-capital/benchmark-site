---
layout: page
title: Benchmark Hub
---

<script setup>
import { data as benchmarks } from './benchmarks.data.ts'
</script>

<div class="benchmark-page">
  <BenchmarkList :benchmarks="benchmarks" />
</div>

<style>
.benchmark-page {
  padding-top: 1.5rem;
}
</style>
