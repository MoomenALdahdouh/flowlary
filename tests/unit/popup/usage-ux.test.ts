import { describe, expect, it } from 'vitest'
import { BRAND, FREE_DAILY_CREDITS, LOW_CREDITS_THRESHOLD, PRO_DAILY_CREDITS } from '@flowlary/shared'
import { computeFeatureStatus, formatUsageFooter } from '../../../extension/src/popup/status.ts'
import type { ExtensionStatus } from '../../../extension/src/messaging/types.ts'

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

describe('popup usage footer Phase 29B', () => {
  it('healthy free footer stays compact', () => {
    const line = formatUsageFooter(baseStatus({ entitlement: {
      ...baseStatus().entitlement,
      creditsRemaining: 27,
      creditsUsed: 13,
    }}))
    expect(line).toMatch(/27/)
    expect(line.toLowerCase()).not.toContain('upgrade')
  })

  it('exhausted summary keeps local tools available language', () => {
    const status = computeFeatureStatus(
      baseStatus({
        entitlement: {
          ...baseStatus().entitlement,
          creditsRemaining: 0,
          creditsUsed: FREE_DAILY_CREDITS,
        },
      }),
    )
    expect(status.correction).toBe('locked')
    expect(status.layout).toBe('ready')
    expect(status.summary).toMatch(/Fix Layout|Speed Box|local/i)
  })

  it('low credit summary is subtle', () => {
    const status = computeFeatureStatus(
      baseStatus({
        entitlement: {
          ...baseStatus().entitlement,
          creditsRemaining: LOW_CREDITS_THRESHOLD,
          creditsUsed: FREE_DAILY_CREDITS - LOW_CREDITS_THRESHOLD,
        },
      }),
    )
    expect(status.summaryTone).toBe('warn')
    expect(status.summary).toMatch(/running low/i)
  })

  it('api offline is not framed as upgrade', () => {
    const status = computeFeatureStatus(baseStatus({ apiHealth: 'offline' }))
    expect(status.summary).toMatch(/temporarily unavailable/i)
    expect(status.summary.toLowerCase()).not.toContain('upgrade')
    expect(status.layout).toBe('ready')
  })

  it('trial footer uses days remaining', () => {
    const line = formatUsageFooter(
      baseStatus({
        entitlement: {
          ...baseStatus().entitlement,
          status: 'trial',
          inTrial: true,
          trialEndsAt: Date.now() + 10 * 24 * 60 * 60 * 1000,
          creditsRemaining: PRO_DAILY_CREDITS,
          dailyLimit: PRO_DAILY_CREDITS,
        },
        account: {
          ...baseStatus().account,
          serverPlan: 'trial',
        },
      }),
    )
    expect(line).toMatch(/Trial/)
    expect(line).toMatch(/days remaining/)
  })
})
