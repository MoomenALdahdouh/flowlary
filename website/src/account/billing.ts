import {
  FLOWLARY_PRICING,
  formatUsdFromCents,
  type BillingInterval,
} from '@flowlary/shared'
import {
  fetchBillingConfig,
  loadWebAccount,
  startWebCheckout,
  startWebPortal,
  type BillingConfigView,
  type WebAccountView,
  type WebEntitlementView,
} from './client.ts'
import { openPaddleCheckout } from './paddleCheckout.ts'

export type CommercialPlanState =
  | 'signed_out'
  | 'loading'
  | 'free'
  | 'trial'
  | 'pro'
  | 'cancel_at_period_end'
  | 'past_due'
  | 'payment_failed'
  | 'expired'

export function resolveCommercialPlanState(input: {
  loading?: boolean
  account: WebAccountView | null
  entitlement: WebEntitlementView | null
}): CommercialPlanState {
  if (input.loading) return 'loading'
  if (!input.account) return 'signed_out'
  const sub = input.entitlement?.subscription ?? input.account.subscription
  const isPro = input.entitlement?.isPro === true || input.account.isPro === true
  const inTrial = input.entitlement?.inTrial === true || input.account.inTrial === true

  if (isPro && sub?.paymentFailed) return 'payment_failed'
  if (isPro && sub?.status === 'past_due') return 'past_due'
  if (isPro && sub?.cancelAtPeriodEnd) return 'cancel_at_period_end'
  if (isPro) return 'pro'
  if (inTrial) return 'trial'
  if (sub?.status === 'canceled' || sub?.status === 'expired') return 'expired'
  return 'free'
}

export function catalogDisplayPrice(
  price: BillingConfigView['proPriceMonthly'],
  fallbackCents: number,
  locale = 'en-US',
): string {
  if (price?.amount) {
    const cents = Number(price.amount)
    if (Number.isFinite(cents)) {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: price.currency || FLOWLARY_PRICING.currency,
          minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(cents / 100)
      } catch {
        /* fall through */
      }
    }
  }
  return formatUsdFromCents(fallbackCents, locale)
}

export async function beginProCheckout(interval: BillingInterval = 'month'): Promise<
  | { ok: true }
  | { ok: false; reason: 'auth' | 'already_pro' | 'unavailable' | 'checkout_failed' | 'email_not_verified' }
> {
  const started = await startWebCheckout(interval)
  if (!started.ok) {
    if (started.error === 'auth') return { ok: false, reason: 'auth' }
    if (started.error === 'already_pro') return { ok: false, reason: 'already_pro' }
    if (started.error === 'email_not_verified') return { ok: false, reason: 'email_not_verified' }
    return { ok: false, reason: 'unavailable' }
  }
  const successUrl = `${window.location.origin}/account?checkout=complete`
  const account = await loadWebAccount()
  const opened = await openPaddleCheckout({
    transactionId: started.transactionId,
    clientToken: started.clientToken,
    environment: started.environment,
    successUrl,
    customerEmail: account.ok ? account.account.email : null,
  })
  if (!opened) return { ok: false, reason: 'checkout_failed' }
  return { ok: true }
}

export async function openBillingPortal(): Promise<
  | { ok: true }
  | { ok: false; reason: 'auth' | 'unavailable' | 'no_customer' }
> {
  const result = await startWebPortal()
  if (!result.ok) {
    if (result.error === 'auth') return { ok: false, reason: 'auth' }
    return { ok: false, reason: 'unavailable' }
  }
  window.location.assign(result.url)
  return { ok: true }
}

export async function loadBillingConfigSafe(): Promise<BillingConfigView | null> {
  return fetchBillingConfig()
}

export async function refreshAccountState() {
  return loadWebAccount()
}

export { FLOWLARY_PRICING }
