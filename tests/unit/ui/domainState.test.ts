import { describe, expect, it } from 'vitest'
import { computeDomainState } from '../../../extension/src/ui/domainState.ts'
import type { ExtensionStatus } from '../../../extension/src/messaging/types.ts'
import { BRAND, FREE_DAILY_CREDITS } from '@flowlary/shared'

function baseStatus(overrides: Partial<ExtensionStatus> = {}): ExtensionStatus {
  return {
    brand: BRAND,
    active: true,
    features: { correction: true, translation: true, layout: true },
    translation: {
      mode: 'direct',
      liveEnabled: false,
      shortcutEnabled: true,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    },
    correction: {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
      aiReady: true,
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
      capabilities: ['ai.correction', 'ai.translation', 'keyboard.unlimited', 'speedbox.unlimited'],
    },
    account: {
      signedIn: true,
      accountId: '11111111-1111-4111-8111-111111111111',
      email: 'user@flowlary.com',
      serverPlan: 'free',
      billingAvailable: false,
      subscriptionStatus: null,
      cancelAtPeriodEnd: false,
      paymentFailed: false,
      currentPeriodEnd: null,
    },
    apiHealth: 'ok',
    layout: {
      mode: 'direct',
      autoEnabled: true,
      manualConversionEnabled: true,
      directShortcutEnabled: true,
      sourceLayout: 'en',
      targetLayouts: ['ar'],
    },
    learning: {
      onboardingCompleted: true,
      showFullOnboarding: false,
      showSetupPrompt: false,
      onboardingStep: null,
      summary: null,
    },
    version: '1.0.0',
    ...overrides,
  }
}

describe('computeDomainState', () => {
  it('separates extension active from Flowlary AI service unavailable when signed in', () => {
    const domain = computeDomainState(
      baseStatus({
        apiHealth: 'offline',
      }),
      false,
    )
    expect(domain?.extension).toBe('active')
    expect(domain?.ai).toBe('temporarily_unavailable')
    expect(domain?.features.correction.kind).toBe('unavailable')
    expect(domain?.features.correction.reasonKey).toBe('service_unavailable')
    expect(domain?.features.layout.kind).toBe('ready')
  })

  it('signed-out correction requires auth, not limit reached, when API offline', () => {
    const domain = computeDomainState(
      baseStatus({
        apiHealth: 'offline',
        account: {
          signedIn: false,
          accountId: null,
          email: null,
          serverPlan: null,
          billingAvailable: false,
          subscriptionStatus: null,
          cancelAtPeriodEnd: false,
          paymentFailed: false,
          currentPeriodEnd: null,
        },
        correction: {
          enabled: true,
          mode: 'direct',
          highlights: true,
          consentAccepted: false,
          aiReady: false,
        },
      }),
      false,
    )
    expect(domain?.ai).toBe('requires_auth')
    expect(domain?.features.correction.kind).toBe('requires_auth')
    expect(domain?.features.translation.kind).toBe('requires_auth')
  })

  it('keeps correction unavailable when AI is offline (no BYOK exception)', () => {
    const domain = computeDomainState(
      baseStatus({
        apiHealth: 'offline',
      }),
      false,
    )
    expect(domain?.ai).toBe('temporarily_unavailable')
    expect(domain?.features.correction.kind).toBe('unavailable')
    expect(domain?.features.translation.kind).toBe('unavailable')
  })

  it('requires consent before managed features are ready', () => {
    const domain = computeDomainState(
      baseStatus({
        correction: {
          enabled: true,
          mode: 'direct',
          highlights: true,
          consentAccepted: false,
          aiReady: false,
        },
      }),
      false,
    )
    expect(domain?.ai).toBe('requires_consent')
    expect(domain?.features.correction.kind).toBe('requires_consent')
  })

  it('pauses features when extension is inactive', () => {
    const domain = computeDomainState(baseStatus({ active: false }), false)
    expect(domain?.extension).toBe('paused')
    expect(domain?.features.correction.kind).toBe('paused')
    expect(domain?.features.correction.canToggle).toBe(false)
  })

  it('keeps Google translation ready when Free AI credits are exhausted', () => {
    const domain = computeDomainState(
      baseStatus({
        translation: {
          mode: 'direct',
          liveEnabled: true,
          shortcutEnabled: true,
          sourceLanguage: 'ar',
          targetLanguage: 'en',
        },
        entitlement: {
          ...baseStatus().entitlement,
          creditsRemaining: 0,
          creditsUsed: 40,
          remainingMs: 0,
          capabilities: ['keyboard.unlimited', 'speedbox.unlimited', 'ai.translation', 'ai.liveTranslation'],
        },
      }),
      false,
    )
    expect(domain?.features.correction.kind).toBe('locked')
    expect(domain?.features.translation.kind).toBe('ready')
    expect(domain?.features.liveTranslation.kind).toBe('ready')
    expect(domain?.features.layout.kind).toBe('ready')
  })
})
