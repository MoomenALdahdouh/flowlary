import { describe, expect, it } from 'vitest'
import {
  computeFeatureStatus,
  correctionAiLabel,
  formatLanguagePair,
  formatUsageFooter,
  readinessLabel,
} from '../../../extension/src/popup/status.ts'
import type { ExtensionStatus } from '../../../extension/src/messaging/types.ts'
import { BRAND, FREE_DAILY_CREDITS, LOW_CREDITS_THRESHOLD } from '@flowlary/shared'

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
      capabilities: [
        'ai.correction',
        'ai.translation',
        'ai.liveTranslation',
        'ai.layoutClassify',
        'keyboard.unlimited',
        'speedbox.unlimited',
      ],
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

describe('popup status helpers', () => {
  it('marks correction setup when consent is missing', () => {
    const status = computeFeatureStatus(
      baseStatus({
        correction: {
          enabled: true,
          mode: 'direct',
          highlights: true,
          consentAccepted: false,
          aiReady: false,
        },
      }),
    )
    expect(status.correction).toBe('setup')
    expect(status.summary).toContain('setup')
    expect(status.summaryTone).toBe('warn')
  })

  it('marks managed features locked when entitlement is exhausted', () => {
    const status = computeFeatureStatus(
      baseStatus({
        entitlement: {
          status: 'free',
          hasLicenseKey: false,
          isPro: false,
          inTrial: false,
          trialEndsAt: null,
          remainingMs: 0,
          creditsRemaining: 0,
          creditsUsed: FREE_DAILY_CREDITS,
          dailyLimit: FREE_DAILY_CREDITS,
          resetAt: Date.now() + 3_600_000,
          monthlyCreditsUsed: 0,
          monthlySoftCap: null,
          capabilities: ['keyboard.unlimited', 'speedbox.unlimited'],
        },
      }),
    )
    expect(status.correction).toBe('locked')
    // Google translation remains available when Groq AI credits are exhausted.
    expect(status.translation).toBe('ready')
    expect(status.layout).toBe('ready')
  })

  it('shows a low-credit warning before exhaustion', () => {
    const status = computeFeatureStatus(
      baseStatus({
        entitlement: {
          status: 'free',
          hasLicenseKey: false,
          isPro: false,
          inTrial: false,
          trialEndsAt: null,
          remainingMs: LOW_CREDITS_THRESHOLD,
          creditsRemaining: LOW_CREDITS_THRESHOLD,
          creditsUsed: FREE_DAILY_CREDITS - LOW_CREDITS_THRESHOLD,
          dailyLimit: FREE_DAILY_CREDITS,
          resetAt: Date.now() + 3_600_000,
          monthlyCreditsUsed: 0,
          monthlySoftCap: null,
          capabilities: [
            'ai.correction',
            'ai.translation',
            'ai.liveTranslation',
            'ai.layoutClassify',
            'keyboard.unlimited',
            'speedbox.unlimited',
          ],
        },
      }),
    )
    expect(status.summary).toContain('running low on AI writing checks')
    expect(status.summary).toMatch(new RegExp(`${LOW_CREDITS_THRESHOLD} AI writing checks remaining today`))
    expect(status.summaryTone).toBe('warn')
  })

  it('asks signed-out users to sign in for AI while keeping layout ready', () => {
    const status = computeFeatureStatus(
      baseStatus({
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
      }),
    )
    expect(status.correction).toBe('setup')
    expect(status.layout).toBe('ready')
    expect(status.summary).toContain('Sign in')
  })

  it('formats usage footer with daily credits', () => {
    expect(formatUsageFooter(baseStatus())).toContain(`${FREE_DAILY_CREDITS} / ${FREE_DAILY_CREDITS}`)
  })

  it('marks all features paused when extension is inactive', () => {
    const status = computeFeatureStatus(baseStatus({ active: false }))
    expect(status.correction).toBe('paused')
    expect(status.translation).toBe('paused')
    expect(status.layout).toBe('paused')
  })

  it('formats language pairs', () => {
    expect(formatLanguagePair('ar', 'en', 'Arabic', 'English')).toBe('Arabic → English')
  })

  it('labels Flowlary AI state without provider names', () => {
    expect(correctionAiLabel({ consentAccepted: false, aiReady: false })).toBe('Consent required')
    expect(correctionAiLabel({ consentAccepted: true, aiReady: true })).toBe('Flowlary AI ready')
  })

  it('maps readiness labels for UI', () => {
    expect(readinessLabel('ready')).toBe('Ready')
    expect(readinessLabel('setup')).toBe('Sign in')
    expect(readinessLabel('locked')).toBe('Limit reached')
  })

  it('marks Flowlary AI service unavailable when the API is offline for signed-in users', () => {
    const status = computeFeatureStatus(
      baseStatus({
        apiHealth: 'offline',
      }),
    )
    expect(status.correction).toBe('unavailable')
    expect(status.translation).toBe('unavailable')
    expect(status.layout).toBe('ready')
    expect(status.summary).toMatch(/temporarily unavailable/i)
  })

  it('maps signed-out correction to setup via canonical domain state', () => {
    const status = computeFeatureStatus(
      baseStatus({
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
      }),
    )
    expect(status.correction).toBe('setup')
    expect(status.layout).toBe('ready')
    expect(status.summary).toContain('Sign in')
  })
})
