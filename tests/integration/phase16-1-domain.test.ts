import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const prodManifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../extension/manifest.prod.json'), 'utf8'),
) as { host_permissions: string[] }

describe('Phase 16.1 — production domain', () => {
  it('release manifest uses api.flowlary.com', () => {
    expect(prodManifest.host_permissions).toContain('https://api.flowlary.com/*')
    expect(prodManifest.host_permissions.some((h) => h.includes('zaixos'))).toBe(false)
  })

  it('does not include legacy lingo-api host', () => {
    expect(prodManifest.host_permissions.some((h) => h.includes('lingo-api'))).toBe(false)
  })
})
