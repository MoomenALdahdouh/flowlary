import { describe, expect, it } from 'vitest'
import { BRAND, FREE_DAILY_CREDITS } from '@flowlary/shared'
import type { ExtensionStatus } from '../../../extension/src/messaging/types.ts'
import { computeDomainState } from '../../../extension/src/ui/domainState.ts'
import {
  computeFeatureStatus,
  isAiCreditLocked,
  isCreditsExhausted,
  requiresAuth,
} from '../../../extension/src/popup/status.ts'
import { resolvePracticeCheckAvailability } from '../../../extension/src/dashboard/panels/practiceAvailability.ts'

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
      capabilities: ['ai.correction', 'ai.translation', 'ai.liveTranslation', 'keyboard.unlimited', 'speedbox.unlimited'],
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

const signedOutAccount = {
  signedIn: false,
  accountId: null,
  email: null,
  serverPlan: null,
  billingAvailable: false,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
  paymentFailed: false,
  currentPeriodEnd: null,
} satisfies ExtensionStatus['account']

const noConsent = {
  enabled: true,
  mode: 'direct' as const,
  highlights: true,
  consentAccepted: false,
  aiReady: false,
}

describe('feature availability hardening', () => {
  describe('auth vs credits', () => {
    it('does not treat signed-out users as credit exhausted', () => {
      const status = baseStatus({ account: signedOutAccount })
      expect(requiresAuth(status)).toBe(true)
      expect(isCreditsExhausted(status)).toBe(false)
      expect(isAiCreditLocked(status)).toBe(false)
    })

    it('shows sign-in required for signed-out correction, not limit reached', () => {
      const domain = computeDomainState(baseStatus({ account: signedOutAccount }), false)
      expect(domain?.features.correction.kind).toBe('requires_auth')
      expect(domain?.features.correction.reasonKey).toBe('sign_in_required')
      expect(domain?.features.correction.reasonKey).not.toBe('usage_exhausted')
    })

    it('never surfaces daily-limit reason key for signed-out correction', () => {
      const feature = computeDomainState(baseStatus({ account: signedOutAccount }), false)!.features.correction
      expect(feature.reasonKey).not.toBe('usage_exhausted')
      expect(feature.reasonKey).toBe('sign_in_required')
    })
  })

  describe('signed-out matrix', () => {
    it('signed out + API online → auth required on AI features', () => {
      const domain = computeDomainState(
        baseStatus({
          account: signedOutAccount,
          correction: noConsent,
        }),
        false,
      )
      expect(domain?.ai).toBe('requires_auth')
      expect(domain?.features.correction.kind).toBe('requires_auth')
      expect(domain?.features.translation.kind).toBe('requires_auth')
      expect(domain?.features.layout.kind).toBe('ready')
    })

    it('signed out + API offline → auth still wins over service unavailable', () => {
      const domain = computeDomainState(
        baseStatus({
          account: signedOutAccount,
          correction: noConsent,
          apiHealth: 'offline',
        }),
        false,
      )
      expect(domain?.ai).toBe('requires_auth')
      expect(domain?.features.correction.kind).toBe('requires_auth')
      expect(domain?.features.translation.kind).toBe('requires_auth')
      expect(domain?.features.layout.kind).toBe('ready')
    })

    it('signed out + consent default false + credits 0 → still auth, not locked', () => {
      const domain = computeDomainState(
        baseStatus({
          account: signedOutAccount,
          correction: noConsent,
          entitlement: {
            ...baseStatus().entitlement,
            creditsRemaining: 0,
            creditsUsed: FREE_DAILY_CREDITS,
            capabilities: [],
          },
        }),
        false,
      )
      expect(domain?.features.correction.kind).toBe('requires_auth')
      expect(domain?.features.translation.kind).toBe('requires_auth')
    })

    it('practice blocks with account_required when signed out', () => {
      const availability = resolvePracticeCheckAvailability(baseStatus({ account: signedOutAccount }))
      expect(availability.canStartSession).toBe(false)
      expect(availability.blockReason).toBe('account_required')
    })
  })

  describe('signed-in matrix', () => {
    it('signed in + consent missing → consent required', () => {
      const domain = computeDomainState(baseStatus({ correction: noConsent }), false)
      expect(domain?.ai).toBe('requires_consent')
      expect(domain?.features.correction.kind).toBe('requires_consent')
      expect(domain?.features.translation.kind).toBe('requires_consent')
    })

    it('signed in + consent + 0 credits → correction locked, translation ready', () => {
      const domain = computeDomainState(
        baseStatus({
          entitlement: {
            ...baseStatus().entitlement,
            creditsRemaining: 0,
            creditsUsed: FREE_DAILY_CREDITS,
            capabilities: ['ai.translation', 'ai.liveTranslation', 'keyboard.unlimited', 'speedbox.unlimited'],
          },
        }),
        false,
      )
      expect(domain?.features.correction.kind).toBe('locked')
      expect(domain?.features.translation.kind).toBe('ready')
      expect(domain?.features.liveTranslation.kind).toBe('disabled')
      expect(domain?.features.layout.kind).toBe('ready')
    })

    it('signed in + consent + credits + API online → ready', () => {
      const domain = computeDomainState(baseStatus(), false)
      expect(domain?.ai).toBe('available')
      expect(domain?.features.correction.kind).toBe('ready')
      expect(domain?.features.translation.kind).toBe('ready')
    })

    it('signed in + API offline → service unavailable after auth/consent', () => {
      const domain = computeDomainState(baseStatus({ apiHealth: 'offline' }), false)
      expect(domain?.ai).toBe('temporarily_unavailable')
      expect(domain?.features.correction.kind).toBe('unavailable')
      expect(domain?.features.correction.reasonKey).toBe('service_unavailable')
      expect(domain?.features.translation.kind).toBe('unavailable')
      expect(domain?.features.translation.reasonKey).toBe('service_unavailable')
      expect(domain?.features.layout.kind).toBe('ready')
    })
  })

  describe('live translation', () => {
    it('user toggle off shows disabled, not unavailable', () => {
      const domain = computeDomainState(
        baseStatus({
          translation: {
            liveEnabled: false,
            shortcutEnabled: true,
            sourceLanguage: 'ar',
            targetLanguage: 'en',
          },
        }),
        false,
      )
      expect(domain?.features.liveTranslation.kind).toBe('disabled')
    })

    it('enabled live translation unavailable only when service offline', () => {
      const domain = computeDomainState(
        baseStatus({
          translation: {
            mode: 'direct',
            liveEnabled: true,
            shortcutEnabled: true,
            sourceLanguage: 'ar',
            targetLanguage: 'en',
          },
          apiHealth: 'offline',
        }),
        false,
      )
      expect(domain?.features.liveTranslation.kind).toBe('unavailable')
      expect(domain?.features.liveTranslation.reasonKey).toBe('service_unavailable')
    })
  })

  describe('loading state', () => {
    it('returns null while loading without status', () => {
      expect(computeDomainState(null, true)).toBeNull()
    })

    it('does not mark loading fallback as service offline', () => {
      const domain = computeDomainState(null, false)
      expect(domain?.ai).toBe('loading')
      expect(domain?.flowlaryAiOffline).toBe(false)
    })
  })

  describe('canonical evaluator consistency', () => {
    it('computeFeatureStatus matches computeDomainState for signed-out correction', () => {
      const status = baseStatus({ account: signedOutAccount })
      const legacy = computeFeatureStatus(status)
      const domain = computeDomainState(status, false)
      expect(legacy.correction).toBe('setup')
      expect(domain?.features.correction.kind).toBe('requires_auth')
    })

    it('computeFeatureStatus matches computeDomainState for exhausted correction', () => {
      const status = baseStatus({
        entitlement: {
          ...baseStatus().entitlement,
          creditsRemaining: 0,
          creditsUsed: FREE_DAILY_CREDITS,
        },
      })
      expect(computeFeatureStatus(status).correction).toBe('locked')
      expect(computeDomainState(status, false)?.features.correction.kind).toBe('locked')
    })
  })
})
