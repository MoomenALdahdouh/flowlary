import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BRAND } from '@flowlary/shared'

const extensionRoot = resolve(import.meta.dirname, '../../extension')
const repoRoot = resolve(import.meta.dirname, '../..')

function readJson(path: string): { version: string; host_permissions?: string[]; name?: string } {
  return JSON.parse(readFileSync(path, 'utf8')) as {
    version: string
    host_permissions?: string[]
    name?: string
  }
}

const extensionPkg = readJson(resolve(extensionRoot, 'package.json'))
const rootPkg = readJson(resolve(repoRoot, 'package.json'))
const prodManifest = readJson(resolve(extensionRoot, 'manifest.prod.json'))
const devManifest = readJson(resolve(extensionRoot, 'manifest.json'))

describe('Production manifest (release packaging)', () => {
  it('uses Flowlary product name', () => {
    expect(prodManifest.name).toBe('Flowlary')
  })

  it('has production HTTPS host permissions only', () => {
    expect(prodManifest.host_permissions).toEqual(['https://api.flowlary.com/*'])
    for (const host of prodManifest.host_permissions ?? []) {
      expect(host.startsWith('https://')).toBe(true)
    }
  })

  it('does not include localhost development hosts', () => {
    const joined = (prodManifest.host_permissions ?? []).join(' ')
    expect(joined).not.toMatch(/localhost|127\.0\.0\.1/)
  })

  it('matches the extension package version', () => {
    expect(extensionPkg.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(prodManifest.version).toBe(extensionPkg.version)
    expect(devManifest.version).toBe(extensionPkg.version)
    expect(rootPkg.version).toBe(extensionPkg.version)
    expect(BRAND.version).toBe(extensionPkg.version)
  })
})
