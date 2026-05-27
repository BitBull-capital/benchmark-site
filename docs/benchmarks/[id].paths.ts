import { readdirSync } from 'fs'
import path from 'path'

/**
 * Generates one static page per backtest JSON in docs/public/benchmarks-data/.
 * The page is rendered from docs/benchmarks/[id].md at build time.
 */
export default {
  paths() {
    const dataDir = path.resolve(__dirname, '../public/benchmarks-data')

    let files: string[]
    try {
      files = readdirSync(dataDir).filter(
        f => f.match(/^backtest-result.*\.json$/) && !f.includes('_config')
      )
    } catch {
      return []
    }

    return files.map(f => ({
      params: { id: f.replace('.json', '') },
    }))
  },
}
