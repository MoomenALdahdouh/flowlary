import { beforeAll, describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const DIST_DIR = join(ROOT, 'extension/dist')

function walk(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

describe('Phase 23 release security scan', () => {
  beforeAll(() => {
    // Development `vite build` injects localhost hosts into dist. Release audit must
    // always evaluate FLOWLARY_RELEASE=1 production output (Phase 28 gate).
    // Force NODE_ENV=production — vitest sets NODE_ENV=test which would otherwise
    // bake http://127.0.0.1 into endpoints.ts even during release packaging.
    execSync('npm run build:release -w @flowlary/extension', {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, FLOWLARY_RELEASE: '1', NODE_ENV: 'production' },
    })
  }, 120_000)

  it('dist bundle contains no secrets or dev hosts', () => {
    const patterns = [/gsk_[a-zA-Z0-9]+/, /GROQ_API_KEY/, /api\.groq\.com/, /localhost/, /127\.0\.0\.1/]
    const files = walk(DIST_DIR).filter((file) => /\.(js|json|html|css)$/.test(file) && !file.endsWith('.map'))
    const hits: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      for (const pattern of patterns) {
        if (pattern.test(content)) hits.push(`${file}: ${pattern}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('production manifest uses api.flowlary.com only', () => {
    const manifest = JSON.parse(readFileSync(join(DIST_DIR, 'manifest.json'), 'utf8')) as {
      host_permissions?: string[]
    }
    expect(manifest.host_permissions).toEqual(['https://api.flowlary.com/*'])
  })
})
