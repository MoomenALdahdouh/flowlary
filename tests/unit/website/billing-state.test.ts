import { describe, expect, it } from 'vitest'
import { resolveCommercialPlanState } from '../../../website/src/account/billing.ts'
import type { WebAccountView, WebEntitlementView } from '../../../website/src/account/client.ts'

function account(partial: Partial<WebAccountView> = {}): WebAccountView {
  return {
    id: 'acc',
    email: 'user@flowlary.com',
    plan: 'free',
    status: 'active',
    inTrial: false,
    isPro: false,
    remainingMs: 40,
    billingAvailable: true,
    ...partial,
  }
}

function entitlement(partial: Partial<WebEntitlementView> = {}): WebEntitlementView {
  return {
    plan: 'free',
    allowed: true,
    remainingMs: 40,
    inTrial: false,
    isPro: false,
    billingAvailable: true,
    ...partial,
  }
}

describe('resolveCommercialPlanState', () => {
  it('maps signed out and loading', () => {
    expect(resolveCommercialPlanState({ account: null, entitlement: null })).toBe('signed_out')
    expect(resolveCommercialPlanState({ loading: true, account: null, entitlement: null })).toBe('loading')
  })

  it('maps free trial and pro', () => {
    expect(resolveCommercialPlanState({ account: account(), entitlement: entitlement() })).toBe('free')
    expect(
      resolveCommercialPlanState({
        account: account({ inTrial: true, plan: 'trial' }),
        entitlement: entitlement({ inTrial: true, plan: 'trial' }),
      }),
    ).toBe('trial')
    expect(
      resolveCommercialPlanState({
        account: account({ isPro: true, plan: 'pro' }),
        entitlement: entitlement({ isPro: true, plan: 'pro' }),
      }),
    ).toBe('pro')
  })

  it('maps cancellation past due and payment failed without fake upgrade', () => {
    expect(
      resolveCommercialPlanState({
        account: account({ isPro: true }),
        entitlement: entitlement({
          isPro: true,
          subscription: {
            status: 'active',
            plan: 'pro',
            cancelAtPeriodEnd: true,
            currentPeriodEnd: Date.now() + 86400000,
            paymentFailed: false,
          },
        }),
      }),
    ).toBe('cancel_at_period_end')

    expect(
      resolveCommercialPlanState({
        account: account({ isPro: true }),
        entitlement: entitlement({
          isPro: true,
          subscription: {
            status: 'past_due',
            plan: 'pro',
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            paymentFailed: false,
          },
        }),
      }),
    ).toBe('past_due')

    expect(
      resolveCommercialPlanState({
        account: account({ isPro: true }),
        entitlement: entitlement({
          isPro: true,
          subscription: {
            status: 'active',
            plan: 'pro',
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            paymentFailed: true,
          },
        }),
      }),
    ).toBe('payment_failed')

    expect(
      resolveCommercialPlanState({
        account: account({ isPro: false }),
        entitlement: entitlement({
          isPro: false,
          subscription: {
            status: 'canceled',
            plan: 'free',
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            paymentFailed: false,
          },
        }),
      }),
    ).toBe('expired')
  })
})
