import { describe, expect, it } from 'vitest'
import { evaluateFeatureAccess, tierAllowsAi } from '@flowlary/shared'

describe('entitlement policy', () => {
  it('allows AI features for trial, free, and pro', () => {
    for (const tier of ['trial', 'free', 'pro'] as const) {
      expect(evaluateFeatureAccess('correction', tier).allowed).toBe(true)
    }
  })

  it('denies AI for unknown tier', () => {
    const result = evaluateFeatureAccess('translation', 'unknown')
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toBe('unknown_plan')
  })

  it('denies Groq AI when free usage balance is exhausted, but keeps Google translation', () => {
    const correction = evaluateFeatureAccess('correction', 'free', { usageBalanceMs: 0 })
    expect(correction.allowed).toBe(false)
    if (!correction.allowed) expect(correction.reason).toBe('usage_exhausted')

    const translation = evaluateFeatureAccess('translation', 'free', { usageBalanceMs: 0 })
    expect(translation.allowed).toBe(true)
  })

  it('denies trial/pro AI when credits are exhausted', () => {
    for (const tier of ['trial', 'pro'] as const) {
      const result = evaluateFeatureAccess('correction', tier, { creditsRemaining: 0 })
      expect(result.allowed).toBe(false)
      if (!result.allowed) expect(result.reason).toBe('usage_exhausted')
    }
  })

  it('allows local layout without AI tier checks', () => {
    expect(evaluateFeatureAccess('layout_auto', 'unknown').allowed).toBe(true)
  })

  it('tierAllowsAi excludes unknown', () => {
    expect(tierAllowsAi('unknown')).toBe(false)
    expect(tierAllowsAi('pro')).toBe(true)
  })
})
