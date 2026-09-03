import { FREE_DAILY_CREDITS, PRO_DAILY_CREDITS, PRO_MONTHLY_SOFT_CAP, STORAGE_KEYS } from '@flowlary/shared'
import type { MockChromeStorage } from './mockChromeStorage.ts'
import { activeAccountContext } from '../../extension/src/storage/activeAccountContext.ts'
import { TEST_ACCOUNT_A } from './accountIsolation.ts'

const TEST_INSTALL_ID = '11111111-1111-1111-1111-111111111111'
const TEST_INSTALL_TOKEN = 'a'.repeat(64)

export function seedFlowlaryInstallAuth(store: MockChromeStorage): void {
  store.local[STORAGE_KEYS.authInstallId] = { value: TEST_INSTALL_ID, _v: 1 }
  store.local[STORAGE_KEYS.authInstallToken] = { value: TEST_INSTALL_TOKEN, _v: 1 }
}

/**
 * Phase 27: managed AI requires an account JWT + mirrored server entitlement.
 * Use this in tests that exercise translation/correction against a mocked API.
 */
export function seedFlowlaryAccountAuth(store: MockChromeStorage, options?: { plan?: string; expiresAt?: number }): void {
  seedFlowlaryInstallAuth(store)
  const plan = options?.plan ?? 'trial'
  const isPro = plan === 'pro'
  const inTrial = plan === 'trial'
  const dailyLimit = plan === 'free' ? FREE_DAILY_CREDITS : PRO_DAILY_CREDITS
  const accountId = TEST_ACCOUNT_A
  store.local[STORAGE_KEYS.authAccessToken] = { value: 'test-access-token', _v: 1 }
  store.local[STORAGE_KEYS.authRefreshToken] = { value: 'test-refresh-token', _v: 1 }
  store.local[STORAGE_KEYS.authSessionId] = { value: 'test-session-id', _v: 1 }
  store.local[STORAGE_KEYS.authAccountId] = { value: accountId, _v: 1 }
  store.local[STORAGE_KEYS.authAccountEmail] = { value: 'test@flowlary.com', _v: 1 }
  store.local[STORAGE_KEYS.authTokenExpiresAt] = {
    value: options?.expiresAt ?? Date.now() + 60 * 60 * 1000,
    _v: 1,
  }
  store.local[STORAGE_KEYS.authAccountPlan] = { value: plan, _v: 1 }
  store.local[STORAGE_KEYS.authServerEntitlement] = {
    plan,
    isPro,
    inTrial,
    remainingMs: dailyLimit,
    creditsRemaining: dailyLimit,
    creditsUsed: 0,
    dailyLimit,
    resetAt: Date.now() + 3_600_000,
    monthlyCreditsUsed: 0,
    monthlySoftCap: isPro || inTrial ? PRO_MONTHLY_SOFT_CAP : null,
    monthlyResetAt: isPro || inTrial ? Date.now() + 30 * 86_400_000 : null,
    capabilities: [
      'keyboard.unlimited',
      'speedbox.unlimited',
      'ai.correction',
      'ai.translation',
      'ai.liveTranslation',
      'ai.layoutClassify',
      'learning.basic',
      'learning.full',
      'practice.basic',
      'practice.full',
      'progress.basic',
      'progress.advanced',
      'learning.export',
      'learning.import',
    ],
    billingAvailable: false,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    paymentFailed: false,
    currentPeriodEnd: null,
    syncedAt: Date.now(),
  }
  activeAccountContext.activate(accountId)
}
