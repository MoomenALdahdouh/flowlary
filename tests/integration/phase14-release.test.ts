/**
 * Phase 14 — release readiness: build artifacts and manifest.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const dist = resolve(root, 'extension/dist')
const sourceManifest = resolve(root, 'extension/manifest.json')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

describe('Phase 14 — release readiness', () => {
  it('production build completes', () => {
    execSync('npm run build -w @flowlary/extension', { cwd: root, stdio: 'pipe', timeout: 120_000 })
    expect(statSync(dist).isDirectory()).toBe(true)
  }, 130_000)

  it('dist contains required extension entry points', () => {
    const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')) as {
      background: { service_worker: string }
      action: { default_popup: string }
      content_scripts: Array<{ js: string[] }>
    }
    expect(manifest.background.service_worker).toBeTruthy()
    expect(readFileSync(join(dist, manifest.background.service_worker), 'utf8').length).toBeGreaterThan(0)
    expect(manifest.content_scripts.length).toBeGreaterThanOrEqual(1)
    for (const js of manifest.content_scripts[0].js) {
      expect(readFileSync(join(dist, js), 'utf8').length).toBeGreaterThan(0)
    }
    const popupPath = manifest.action.default_popup
    expect(readFileSync(join(dist, popupPath), 'utf8').toLowerCase()).toContain('<!doctype html>')
  })

  it('manifest version and CSP are production-safe', () => {
    const built = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')) as {
      version: string
      content_security_policy?: { extension_pages?: string }
      permissions: string[]
    }
    const source = JSON.parse(readFileSync(sourceManifest, 'utf8')) as { version: string }
    expect(built.version).toBe(source.version)
    expect(built.content_security_policy?.extension_pages).toContain("script-src 'self'")
    expect(built.permissions).not.toContain('<all_urls>')
  })

  it('dist does not bundle test files', () => {
    const files = walk(dist)
    expect(files.some((f) => f.includes('.test.'))).toBe(false)
    expect(files.some((f) => f.includes('vitest'))).toBe(false)
  })

  it('dist has no hardcoded API key material', () => {
    const files = walk(dist).filter((f) => /\.(js|json|html)$/.test(f))
    const keyPatterns = [
      /gsk_[A-Za-z0-9]{20,}/,
      /sk-[A-Za-z0-9]{20,}/,
      /GROQ_API_KEY\s*=\s*['"][^'"]+['"]/,
      /Bearer gsk_/,
    ]
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      for (const pattern of keyPatterns) {
        expect(pattern.test(content), `${file} matched ${pattern}`).toBe(false)
      }
    }
  })

  it('icons referenced by manifest exist', () => {
    const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')) as {
      icons: Record<string, string>
    }
    for (const icon of Object.values(manifest.icons)) {
      expect(statSync(join(dist, icon)).isFile()).toBe(true)
    }
  })
})
