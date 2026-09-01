import type {
  BillingEnvironment,
  BillingSubscriptionView,
  FlowlarySubscriptionStatus,
} from '@flowlary/shared'
import type { SubscriptionRecord } from '../db/store.ts'

export const EMPTY_SUBSCRIPTION_VIEW: BillingSubscriptionView = {
  status: 'none',
  plan: 'free',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  paymentFailed: false,
  billingEnvironment: null,
}

const PADDLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused', 'canceled'])

export function mapPaddleStatus(raw: string | undefined): FlowlarySubscriptionStatus {
  if (raw && PADDLE_STATUSES.has(raw)) return raw as FlowlarySubscriptionStatus
  return 'none'
}

export function parseRfc3339Ms(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export function scheduledCancel(scheduled: unknown): boolean {
  if (!scheduled || typeof scheduled !== 'object') return false
  return (scheduled as { action?: string }).action === 'cancel'
}

/**
 * Whether this subscription currently grants Flowlary Pro.
 *
 * past_due keeps Pro during dunning.
 * canceled keeps Pro until current_period_end when that timestamp is still in the future.
 * paused never grants Pro.
 */
export function subscriptionGrantsPro(record: SubscriptionRecord | null, now = Date.now()): boolean {
  if (!record) return false
  if (record.status === 'paused' || record.status === 'none' || record.status === 'expired') return false
  if (record.status === 'active' || record.status === 'trialing' || record.status === 'past_due') return true
  if (record.status === 'canceled') {
    return Boolean(record.currentPeriodEnd && now < record.currentPeriodEnd)
  }
  return false
}

export function toBillingSubscriptionView(
  record: SubscriptionRecord | null,
  now = Date.now(),
): BillingSubscriptionView {
  if (!record) return EMPTY_SUBSCRIPTION_VIEW
  const grants = subscriptionGrantsPro(record, now)
  const expired = record.status === 'canceled' && !grants
  return {
    status: expired ? 'expired' : record.status,
    plan: grants ? 'pro' : 'free',
    cancelAtPeriodEnd: record.cancelAtPeriodEnd || (record.status === 'canceled' && grants),
    currentPeriodEnd: record.currentPeriodEnd,
    paymentFailed: record.paymentFailed || record.status === 'past_due',
    billingEnvironment: record.billingEnvironment,
  }
}

export function extractPriceId(data: Record<string, unknown>): string | null {
  const items = data.items
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const row = item as { price_id?: unknown; price?: { id?: unknown } }
      if (typeof row.price_id === 'string' && row.price_id.startsWith('pri_')) return row.price_id
      if (typeof row.price?.id === 'string' && row.price.id.startsWith('pri_')) return row.price.id
    }
  }
  return null
}

export function extractCustomAccountId(data: Record<string, unknown>): string | null {
  const custom = data.custom_data
  if (!custom || typeof custom !== 'object') return null
  const id = (custom as { flowlary_account_id?: unknown }).flowlary_account_id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

export function environmentMatches(
  recordEnv: BillingEnvironment | null | undefined,
  current: BillingEnvironment,
): boolean {
  if (!recordEnv) return true
  return recordEnv === current
}
