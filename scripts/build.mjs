/**
 * Standalone build for the dsh-headroom-manager plugin (host half only).
 * The browser half (client/client.js) is hand-written and served as-is.
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

mkdirSync(join(root, 'lib'), { recursive: true })

await build({
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(root, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  external: ['@deepseek-ai/*'],
  sourcemap: true,
})

console.log('[dsh-headroom-manager] host built -> lib/index.js')
