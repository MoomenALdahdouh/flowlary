import type { AppConfig } from '../config/env.ts'
import {
  findAccountById,
  findAccountByPaddleCustomerId,
  findSubscriptionById,
  hasProcessedWebhook,
  markWebhookProcessed,
  updateAccount,
  upsertSubscription,
  type AccountRecord,
  type SubscriptionRecord,
} from '../db/store.ts'
import {
  extractCustomAccountId,
  extractPriceId,
  mapPaddleStatus,
  parseRfc3339Ms,
  environmentMatches,
  scheduledCancel,
  subscriptionGrantsPro,
} from './subscriptionMap.ts'
import { configuredProPriceIds } from './paddleApi.ts'

function isAllowedProPriceId(config: AppConfig, priceId: string | null | undefined): boolean {
  if (!priceId) return false
  return configuredProPriceIds(config).includes(priceId)
}

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.paused',
  'subscription.resumed',
  'subscription.past_due',
  'subscription.activated',
  'subscription.trialing',
])

const TRANSACTION_EVENTS = new Set([
  'transaction.completed',
  'transaction.payment_failed',
  'transaction.past_due',
])

const CUSTOMER_EVENTS = new Set(['customer.created', 'customer.updated'])

export type WebhookProcessResult = {
  duplicate: boolean
  ignored: boolean
  eventType: string
  accountId: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function resolveAccount(data: Record<string, unknown>): AccountRecord | null {
  const customId = extractCustomAccountId(data)
  if (customId) {
    const byCustom = findAccountById(customId)
    if (byCustom) return byCustom
  }
  const customerId = typeof data.customer_id === 'string' ? data.customer_id : ''
  if (customerId) return findAccountByPaddleCustomerId(customerId)
  if (typeof data.id === 'string' && data.id.startsWith('ctm_')) {
    return findAccountByPaddleCustomerId(data.id)
  }
  return null
}

function applyPlanFromSubscription(account: AccountRecord, record: SubscriptionRecord, now: number): void {
  if (subscriptionGrantsPro(record, now)) {
    account.plan = 'pro'
  } else if (account.plan === 'pro') {
    account.plan = 'free'
  }
  account.paddleCustomerId = record.paddleCustomerId
  account.paddleSubscriptionId = record.paddleSubscriptionId
  account.billingEnvironment = record.billingEnvironment
  updateAccount(account)
}

function periodFromData(data: Record<string, unknown>): { start: number | null; end: number | null } {
  const period = asRecord(data.current_billing_period)
  return {
    start: parseRfc3339Ms(period?.starts_at),
    end: parseRfc3339Ms(period?.ends_at),
  }
}

function upsertFromSubscriptionData(
  config: AppConfig,
  data: Record<string, unknown>,
  occurredAt: string,
  now: number,
  paymentFailed: boolean,
): string | null {
  const subscriptionId = typeof data.id === 'string' ? data.id : ''
  if (!subscriptionId.startsWith('sub_')) return null
  const account = resolveAccount(data)
  if (!account) return null

  const existing = findSubscriptionById(subscriptionId)
  if (existing && !environmentMatches(existing.billingEnvironment, config.paddleEnvironment)) {
    return null
  }
  if (existing?.lastEventOccurredAt && occurredAt && occurredAt < existing.lastEventOccurredAt) {
    return account.id
  }
  if (existing && existing.accountId !== account.id) {
    return existing.accountId
  }

  const period = periodFromData(data)
  const priceId = extractPriceId(data) ?? existing?.priceId ?? null
  const allowedPriceIds = configuredProPriceIds(config)
  if (priceId && allowedPriceIds.length > 0 && !allowedPriceIds.includes(priceId)) {
    return null
  }
  const status = mapPaddleStatus(typeof data.status === 'string' ? data.status : undefined)
  const customerId =
    typeof data.customer_id === 'string' && data.customer_id.startsWith('ctm_')
      ? data.customer_id
      : account.paddleCustomerId ?? ''
  if (!customerId) return null

  const nextStatus = status === 'none' ? existing?.status ?? 'none' : status
  const record: SubscriptionRecord = {
    accountId: account.id,
    paddleCustomerId: customerId,
    paddleSubscriptionId: subscriptionId,
    status: nextStatus,
    priceId: priceId ?? existing?.priceId ?? null,
    plan: 'free',
    currentPeriodStart: period.start ?? existing?.currentPeriodStart ?? null,
    currentPeriodEnd: period.end ?? existing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: scheduledCancel(data.scheduled_change) || nextStatus === 'canceled',
    paymentFailed: paymentFailed || nextStatus === 'past_due',
    lastWebhookAt: now,
    lastEventOccurredAt: occurredAt || existing?.lastEventOccurredAt || null,
    billingEnvironment: config.paddleEnvironment,
  }
  if (nextStatus === 'active' || nextStatus === 'trialing') {
    record.paymentFailed = paymentFailed
  }
  record.plan = subscriptionGrantsPro(record, now) ? 'pro' : 'free'
  upsertSubscription(record)
  applyPlanFromSubscription(account, record, now)
  return account.id
}

function handleTransaction(config: AppConfig, data: Record<string, unknown>, occurredAt: string, now: number, failed: boolean): string | null {
  const subscriptionId = typeof data.subscription_id === 'string' ? data.subscription_id : ''
  const existing = subscriptionId ? findSubscriptionById(subscriptionId) : null
  const account = resolveAccount(data) ?? (existing ? findAccountById(existing.accountId) : null)
  if (!account) return null

  if (typeof data.customer_id === 'string' && data.customer_id.startsWith('ctm_')) {
    account.paddleCustomerId = data.customer_id
    account.billingEnvironment = config.paddleEnvironment
    updateAccount(account)
  }

  if (existing && !environmentMatches(existing.billingEnvironment, config.paddleEnvironment)) {
    return null
  }
  if (existing) {
    existing.paymentFailed = failed || existing.status === 'past_due'
    existing.lastWebhookAt = now
    if (!existing.lastEventOccurredAt || occurredAt >= existing.lastEventOccurredAt) {
      existing.lastEventOccurredAt = occurredAt
    }
    existing.plan = subscriptionGrantsPro(existing, now) ? 'pro' : 'free'
    upsertSubscription(existing)
    applyPlanFromSubscription(account, existing, now)
  }
  return account.id
}

function handleCustomer(config: AppConfig, data: Record<string, unknown>): string | null {
  const customerId = typeof data.id === 'string' ? data.id : ''
  if (!customerId.startsWith('ctm_')) return null
  const account = resolveAccount(data)
  if (!account) return null
  account.paddleCustomerId = customerId
  account.billingEnvironment = config.paddleEnvironment
  updateAccount(account)
  return account.id
}

/**
 * Apply a signature-verified Paddle notification.
 * Duplicate event_id is a successful no-op.
 * Unknown accounts never receive Pro.
 */
export function processVerifiedPaddleEvent(
  config: AppConfig,
  payload: Record<string, unknown>,
  now = Date.now(),
): WebhookProcessResult {
  const eventId = typeof payload.event_id === 'string' ? payload.event_id : ''
  const eventType = typeof payload.event_type === 'string' ? payload.event_type : ''
  const occurredAt = typeof payload.occurred_at === 'string' ? payload.occurred_at : ''
  const data = asRecord(payload.data) ?? {}

  if (eventId && hasProcessedWebhook(eventId)) {
    return { duplicate: true, ignored: false, eventType, accountId: null }
  }

  let accountId: string | null = null
  let ignored = false

  if (SUBSCRIPTION_EVENTS.has(eventType)) {
    accountId = upsertFromSubscriptionData(
      config,
      data,
      occurredAt,
      now,
      eventType === 'subscription.past_due',
    )
    if (!accountId) ignored = true
  } else if (TRANSACTION_EVENTS.has(eventType)) {
    accountId = handleTransaction(
      config,
      data,
      occurredAt,
      now,
      eventType === 'transaction.payment_failed' || eventType === 'transaction.past_due',
    )
    if (!accountId) ignored = true
  } else if (CUSTOMER_EVENTS.has(eventType)) {
    accountId = handleCustomer(config, data)
    if (!accountId) ignored = true
  } else {
    ignored = true
  }

  if (eventId) markWebhookProcessed(eventId, eventType || 'unknown')
  return { duplicate: false, ignored, eventType, accountId }
}
