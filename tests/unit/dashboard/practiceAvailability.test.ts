import { describe, expect, it } from 'vitest'
import { FREE_DAILY_CREDITS } from '@flowlary/shared'
import type { ExtensionStatus } from '../../../extension/src/messaging/types.ts'
import {
  canRecordPracticeAction,
  canStartPracticeCheckAction,
  isActivePracticeCheck,
  practiceCorrectionErrorKey,
  resolvePracticeCheckAvailability,
} from '../../../extension/src/dashboard/panels/practiceAvailability.ts'

function baseStatus(overrides: Partial<ExtensionStatus> = {}): ExtensionStatus {
  return {
    brand: { name: 'Flowlary', product: 'Flowlary' },
    active: true,
    features: { correction: true, translation: true, layout: true },
    translation: {
      mode: 'direct',
      liveEnabled: false,
      shortcutEnabled: true,
      sourceLanguage: 'en',
      targetLanguage: 'ar',
    },
    correction: {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
      aiReady: true,
    },
    layout: {
      mode: 'direct',
      autoEnabled: true,
      manualConversionEnabled: true,
      directShortcutEnabled: true,
      sourceLayout: 'en-US-qwerty',
      targetLayouts: ['ar-101'],
    },
    learning: {
      onboardingCompleted: true,
      showFullOnboarding: false,
      showSetupPrompt: false,
      onboardingStep: null,
      summary: null,
    },
    entitlement: {
      status: 'free',
      hasLicenseKey: false,
      isPro: false,
      inTrial: false,
      trialEndsAt: null,
      remainingMs: FREE_DAILY_CREDITS,
      creditsRemaining: FREE_DAILY_CREDITS,
      creditsUsed: 0,
      dailyLimit: FREE_DAILY_CREDITS,
      resetAt: Date.now() + 3_600_000,
      monthlyCreditsUsed: 0,
      monthlySoftCap: null,
      capabilities: ['practice.basic', 'ai.correction'],
    },
    account: {
      signedIn: true,
      accountId: '11111111-1111-4111-8111-111111111111',
      email: 'test@flowlary.com',
      serverPlan: 'free',
      billingAvailable: false,
      subscriptionStatus: null,
      cancelAtPeriodEnd: false,
      paymentFailed: false,
      currentPeriodEnd: null,
    },
    apiHealth: 'ok',
    version: 'test',
    ...overrides,
  }
}

describe('practiceAvailability', () => {
  it('allows free practice.basic when credits remain', () => {
    const availability = resolvePracticeCheckAvailability(baseStatus())
    expect(availability).toMatchObject({
      canStartSession: true,
      canCheckWriting: true,
      blockReason: 'none',
      creditsRemaining: FREE_DAILY_CREDITS,
    })
  })

  it('blocks when credits are exhausted', () => {
    const availability = resolvePracticeCheckAvailability(
      baseStatus({
        entitlement: {
          ...baseStatus().entitlement,
          creditsRemaining: 0,
        },
      }),
    )
    expect(availability).toMatchObject({
      canStartSession: false,
      blockReason: 'usage_exhausted',
    })
  })

  it('blocks when consent is missing', () => {
    const availability = resolvePracticeCheckAvailability(
      baseStatus({
        correction: { ...baseStatus().correction, consentAccepted: false, aiReady: false },
      }),
    )
    expect(availability.blockReason).toBe('consent_required')
  })

  it('rejects stale practice check keys', () => {
    const expected = { sessionId: 's1', itemIndex: 0 }
    expect(isActivePracticeCheck(expected, { sessionId: 's1', itemIndex: 1 }, false)).toBe(false)
    expect(isActivePracticeCheck(expected, { sessionId: 's2', itemIndex: 0 }, false)).toBe(false)
    expect(isActivePracticeCheck(expected, expected, true)).toBe(false)
    expect(isActivePracticeCheck(expected, expected, false)).toBe(true)
  })

  it('guards double check and double accept', () => {
    expect(canStartPracticeCheckAction(true, false, true)).toBe(false)
    expect(canStartPracticeCheckAction(false, true, true)).toBe(false)
    expect(canStartPracticeCheckAction(false, false, true)).toBe(true)
    expect(canRecordPracticeAction(true, true)).toBe(false)
    expect(canRecordPracticeAction(false, true)).toBe(true)
  })

  it('maps correction error codes', () => {
    expect(practiceCorrectionErrorKey('usage_exhausted')).toBe('usage_exhausted')
    expect(practiceCorrectionErrorKey('account_changed')).toBe('account_changed')
    expect(practiceCorrectionErrorKey('rate_limited')).toBe('rate_limited')
    expect(practiceCorrectionErrorKey('weird')).toBe('generic')
  })
})
