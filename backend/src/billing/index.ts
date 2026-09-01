/**
 * Flowlary billing boundary (Paddle Billing).
 *
 * Provider webhook → verified signature → subscription record → entitlement.
 * Never: checkout UI → Pro, client header → Pro, or unverified webhook → Pro.
 */

import type { AppConfig } from '../config/env.ts'
import { catalogAmountMatchesApproved } from '@flowlary/shared'
import { findSubscriptionByAccountId } from '../db/store.ts'
import { findAccountById } from '../db/store.ts'
import {
  configuredProPriceIds,
  createCheckoutTransaction,
  createCustomerPortalSession,
  readProPrice,
} from './paddleApi.ts'
import { EMPTY_SUBSCRIPTION_VIEW, toBillingSubscriptionView } from './subscriptionMap.ts'

export type BillingProviderId = 'none' | 'paddle'
export type CheckoutInterval = 'month' | 'year'

export type BillingProviderStatus = {
  id: BillingProviderId
  configured: boolean
  checkoutAvailable: boolean
  portalAvailable: boolean
  webhookConfigured: boolean
  environment: AppConfig['paddleEnvironment']
}

function mapPriceView(price: Awaited<ReturnType<typeof readProPrice>>) {
  if (!price?.unit_price?.amount) return null
  const amountCents = Number(price.unit_price.amount)
  const interval = (price.billing_cycle?.interval ?? 'month') as 'month' | 'year'
  if (!Number.isFinite(amountCents) || !catalogAmountMatchesApproved(amountCents, interval)) {
    return null
  }
  return {
    amount: price.unit_price.amount,
    currency: price.unit_price.currency_code ?? 'USD',
    interval,
    frequency: price.billing_cycle?.frequency ?? 1,
  }
}

export function isWebhookConfigured(config: AppConfig): boolean {
  return Boolean(config.paddleWebhookSecret)
}

export function isCheckoutConfigured(config: AppConfig): boolean {
  return Boolean(config.paddleApiKey && config.paddleClientToken && config.paddlePriceIdPro)
}

export function isYearlyCheckoutConfigured(config: AppConfig): boolean {
  return isCheckoutConfigured(config) && Boolean(config.paddlePriceIdProYearly)
}

export function isPortalConfigured(config: AppConfig): boolean {
  return Boolean(config.paddleApiKey)
}

export function isBillingConfigured(config: AppConfig): boolean {
  return isWebhookConfigured(config) || isCheckoutConfigured(config)
}

export function getBillingStatus(config: AppConfig): BillingProviderStatus {
  const checkoutAvailable = isCheckoutConfigured(config)
  const webhookConfigured = isWebhookConfigured(config)
  return {
    id: checkoutAvailable || webhookConfigured ? 'paddle' : 'none',
    configured: isBillingConfigured(config),
    checkoutAvailable,
    portalAvailable: isPortalConfigured(config),
    webhookConfigured,
    environment: config.paddleEnvironment,
  }
}

export async function getPublicBillingConfig(config: AppConfig) {
  const status = getBillingStatus(config)
  const monthly = status.checkoutAvailable ? await readProPrice(config, config.paddlePriceIdPro) : null
  const yearly =
    status.checkoutAvailable && config.paddlePriceIdProYearly
      ? await readProPrice(config, config.paddlePriceIdProYearly)
      : null
  const trial =
    monthly?.trial_period?.interval && monthly.trial_period.frequency
      ? {
          interval: monthly.trial_period.interval,
          frequency: monthly.trial_period.frequency,
        }
      : null
  const proPrice = mapPriceView(monthly)
  return {
    available: status.checkoutAvailable,
    environment: status.environment,
    checkoutAvailable: status.checkoutAvailable,
    yearlyCheckoutAvailable: isYearlyCheckoutConfigured(config),
    portalAvailable: status.portalAvailable,
    webhookConfigured: status.webhookConfigured,
    clientToken: status.checkoutAvailable ? config.paddleClientToken : null,
    priceConfigured: Boolean(config.paddlePriceIdPro),
    /** @deprecated Prefer proPriceMonthly — kept for transitional clients. */
    proPrice,
    proPriceMonthly: proPrice,
    proPriceYearly: mapPriceView(yearly),
    trial,
  }
}

export async function startCheckout(
  config: AppConfig,
  accountId: string,
  paddleCustomerId: string | null,
  interval: CheckoutInterval = 'month',
): Promise<
  | {
      ok: true
      transactionId: string
      clientToken: string
      environment: AppConfig['paddleEnvironment']
      interval: CheckoutInterval
    }
  | { ok: false; reason: 'billing_unavailable' | 'already_pro' | 'paddle_unavailable' | 'interval_unavailable' | 'email_not_verified' }
> {
  if (!isCheckoutConfigured(config)) return { ok: false, reason: 'billing_unavailable' }
  const account = findAccountById(accountId)
  if (!account?.emailVerified) return { ok: false, reason: 'email_not_verified' }
  const priceId =
    interval === 'year' ? config.paddlePriceIdProYearly : config.paddlePriceIdPro
  if (!priceId) return { ok: false, reason: interval === 'year' ? 'interval_unavailable' : 'billing_unavailable' }
  if (!isAllowedProPriceId(config, priceId)) {
    return { ok: false, reason: 'billing_unavailable' }
  }
  const catalogPrice = await readProPrice(config, priceId)
  if (!mapPriceView(catalogPrice)) {
    return { ok: false, reason: 'paddle_unavailable' }
  }

  const current = findSubscriptionByAccountId(accountId)
  const view = toBillingSubscriptionView(current)
  if (view.plan === 'pro' && (view.status === 'active' || view.status === 'trialing' || view.status === 'past_due')) {
    return { ok: false, reason: 'already_pro' }
  }
  const created = await createCheckoutTransaction(config, {
    accountId,
    customerId: paddleCustomerId,
    priceId,
  })
  if (!created.ok || !created.data?.id) return { ok: false, reason: 'paddle_unavailable' }
  return {
    ok: true,
    transactionId: created.data.id,
    clientToken: config.paddleClientToken,
    environment: config.paddleEnvironment,
    interval,
  }
}

export async function startCustomerPortal(
  config: AppConfig,
  paddleCustomerId: string | null,
  paddleSubscriptionId: string | null,
): Promise<{ ok: true; url: string } | { ok: false; reason: 'billing_unavailable' | 'no_customer' | 'paddle_unavailable' }> {
  if (!isPortalConfigured(config)) return { ok: false, reason: 'billing_unavailable' }
  if (!paddleCustomerId) return { ok: false, reason: 'no_customer' }
  const created = await createCustomerPortalSession(
    config,
    paddleCustomerId,
    paddleSubscriptionId ? [paddleSubscriptionId] : [],
  )
  if (!created.ok) return { ok: false, reason: 'paddle_unavailable' }
  const url =
    created.data.urls?.general?.overview ??
    created.data.urls?.subscriptions?.[0]?.cancel_subscription ??
    null
  if (!url) return { ok: false, reason: 'paddle_unavailable' }
  return { ok: true, url }
}

export function getAccountBillingView(accountId: string, now = Date.now()) {
  return toBillingSubscriptionView(findSubscriptionByAccountId(accountId), now)
}

export function getAccountBillingStatus(config: AppConfig, accountId: string, now = Date.now()) {
  const billing = getBillingStatus(config)
  const subscription = getAccountBillingView(accountId, now)
  return {
    provider: billing.id,
    configured: billing.configured,
    checkoutAvailable: billing.checkoutAvailable,
    portalAvailable: billing.portalAvailable,
    webhookConfigured: billing.webhookConfigured,
    environment: billing.environment,
    subscription,
  }
}

export function isAllowedProPriceId(config: AppConfig, priceId: string | null | undefined): boolean {
  if (!priceId) return false
  return configuredProPriceIds(config).includes(priceId)
}

export { EMPTY_SUBSCRIPTION_VIEW, toBillingSubscriptionView }
export { processVerifiedPaddleEvent } from './webhook.ts'
export { verifyPaddleSignature, signPaddlePayload } from './paddleSignature.ts'
