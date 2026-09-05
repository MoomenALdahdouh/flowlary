import { describe, expect, it } from 'vitest'
import { humanizePopupError } from '../../../extension/src/popup/api.ts'

describe('popup error copy', () => {
  it('maps production failures to understandable UI copy', () => {
    expect(humanizePopupError('AI_UNAVAILABLE')).toMatch(/try again/i)
    expect(humanizePopupError('AI_UNAVAILABLE')).not.toMatch(/plan|allowance|unchanged/i)
    expect(humanizePopupError('rate_limited')).toContain('too quickly')
    expect(humanizePopupError('AI_RATE_LIMITED')).toContain('too quickly')
    expect(humanizePopupError('usage_exhausted')).toContain("today's AI writing checks")
    expect(humanizePopupError('usage_exhausted')).not.toMatch(/temporarily unavailable/i)
    expect(humanizePopupError('usage_exhausted')).not.toMatch(/too quickly/i)
    expect(humanizePopupError('entitlement_denied')).toContain("today's AI writing checks")
    expect(humanizePopupError('account_required')).toContain('Sign in')
    expect(humanizePopupError('account_required')).not.toMatch(/Upgrade/i)
    expect(humanizePopupError('auth_failed')).toBe('Please sign in again.')
    expect(humanizePopupError('account_duplicate')).toContain('already registered')
    expect(humanizePopupError('invalid_email')).toContain('valid email')
    expect(humanizePopupError('network')).toContain("You're offline")
    expect(humanizePopupError('network')).not.toContain('dev:api')
    expect(humanizePopupError('AI_INVALID_RESPONSE')).toMatch(/try again|could not complete/i)
  })

  it('keeps credential rejection distinct from transport login failure', () => {
    const credentials = 'Incorrect email or password.'
    const transport = 'Could not sign in. Use flowlary.com or check your connection.'
    expect(humanizePopupError('account_credentials')).toBe(credentials)
    expect(humanizePopupError('account_login_invalid')).toBe(credentials)
    expect(humanizePopupError('account_login_failed')).toBe(transport)
    expect(humanizePopupError('account_login_failed')).not.toBe(credentials)
    expect(humanizePopupError('network')).toContain("You're offline")
    expect(humanizePopupError('network')).not.toBe(credentials)
    expect(humanizePopupError('network')).not.toContain('Incorrect email')
  })

  it('does not expose provider internals', () => {
    expect(humanizePopupError('AI_PROVIDER_ERROR')).not.toMatch(/groq/i)
    expect(humanizePopupError('AI_PROVIDER_ERROR')).not.toMatch(/stack/i)
  })
})
