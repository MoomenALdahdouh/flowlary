import { describe, expect, it } from 'vitest'
import { resolveWritingLabGate, validateWritingLabInput } from './writingLabState.ts'

describe('resolveWritingLabGate', () => {
  const account = {
    id: 'acc-1',
    email: 'a@test.com',
    plan: 'free',
    status: 'free',
    inTrial: false,
    isPro: false,
    remainingMs: 0,
    creditsRemaining: 10,
    billingAvailable: false,
  }

  it('requires auth when signed out', () => {
    expect(
      resolveWritingLabGate({
        sessionChecking: false,
        apiOnline: true,
        account: null,
        entitlement: null,
        consentAccepted: true,
      }),
    ).toBe('requires_auth')
  })

  it('requires consent before ready', () => {
    expect(
      resolveWritingLabGate({
        sessionChecking: false,
        apiOnline: true,
        account,
        entitlement: null,
        consentAccepted: false,
      }),
    ).toBe('requires_consent')
  })

  it('blocks when API is offline', () => {
    expect(
      resolveWritingLabGate({
        sessionChecking: false,
        apiOnline: false,
        account,
        entitlement: null,
        consentAccepted: true,
      }),
    ).toBe('unavailable')
  })

  it('blocks when credits are exhausted on free plan', () => {
    expect(
      resolveWritingLabGate({
        sessionChecking: false,
        apiOnline: true,
        account: { ...account, creditsRemaining: 0 },
        entitlement: { allowed: false, plan: 'free', remainingMs: 0, inTrial: false, isPro: false, creditsRemaining: 0 },
        consentAccepted: true,
      }),
    ).toBe('credits_exhausted')
  })

  it('is ready when signed in with consent and credits', () => {
    expect(
      resolveWritingLabGate({
        sessionChecking: false,
        apiOnline: true,
        account,
        entitlement: {
          allowed: true,
          plan: 'free',
          remainingMs: 0,
          inTrial: false,
          isPro: false,
          creditsRemaining: 10,
        },
        consentAccepted: true,
      }),
    ).toBe('ready')
  })

  it('does not treat signed-out as credits exhausted or service unavailable', () => {
    expect(
      resolveWritingLabGate({
        sessionChecking: false,
        apiOnline: false,
        account: null,
        entitlement: null,
        consentAccepted: true,
      }),
    ).toBe('requires_auth')
  })
})

describe('validateWritingLabInput', () => {
  it('rejects empty input', () => {
    expect(validateWritingLabInput('', 8, 3, 2000).ok).toBe(false)
  })

  it('accepts a short English sentence', () => {
    expect(validateWritingLabInput('Yesterday I go to school.', 8, 3, 2000).ok).toBe(true)
  })

  it('rejects text that exceeds max chars', () => {
    expect(validateWritingLabInput('a'.repeat(2001), 8, 3, 2000).ok).toBe(false)
  })
})
