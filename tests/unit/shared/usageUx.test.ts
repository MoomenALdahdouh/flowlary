import { describe, expect, it } from 'vitest'
import {
  FREE_DAILY_CREDITS,
  LOW_CREDITS_THRESHOLD,
  PRO_DAILY_CREDITS,
  PRO_MONTHLY_SOFT_CAP,
  UPGRADE_PROMPT_SUPPRESS_MS,
  blockedAiAttemptCopy,
  resolveUsageUx,
  type UsageUxInput,
} from '@flowlary/shared'

const now = Date.UTC(2026, 7, 26, 12, 0, 0)

function base(overrides: Partial<UsageUxInput> = {}): UsageUxInput {
  return {
    signedIn: true,
    apiHealth: 'ok',
    isPro: false,
    inTrial: false,
    trialEndsAt: null,
    plan: 'free',
    creditsRemaining: 450,
    creditsUsed: 50,
    dailyLimit: FREE_DAILY_CREDITS,
    resetAt: now + 8 * 60 * 60 * 1000 + 14 * 60 * 1000,
    monthlyCreditsUsed: 0,
    monthlySoftCap: null,
    paymentFailed: false,
    subscriptionStatus: 'none',
    billingAvailable: true,
    now,
    ...overrides,
  }
}

describe('resolveUsageUx Phase 29B', () => {
  it('healthy free is quiet without upgrade CTA', () => {
    const view = resolveUsageUx(base())
    expect(view.state).toBe('AI_USAGE_HEALTHY')
    expect(view.showUpgrade).toBe(false)
    expect(view.primaryCta).toBe('none')
    expect(view.assistsLabel).toContain('450')
    expect(view.resetLabel).toMatch(/Resets in/)
    expect(view.compactLine).not.toMatch(/upgrade/i)
  })

  it('low free shows subtle upgrade', () => {
    const view = resolveUsageUx(base({ creditsRemaining: LOW_CREDITS_THRESHOLD }))
    expect(view.state).toBe('AI_USAGE_LOW')
    expect(view.showUpgrade).toBe(true)
    expect(view.title).toMatch(/running low/i)
    expect(view.primaryCta).toBe('upgrade')
  })

  it('exhausted free is clear and keeps local tools note', () => {
    const view = resolveUsageUx(base({ creditsRemaining: 0 }))
    expect(view.state).toBe('AI_USAGE_EXHAUSTED')
    expect(view.title).toBe("You've used today's AI writing checks")
    expect(view.localToolsNote).toMatch(/local Flowlary tools/)
    expect(view.localToolsNote).toMatch(/Google translation/)
    expect(view.showUpgrade).toBe(true)
    expect(view.description).not.toMatch(/disabled|expired/i)
  })

  it('trial active shows days remaining, never AI timer', () => {
    const ends = now + 23 * 24 * 60 * 60 * 1000
    const view = resolveUsageUx(
      base({
        inTrial: true,
        plan: 'trial',
        trialEndsAt: ends,
        creditsRemaining: PRO_DAILY_CREDITS,
        dailyLimit: PRO_DAILY_CREDITS,
      }),
    )
    expect(view.state).toBe('AI_TRIAL_ACTIVE')
    expect(view.compactLine).toMatch(/23 days/)
    expect(view.resetLabel).toBeNull()
    expect(view.assistsLabel).toBe('AI available')
    expect(view.showUpgrade).toBe(false)
  })

  it('trial ending is calm reminder', () => {
    const ends = now + 3 * 24 * 60 * 60 * 1000
    const view = resolveUsageUx(
      base({
        inTrial: true,
        plan: 'trial',
        trialEndsAt: ends,
        creditsRemaining: PRO_DAILY_CREDITS,
        dailyLimit: PRO_DAILY_CREDITS,
      }),
    )
    expect(view.state).toBe('AI_TRIAL_ENDING')
    expect(view.title).toMatch(/ends in 3 days/i)
    expect(view.description).toMatch(/daily AI writing checks and free local tools/i)
    expect(view.showUpgrade).toBe(true)
  })

  it('trial expired transitions to Free messaging', () => {
    const view = resolveUsageUx(
      base({
        trialEndsAt: now - 60_000,
        creditsRemaining: FREE_DAILY_CREDITS,
      }),
    )
    expect(view.state).toBe('AI_TRIAL_EXPIRED')
    expect(view.title).toMatch(/trial has ended/i)
    expect(view.planLabel).toBe('Free')
    expect(view.localToolsNote).toBeTruthy()
  })

  it('pro active avoids free upgrade messaging', () => {
    const view = resolveUsageUx(
      base({
        isPro: true,
        plan: 'pro',
        creditsRemaining: 180,
        dailyLimit: PRO_DAILY_CREDITS,
        monthlyCreditsUsed: 100,
        monthlySoftCap: PRO_MONTHLY_SOFT_CAP,
      }),
    )
    expect(view.state).toBe('AI_PRO_ACTIVE')
    expect(view.showUpgrade).toBe(false)
    expect(view.compactLine).toMatch(/Pro/)
    expect(view.description).not.toMatch(/Unlimited/i)
  })

  it('pro soft limit distinguishes safety ceiling', () => {
    const view = resolveUsageUx(
      base({
        isPro: true,
        plan: 'pro',
        creditsRemaining: 0,
        dailyLimit: PRO_DAILY_CREDITS,
        monthlyCreditsUsed: 1400,
        monthlySoftCap: PRO_MONTHLY_SOFT_CAP,
      }),
    )
    expect(view.state).toBe('AI_PRO_SOFT_LIMIT')
    expect(view.title).toMatch(/safety limit/i)
    expect(view.showUpgrade).toBe(false)
  })

  it('api offline is not a quota state and has no upgrade CTA', () => {
    const view = resolveUsageUx(base({ apiHealth: 'offline', creditsRemaining: 0 }))
    expect(view.state).toBe('AI_TEMPORARILY_UNAVAILABLE')
    expect(view.showUpgrade).toBe(false)
    expect(view.primaryCta).toBe('none')
    expect(view.description).toMatch(/try again/i)
    expect(view.description).not.toMatch(/plan|allowance|unchanged/i)
  })

  it('account required is sign-in, not upgrade', () => {
    const view = resolveUsageUx(base({ signedIn: false }))
    expect(view.state).toBe('ACCOUNT_REQUIRED')
    expect(view.primaryCta).toBe('sign_in')
    expect(view.showUpgrade).toBe(false)
    expect(view.title).not.toMatch(/upgrade/i)
  })

  it('billing attention uses manage subscription', () => {
    const view = resolveUsageUx(
      base({
        isPro: true,
        plan: 'pro',
        paymentFailed: true,
        subscriptionStatus: 'past_due',
        creditsRemaining: 100,
        dailyLimit: PRO_DAILY_CREDITS,
      }),
    )
    expect(view.state).toBe('BILLING_ATTENTION')
    expect(view.primaryCta).toBe('manage_billing')
    expect(view.showUpgrade).toBe(false)
  })

  it('blocked AI attempt copy is calm and local-tool affirming', () => {
    const copy = blockedAiAttemptCopy(now + 3 * 60 * 60 * 1000 + 18 * 60 * 1000, now)
    expect(copy.title).toBe("You've used today's AI writing checks")
    expect(copy.description).toMatch(/reset in/i)
    expect(copy.localToolsNote).toMatch(/local Flowlary tools/i)
  })

  it('exports a reasonable upgrade suppression window', () => {
    expect(UPGRADE_PROMPT_SUPPRESS_MS).toBe(30 * 60 * 1000)
  })
})
