import { describe, expect, it } from 'vitest'
import {
  createDefaultEntitlement,
  isVerifiedPro,
  mergeUsageStates,
  normalizeEntitlement,
  normalizeUsageState,
  resolveEntitlementStatus,
} from '../../../extension/src/storage/entitlement.ts'
import {
  normalizeCorrection,
  normalizeSettings,
  normalizeTranslation,
} from '../../../extension/src/storage/schemas.ts'

describe('storage schemas', () => {
  it('falls back on malformed booleans', () => {
    const settings = normalizeSettings({ enabled: 'yes', excludedDomains: 'bad' })
    expect(settings.enabled).toBe(true)
    expect(settings.excludedDomains).toEqual([])
  })

  it('never grants pro from malformed license cache', () => {
    const entitlement = normalizeEntitlement({
      license: { cache: { valid: 'yes', status: 123, verifiedAt: 'now' } },
    })
    expect(entitlement.status).not.toBe('pro')
    expect(isVerifiedPro(entitlement.license.cache, Date.now())).toBe(false)
  })

  it('normalizes correction mode safely', () => {
    expect(normalizeCorrection({ mode: 'invalid' }).mode).toBe('direct')
    expect(normalizeCorrection({ mode: 'box' }).mode).toBe('box')
  })

  it('keeps live translation off unless explicitly enabled', () => {
    expect(normalizeTranslation({ liveEnabled: 'true' }).liveEnabled).toBe(false)
    expect(normalizeTranslation({ liveEnabled: true }).liveEnabled).toBe(true)
  })
})

describe('entitlement model', () => {
  it('mergeUsageStates is conservative', () => {
    const now = Date.now()
    const a = normalizeUsageState(
      { firstActivatedAt: now - 1000, usageBalanceMs: 5000, trialEndsAt: now + 10000 },
      now,
    )
    const b = normalizeUsageState(
      { firstActivatedAt: now - 5000, usageBalanceMs: 8000, trialEndsAt: now + 20000 },
      now,
    )
    const merged = mergeUsageStates(a, b)
    expect(merged.firstActivatedAt).toBeLessThanOrEqual(a.firstActivatedAt)
    expect(merged.usageBalanceMs).toBe(Math.min(a.usageBalanceMs, b.usageBalanceMs))
  })

  it('resolveEntitlementStatus fails closed without evidence', () => {
    const now = Date.now()
    const entitlement = createDefaultEntitlement(now)
    entitlement.usage.firstActivatedAt = now - 10 * 86400000
    entitlement.usage.trialEndsAt = now - 86400000
    entitlement.usage.usageBalanceMs = 0
    entitlement.license.cache = { valid: false, status: 'unknown', verifiedAt: 0 }
    expect(resolveEntitlementStatus(entitlement, now)).toBe('unknown')
  })
})
