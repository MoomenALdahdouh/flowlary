import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { FlowlaryStorage } from '../../extension/src/storage/index.ts'

describe('FlowlaryStorage', () => {
  it('uses isolated flowlary namespaces', () => {
    expect(STORAGE_KEYS.settings).toBe('flowlary.settings')
    expect(STORAGE_KEYS.correction).toBe('flowlary.correction')
    expect(STORAGE_KEYS.correctionGroqKey).toBe('flowlary.correction.groqKey')
    expect(STORAGE_KEYS.translation).toBe('flowlary.translation')
    expect(STORAGE_KEYS.layout).toBe('flowlary.layout')
    expect(STORAGE_KEYS.layoutProfile).toBe('flowlary.layout.profile')
    expect(STORAGE_KEYS.history).toBe('flowlary.history')
    expect(STORAGE_KEYS.entitlement).toBe('flowlary.entitlement')
    expect(STORAGE_KEYS.entitlementLicenseKey).toBe('flowlary.entitlement.licenseKey')
    expect(STORAGE_KEYS.migrations).toBe('flowlary.migrations.v1')
  })

  it('keys do not collide with legacy prefixes', () => {
    const legacy = ['ewa_settings', 'lingoProfile', 'autofixProfile', 'wordCacheV2']
    const flowlary = Object.values(STORAGE_KEYS)
    for (const key of legacy) {
      expect(flowlary.includes(key as typeof flowlary[number])).toBe(false)
    }
    for (const key of flowlary) {
      expect(key.startsWith('flowlary.')).toBe(true)
    }
  })

  it('storage abstraction exposes namespace snapshot helper', async () => {
    const storage = new FlowlaryStorage()
    const snapshot = await storage.getNamespaceSnapshot()
    expect(typeof snapshot).toBe('object')
  })
})
