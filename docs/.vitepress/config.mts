import { defineConfig } from 'vitepress'
import { execFileSync } from 'child_process'
import { createWriteStream, mkdirSync } from 'fs'
import { resolve, basename } from 'path'
import { createReadStream } from 'fs'

// Extracts a single zip synchronously using the system `unzip` command.
function extractZip(zipPath: string, outDir: string) {
  const base = basename(zipPath, '.zip')
  mkdirSync(outDir, { recursive: true })
  try {
    execFileSync('unzip', ['-p', zipPath, `${base}.json`], {
      stdio: ['ignore', createWriteStream(resolve(outDir, `${base}.json`)) as any, 'ignore']
    })
    console.log(`[benchmarks] extracted ${base}.json`)
  } catch (e) {
    console.error(`[benchmarks] failed to extract ${zipPath}:`, e)
  }
}

const ROOT       = resolve(__dirname, '../..')
const BENCH_DIR  = resolve(ROOT, 'benchmarks')
const OUT_DIR    = resolve(__dirname, '../public/benchmarks-data')

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/benchmark-site/',
  title: "Benchmark Hub",
  description: "Trading strategy backtest benchmark results",
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/benchmark-site/favicon.svg' }]
  ],
  themeConfig: {
    siteTitle: false,

    // No sidebar — benchmarks use their own navigation
    sidebar: {},

  },

  vite: {
    plugins: [
      {
        name: 'watch-benchmarks',
        configureServer(server) {
          // Extend the watcher to the benchmarks folder outside docs/
          server.watcher.add(`${BENCH_DIR}/*.zip`)

          server.watcher.on('add', (file) => {
            if (!file.startsWith(BENCH_DIR) || !file.endsWith('.zip')) return
            extractZip(file, OUT_DIR)
            // Invalidate the data loader so the index page picks up the new entry
            const dataModule = server.moduleGraph.getModulesByFile(
              resolve(__dirname, '../benchmarks.data.ts')
            )
            dataModule?.forEach(m => server.moduleGraph.invalidateModule(m))
            server.ws.send({ type: 'full-reload' })
          })
        }
      }
    ]
  }
})
