import DefaultTheme from 'vitepress/theme'
import type { App } from 'vue'
import BenchmarkList from './BenchmarkList.vue'
import BenchmarkMeta from './BenchmarkMeta.vue'
import BenchmarkDetail from './BenchmarkDetail.vue'
import CoinIcon from './CoinIcon.vue'
import PairSymbol from './PairSymbol.vue'
import './custom.css'

export default {
  ...DefaultTheme,
  enhanceApp({ app }: { app: App }) {
    app.component('BenchmarkList', BenchmarkList)
    app.component('BenchmarkMeta', BenchmarkMeta)
    app.component('BenchmarkDetail', BenchmarkDetail)
    app.component('CoinIcon', CoinIcon)
    app.component('PairSymbol', PairSymbol)
  }
}
