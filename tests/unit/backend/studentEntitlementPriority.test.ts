import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FREE_DAILY_CREDITS,
  PRO_DAILY_CREDITS,
  TRIAL_DAILY_CREDITS,
} from '@flowlary/shared'
import {
  configureStorePath,
  createAccount,
  findAccountById,
  resetStoreForTests,
  updateAccount,
  upsertSubscription,
} from '../../../backend/src/db/store.ts'
import { upsertStudentBenefit } from '../../../backend/src/db/studentBenefitSlice.ts'
import { resolveServerEntitlementForAccount } from '../../../backend/src/services/accountService.ts'
import { resetRateLimitsForTests } from '../../../backend/src/middleware/rateLimit.ts'

describe('student entitlement priority', () => {
  const now = Date.UTC(2026, 7, 15, 12, 0, 0)

  beforeEach(() => {
    resetStoreForTests()
    resetRateLimitsForTests()
    configureStorePath(':memory:')
  })

  afterEach(() => {
    resetStoreForTests()
    resetRateLimitsForTests()
  })

  function seedAccount(plan: 'free' | 'trial' | 'pro', trialEndsAt: number | null = null) {
    return createAccount({
      email: `${plan}-${Math.random()}@example.com`,
      passwordHash: 'hash',
      plan,
      status: 'active',
      trialEndsAt,
      usageBalanceMs: 0,
    })
  }

  function seedStudentBenefit(
    accountId: string,
    options: {
      status: 'active' | 'expired' | 'pending' | 'revoked'
      verified: boolean
      expiresAt: number | null
    },
  ) {
    upsertStudentBenefit({
      accountId,
      verified: options.verified,
      verifiedAt: options.verified ? now - 86_400_000 : null,
      expiresAt: options.expiresAt,
      verificationMethod: 'academic_email',
      verificationReference: `ref-${accountId}`,
      institutionHint: 'school.edu',
      status: options.status,
      createdAt: now - 86_400_000,
      updatedAt: now,
    })
  }

  function seedProSubscription(accountId: string, periodEnd: number) {
    upsertSubscription({
      accountId,
      paddleCustomerId: 'ctm_test',
      paddleSubscriptionId: `sub-${accountId}`,
      status: 'active',
      priceId: 'pri_test',
      plan: 'pro',
      currentPeriodStart: now - 86_400_000,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      paymentFailed: false,
      lastWebhookAt: now,
      lastEventOccurredAt: null,
      billingEnvironment: 'sandbox',
    })
  }

  it('grants free limits when only free plan applies', () => {
    const account = seedAccount('free')
    const view = resolveServerEntitlementForAccount(account, now)
    expect(view.dailyLimit).toBe(FREE_DAILY_CREDITS)
    expect(view.isPro).toBe(false)
    expect(view.studentProActive).toBeUndefined()
  })

  it('grants trial limits when trial is active', () => {
    const account = seedAccount('trial', now + 7 * 86_400_000)
    const view = resolveServerEntitlementForAccount(account, now)
    expect(view.inTrial).toBe(true)
    expect(view.dailyLimit).toBe(TRIAL_DAILY_CREDITS)
    expect(view.isPro).toBe(false)
  })

  it('student pro beats trial and free', () => {
    const account = seedAccount('trial', now + 7 * 86_400_000)
    seedStudentBenefit(account.id, {
      status: 'active',
      verified: true,
      expiresAt: now + 30 * 86_400_000,
    })
    const view = resolveServerEntitlementForAccount(account, now)
    expect(view.studentProActive).toBe(true)
    expect(view.isPro).toBe(false)
    expect(view.inTrial).toBe(true)
    expect(view.dailyLimit).toBe(PRO_DAILY_CREDITS)
    expect(view.capabilities).toContain('learning.full')
  })

  it('paddle pro beats active student pro', () => {
    const account = seedAccount('free')
    seedStudentBenefit(account.id, {
      status: 'active',
      verified: true,
      expiresAt: now + 30 * 86_400_000,
    })
    seedProSubscription(account.id, now + 30 * 86_400_000)
    const view = resolveServerEntitlementForAccount(findAccountById(account.id)!, now)
    expect(view.isPro).toBe(true)
    expect(view.studentProActive).toBeUndefined()
    expect(view.plan).toBe('pro')
  })

  it('falls back to trial after student benefit expires', () => {
    const account = seedAccount('trial', now + 7 * 86_400_000)
    seedStudentBenefit(account.id, {
      status: 'active',
      verified: true,
      expiresAt: now - 1_000,
    })
    const view = resolveServerEntitlementForAccount(account, now)
    expect(view.studentProActive).toBeUndefined()
    expect(view.inTrial).toBe(true)
    expect(view.dailyLimit).toBe(TRIAL_DAILY_CREDITS)
  })

  it('falls back to free when student and trial are expired', () => {
    const account = seedAccount('trial', now - 1_000)
    updateAccount({ ...account, plan: 'free' })
    seedStudentBenefit(account.id, {
      status: 'active',
      verified: true,
      expiresAt: now - 1_000,
    })
    const view = resolveServerEntitlementForAccount(findAccountById(account.id)!, now)
    expect(view.studentProActive).toBeUndefined()
    expect(view.inTrial).toBe(false)
    expect(view.dailyLimit).toBe(FREE_DAILY_CREDITS)
  })

  it('never grants student pro from expired or revoked records', () => {
    const account = seedAccount('free')
    seedStudentBenefit(account.id, {
      status: 'expired',
      verified: false,
      expiresAt: now - 1_000,
    })
    let view = resolveServerEntitlementForAccount(account, now)
    expect(view.studentProActive).toBeUndefined()

    seedStudentBenefit(account.id, {
      status: 'revoked',
      verified: false,
      expiresAt: null,
    })
    view = resolveServerEntitlementForAccount(findAccountById(account.id)!, now)
    expect(view.studentProActive).toBeUndefined()
  })

  it('resumes student pro after paddle subscription ends', () => {
    const account = seedAccount('free')
    seedStudentBenefit(account.id, {
      status: 'active',
      verified: true,
      expiresAt: now + 30 * 86_400_000,
    })
    seedProSubscription(account.id, now - 1_000)
    upsertSubscription({
      accountId: account.id,
      paddleCustomerId: 'ctm_test',
      paddleSubscriptionId: `sub-${account.id}`,
      status: 'canceled',
      priceId: 'pri_test',
      plan: 'pro',
      currentPeriodStart: now - 60 * 86_400_000,
      currentPeriodEnd: now - 1_000,
      cancelAtPeriodEnd: true,
      paymentFailed: false,
      lastWebhookAt: now,
      lastEventOccurredAt: null,
      billingEnvironment: 'sandbox',
    })
    const view = resolveServerEntitlementForAccount(findAccountById(account.id)!, now)
    expect(view.isPro).toBe(false)
    expect(view.studentProActive).toBe(true)
    expect(view.dailyLimit).toBe(PRO_DAILY_CREDITS)
  })
})
