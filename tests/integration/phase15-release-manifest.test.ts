import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const prodManifestPath = resolve(import.meta.dirname, '../../extension/manifest.prod.json')
const prodManifest = JSON.parse(readFileSync(prodManifestPath, 'utf8')) as {
  version: string
  host_permissions: string[]
  name: string
}

describe('Production manifest (release packaging)', () => {
  it('uses Flowlary product name', () => {
    expect(prodManifest.name).toBe('Flowlary')
  })

  it('has production HTTPS host permissions only', () => {
    expect(prodManifest.host_permissions).toEqual(['https://api.flowlary.com/*'])
    for (const host of prodManifest.host_permissions) {
      expect(host.startsWith('https://')).toBe(true)
    }
  })

  it('does not include localhost development hosts', () => {
    const joined = prodManifest.host_permissions.join(' ')
    expect(joined).not.toMatch(/localhost|127\.0\.0\.1/)
  })

  it('matches package version 1.1.0', () => {
    expect(prodManifest.version).toBe('1.1.0')
  })
})
