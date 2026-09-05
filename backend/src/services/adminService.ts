import {
  ADMIN_RANGE_DAYS,
  PRO_MONTHLY_PRICE_CENTS,
  PRO_YEARLY_PRICE_CENTS,
  formatSupportTicketNumber,
  type AdminActivityView,
  type AdminAuditEventView,
  type AdminOverviewView,
  type AdminRangeDays,
  type AdminSearchView,
  type AdminSettingsView,
  type AdminSubscriptionListItem,
  type AdminSubscriptionListView,
  type AdminUsageView,
  type AdminUserDetailView,
  type AdminUserListItem,
  type AdminUserListView,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { GatewayError } from '../gateway/errors.ts'
import { getBillingStatus } from '../billing/index.ts'
import { getAdvisorProviderHealth } from '../providers/hypothesisAdvisorProvider.ts'
import {
  appendAdminAuditEvent,
  deleteSessionsForAccount,
  findAccountById,
  findSubscriptionByAccountId,
  findSubscriptionById,
  listAdminAuditEvents,
  listAllAccounts,
  listAllSubscriptions,
  listRecentWebhookEvents,
  listSessionsForAccount,
  listUsage,
  updateAccount,
  type AccountRecord,
  type AdminAuditRecord,
  type SubscriptionRecord,
  type UsagePersistRecord,
} from '../db/store.ts'
import { getFeedbackPreferences, listAllSupportTickets, listSupportTicketsForAccount } from '../db/feedbackStoreSlice.ts'
import { isFeedbackAdmin } from './feedbackService.ts'
import { getAccountEntitlement } from './accountService.ts'
import { listAccountLearningEvents } from './learningEventsService.ts'
import { getAccountPracticeSessions } from './learningSyncService.ts'
import { getActiveStudentBenefit } from './studentVerificationService.ts'

export { isFeedbackAdmin as isPlatformAdmin }

const DAY_MS = 24 * 60 * 60 * 1000

export function parseAdminRangeDays(raw: string | null): AdminRangeDays {
  const value = Number(raw ?? '7')
  return (ADMIN_RANGE_DAYS as readonly number[]).includes(value) ? (value as AdminRangeDays) : 7
}

export function requireConfirm(body: Record<string, unknown>): true {
  if (body.confirm === true) return true
  throw new GatewayError('AI_INVALID_REQUEST', 'Confirmation required', 400, 'admin')
}

export function resetAdminServicesForTests(): void {
  /* store reset is owned by resetStoreForTests */
}

function parsePage(raw: string | null, fallback = 1): number {
  const value = Number(raw ?? fallback)
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback
}

function parsePageSize(raw: string | null, fallback = 25): number {
  const value = Number(raw ?? fallback)
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value), 1), 100)
}

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function providerLabel(model: string): string {
  const value = model.toLowerCase()
  if (value.includes('gemini')) return 'gemini'
  if (value.includes('gpt-oss') || value.includes('groq') || value.includes('llama')) return 'groq'
  if (value.includes('openrouter')) return 'openrouter'
  if (value.includes('google') || value.includes('translate')) return 'google'
  return model ? 'other' : 'unknown'
}

function configuredFlag(value: string): 'configured' | 'not_configured' {
  return value.trim() ? 'configured' : 'not_configured'
}

function toAuditView(row: AdminAuditRecord): AdminAuditEventView {
  return {
    id: row.id,
    action: row.action,
    actorAccountId: row.actorAccountId,
    actorEmail: row.actorEmail,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata,
    createdAt: row.createdAt,
  }
}

function recordAdminAction(
  actor: AccountRecord,
  action: AdminAuditRecord['action'],
  targetType: string,
  targetId: string,
  metadata: AdminAuditRecord['metadata'] = {},
): AdminAuditEventView {
  return toAuditView(
    appendAdminAuditEvent({
      action,
      actorAccountId: actor.id,
      actorEmail: actor.email,
      targetType,
      targetId,
      metadata,
    }),
  )
}

function indexUsageByAccount(): { counts: Map<string, number>; last: Map<string, number> } {
  const counts = new Map<string, number>()
  const last = new Map<string, number>()
  for (const row of listUsage()) {
    const id = row.accountId
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
    last.set(id, Math.max(last.get(id) ?? 0, row.createdAt))
  }
  return { counts, last }
}

function lastActivityAt(
  accountId: string,
  accountUpdatedAt: number,
  usageIndex?: { last: Map<string, number> },
): number | null {
  if (usageIndex) {
    const usageLast = usageIndex.last.get(accountId) ?? 0
    const times = [accountUpdatedAt, usageLast].filter((value) => value > 0)
    return times.length > 0 ? Math.max(...times) : null
  }
  const usageTimes = listUsage({ accountId }).map((row) => row.createdAt)
  const sessionTimes = listSessionsForAccount(accountId).map((row) => row.createdAt)
  const times = [...usageTimes, ...sessionTimes, accountUpdatedAt].filter((value) => value > 0)
  return times.length > 0 ? Math.max(...times) : null
}

function subscriptionInterval(
  config: AppConfig,
  subscription: SubscriptionRecord,
): AdminSubscriptionListItem['interval'] {
  if (config.paddlePriceIdProYearly && subscription.priceId === config.paddlePriceIdProYearly) return 'year'
  if (config.paddlePriceIdPro && subscription.priceId === config.paddlePriceIdPro) return 'month'
  return 'unknown'
}

function subscriptionAmount(
  config: AppConfig,
  subscription: SubscriptionRecord,
): { amountCents: number | null; currency: string | null } {
  const interval = subscriptionInterval(config, subscription)
  if (interval === 'year') return { amountCents: PRO_YEARLY_PRICE_CENTS, currency: 'USD' }
  if (interval === 'month') return { amountCents: PRO_MONTHLY_PRICE_CENTS, currency: 'USD' }
  return { amountCents: null, currency: null }
}

function toSubscriptionItem(config: AppConfig, subscription: SubscriptionRecord): AdminSubscriptionListItem {
  const account = findAccountById(subscription.accountId)
  const amount = subscriptionAmount(config, subscription)
  return {
    paddleSubscriptionId: subscription.paddleSubscriptionId,
    paddleCustomerId: subscription.paddleCustomerId,
    accountId: subscription.accountId,
    email: account?.email ?? 'unknown',
    plan: subscription.plan,
    status: subscription.status,
    interval: subscriptionInterval(config, subscription),
    amountCents: amount.amountCents,
    currency: amount.currency,
    createdAt: subscription.currentPeriodStart,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    paymentFailed: subscription.paymentFailed,
    billingEnvironment: subscription.billingEnvironment,
    lastWebhookAt: subscription.lastWebhookAt,
    lastEventOccurredAt: subscription.lastEventOccurredAt,
  }
}

function toUserListItem(
  account: AccountRecord,
  usageIndex?: { counts: Map<string, number>; last: Map<string, number> },
): AdminUserListItem {
  const plan = account.plan === 'trial' || account.plan === 'pro' || account.plan === 'free' ? account.plan : 'free'
  return {
    id: account.id,
    email: account.email,
    plan,
    status: account.status === 'suspended' ? 'suspended' : 'active',
    emailVerified: Boolean(account.emailVerified),
    inTrial: plan === 'trial',
    isPro: plan === 'pro',
    joinedAt: account.createdAt,
    lastActivityAt: lastActivityAt(account.id, account.updatedAt, usageIndex),
    creditsUsedToday: account.dailyCreditsUsed ?? 0,
    requestCount: usageIndex?.counts.get(account.id) ?? listUsage({ accountId: account.id }).length,
  }
}

function kpi(current: number, previous: number | null): AdminOverviewView['kpis']['totalUsers'] {
  if (previous === null) return { value: current, previous: null, deltaPct: null }
  if (previous === 0) return { value: current, previous, deltaPct: current === 0 ? 0 : 100 }
  return { value: current, previous, deltaPct: Math.round(((current - previous) / previous) * 1000) / 10 }
}

function countActiveUsers(sinceMs: number, untilMs: number): number {
  const ids = new Set<string>()
  for (const row of listUsage()) {
    if (row.createdAt >= sinceMs && row.createdAt < untilMs && row.accountId) ids.add(row.accountId)
  }
  return ids.size
}

export function getAdminOverview(config: AppConfig, rangeDays: AdminRangeDays): AdminOverviewView {
  const now = Date.now()
  const since = now - rangeDays * DAY_MS
  const prevSince = since - rangeDays * DAY_MS
  const accounts = listAllAccounts()
  const usage = listUsage()
  const usageIndex = indexUsageByAccount()
  const subscriptions = listAllSubscriptions()
  const tickets = listAllSupportTickets()

  const newUsers = accounts.filter((row) => row.createdAt >= since).length
  const prevNewUsers = accounts.filter((row) => row.createdAt >= prevSince && row.createdAt < since).length
  const active = countActiveUsers(since, now)
  const prevActive = countActiveUsers(prevSince, since)
  const freeUsers = accounts.filter((row) => row.plan === 'free').length
  const trialUsers = accounts.filter((row) => row.plan === 'trial').length
  const proUsers = accounts.filter((row) => row.plan === 'pro').length
  const activeSubs = subscriptions.filter((row) => row.status === 'active' || row.status === 'trialing').length
  const prevActiveSubs = activeSubs
  const rangeUsage = usage.filter((row) => row.createdAt >= since)
  const prevUsage = usage.filter((row) => row.createdAt >= prevSince && row.createdAt < since)
  const credits = rangeUsage.reduce((sum, row) => sum + (row.creditsCharged ?? 0), 0)
  const prevCredits = prevUsage.reduce((sum, row) => sum + (row.creditsCharged ?? 0), 0)

  const growthDays = Math.min(rangeDays, 30)
  const userGrowth = Array.from({ length: growthDays }, (_, index) => {
    const dayStart = now - (growthDays - 1 - index) * DAY_MS
    const key = utcDayKey(dayStart)
    return {
      date: key,
      newUsers: accounts.filter((row) => utcDayKey(row.createdAt) === key).length,
      total: accounts.filter((row) => utcDayKey(row.createdAt) <= key).length,
    }
  })

  const aiUsage = Array.from({ length: Math.min(rangeDays, 30) }, (_, index) => {
    const dayStart = now - (Math.min(rangeDays, 30) - 1 - index) * DAY_MS
    const key = utcDayKey(dayStart)
    const rows = rangeUsage.filter((row) => utcDayKey(row.createdAt) === key)
    return {
      date: key,
      requests: rows.length,
      credits: rows.reduce((sum, row) => sum + (row.creditsCharged ?? 0), 0),
      failures: rows.filter((row) => row.status === 'failure').length,
    }
  })

  const catalogMrr =
    activeSubs > 0
      ? subscriptions
          .filter((row) => row.status === 'active' || row.status === 'trialing')
          .reduce((sum, row) => {
            const interval = subscriptionInterval(config, row)
            if (interval === 'year') return sum + Math.round(PRO_YEARLY_PRICE_CENTS / 12)
            if (interval === 'month') return sum + PRO_MONTHLY_PRICE_CENTS
            return sum
          }, 0)
      : 0

  return {
    rangeDays,
    generatedAt: now,
    kpis: {
      totalUsers: kpi(accounts.length, accounts.filter((row) => row.createdAt < since).length),
      activeUsers: kpi(active, prevActive),
      newUsers: kpi(newUsers, prevNewUsers),
      freeUsers: kpi(freeUsers, null),
      trialUsers: kpi(trialUsers, null),
      proUsers: kpi(proUsers, null),
      activeSubscriptions: kpi(activeSubs, prevActiveSubs),
      aiRequests: kpi(rangeUsage.length, prevUsage.length),
      creditsConsumed: kpi(credits, prevCredits),
    },
    estimatedCatalogMrrCents: getBillingStatus(config).configured ? catalogMrr : null,
    estimatedCatalogMrrNote: getBillingStatus(config).configured ? 'catalog_estimate' : 'unavailable',
    userGrowth,
    planDistribution: [
      { plan: 'free', count: freeUsers },
      { plan: 'trial', count: trialUsers },
      { plan: 'pro', count: proUsers },
    ],
    aiUsage,
    recentSignups: accounts
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((row) => toUserListItem(row, usageIndex)),
    recentSubscriptions: subscriptions
      .slice()
      .sort((a, b) => b.lastWebhookAt - a.lastWebhookAt)
      .slice(0, 8)
      .map((row) => toSubscriptionItem(config, row)),
    recentSupport: tickets.slice(0, 8).map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
    })),
    recentAdminActivity: listAdminAuditEvents().slice(0, 12).map(toAuditView),
  }
}

export function listAdminUsers(query: {
  q?: string
  plan?: string
  status?: string
  from?: string
  to?: string
  sort?: string
  page?: string | null
  pageSize?: string | null
}): AdminUserListView {
  const pageSize = parsePageSize(query.pageSize ?? null)
  const needle = (query.q ?? '').trim().toLowerCase()
  const plan = query.plan && query.plan !== 'all' ? query.plan : ''
  const status = query.status && query.status !== 'all' ? query.status : ''
  const from = query.from ? Date.parse(query.from) : NaN
  const to = query.to ? Date.parse(query.to) : NaN
  const usageIndex = indexUsageByAccount()
  let items = listAllAccounts().map((row) => toUserListItem(row, usageIndex))
  if (needle) items = items.filter((row) => row.email.toLowerCase().includes(needle) || row.id.toLowerCase().includes(needle))
  if (plan) items = items.filter((row) => row.plan === plan)
  if (status) items = items.filter((row) => row.status === status)
  if (Number.isFinite(from)) items = items.filter((row) => row.joinedAt >= from)
  if (Number.isFinite(to)) items = items.filter((row) => row.joinedAt <= to)
  if (query.sort === 'activity') items.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
  else if (query.sort === 'requests') items.sort((a, b) => b.requestCount - a.requestCount)
  else items.sort((a, b) => b.joinedAt - a.joinedAt)
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const page = Math.min(parsePage(query.page ?? null), pages)
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, pageSize, total }
}

export function getAdminUserDetail(config: AppConfig, accountId: string): AdminUserDetailView {
  const account = findAccountById(accountId)
  if (!account) throw new GatewayError('AI_INVALID_REQUEST', 'User not found', 404, 'admin')
  const entitlement = getAccountEntitlement(account.id)
  const student = getActiveStudentBenefit(account.id)
  const subscription = findSubscriptionByAccountId(account.id)
  const usageRows = listUsage({ accountId: account.id })
  const byOperation = new Map<string, number>()
  for (const row of usageRows) {
    byOperation.set(row.operation, (byOperation.get(row.operation) ?? 0) + 1)
  }
  const learning = listAccountLearningEvents(account.id)
  const practice = getAccountPracticeSessions(account.id)
  const prefs = getFeedbackPreferences(account.id)
  return {
    account: {
      id: account.id,
      email: account.email,
      emailVerified: account.emailVerified,
      emailVerifiedAt: account.emailVerifiedAt,
      status: account.status,
      plan: entitlement.plan,
      inTrial: entitlement.inTrial,
      isPro: entitlement.isPro,
      trialEndsAt: account.trialEndsAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      paddleCustomerId: account.paddleCustomerId,
      paddleSubscriptionId: account.paddleSubscriptionId,
      billingEnvironment: account.billingEnvironment,
      studentProActive: Boolean(student),
      studentProExpiresAt: student?.expiresAt ?? null,
    },
    entitlement: {
      plan: entitlement.plan,
      allowed: entitlement.allowed,
      reason: entitlement.reason,
      creditsRemaining: entitlement.creditsRemaining,
      creditsUsed: entitlement.creditsUsed,
      dailyLimit: entitlement.dailyLimit,
      monthlyCreditsUsed: entitlement.monthlyCreditsUsed,
      monthlySoftCap: entitlement.monthlySoftCap,
    },
    subscription: subscription ? toSubscriptionItem(config, subscription) : null,
    usage: {
      requestCount: usageRows.length,
      successCount: usageRows.filter((row) => row.status === 'success').length,
      failureCount: usageRows.filter((row) => row.status === 'failure').length,
      creditsCharged: usageRows.reduce((sum, row) => sum + (row.creditsCharged ?? 0), 0),
      byOperation: [...byOperation.entries()].map(([operation, count]) => ({ operation, count })),
    },
    learning: {
      learningEvents: learning.events.length,
      practiceSessions: practice.sessions.length,
      activeDays: prefs.activeDayKeys.length,
      meaningfulUseCount: prefs.meaningfulUseCount,
      firstWinCompleted: Boolean(prefs.firstWinCompletedAt),
    },
    supportTickets: listSupportTicketsForAccount(account.id).map((ticket) => ({
      id: ticket.id,
      displayNumber: formatSupportTicketNumber(ticket.id),
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
    })),
    sessionCount: listSessionsForAccount(account.id).length,
    lastActivityAt: lastActivityAt(account.id, account.updatedAt),
  }
}

export function listAdminSubscriptions(
  config: AppConfig,
  query: { q?: string; status?: string; page?: string | null; pageSize?: string | null },
): AdminSubscriptionListView {
  const pageSize = parsePageSize(query.pageSize ?? null)
  const needle = (query.q ?? '').trim().toLowerCase()
  let items = listAllSubscriptions().map((row) => toSubscriptionItem(config, row))
  if (needle) {
    items = items.filter(
      (row) =>
        row.email.includes(needle) ||
        row.paddleSubscriptionId.toLowerCase().includes(needle) ||
        row.accountId.includes(needle),
    )
  }
  if (query.status && query.status !== 'all') items = items.filter((row) => row.status === query.status)
  items.sort((a, b) => (b.currentPeriodEnd ?? 0) - (a.currentPeriodEnd ?? 0))
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const page = Math.min(parsePage(query.page ?? null), pages)
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, pageSize, total }
}

function usageBuckets(rows: UsagePersistRecord[]) {
  const byFeature = new Map<string, { requests: number; success: number; failure: number; credits: number }>()
  const byProvider = new Map<string, { requests: number; success: number; failure: number }>()
  const byPlan = new Map<string, { requests: number; credits: number }>()
  for (const row of rows) {
    const feature = byFeature.get(row.operation) ?? { requests: 0, success: 0, failure: 0, credits: 0 }
    feature.requests += 1
    feature.credits += row.creditsCharged ?? 0
    if (row.status === 'success') feature.success += 1
    else feature.failure += 1
    byFeature.set(row.operation, feature)

    const providerName = providerLabel(row.model)
    const provider = byProvider.get(providerName) ?? { requests: 0, success: 0, failure: 0 }
    provider.requests += 1
    if (row.status === 'success') provider.success += 1
    else provider.failure += 1
    byProvider.set(providerName, provider)

    const planKey = row.plan ?? 'unknown'
    const plan = byPlan.get(planKey) ?? { requests: 0, credits: 0 }
    plan.requests += 1
    plan.credits += row.creditsCharged ?? 0
    byPlan.set(planKey, plan)
  }
  return { byFeature, byProvider, byPlan }
}

export function getAdminSubscription(config: AppConfig, paddleSubscriptionId: string): AdminSubscriptionListItem {
  const row = findSubscriptionById(paddleSubscriptionId)
  if (!row) throw new GatewayError('AI_INVALID_REQUEST', 'Subscription not found', 404, 'admin')
  return toSubscriptionItem(config, row)
}

export function getAdminUsage(query: {
  rangeDays: AdminRangeDays
  feature?: string
  status?: string
  plan?: string
  provider?: string
}): AdminUsageView {
  const { rangeDays } = query
  const now = Date.now()
  const since = now - rangeDays * DAY_MS
  const rows = listUsage().filter((row) => {
    if (row.createdAt < since) return false
    if (query.feature && row.operation !== query.feature) return false
    if (query.status && row.status !== query.status) return false
    if (query.plan && row.plan !== query.plan) return false
    if (query.provider && providerLabel(row.model) !== query.provider) return false
    return true
  })
  const buckets = usageBuckets(rows)
  const seriesDays = Math.min(rangeDays, 30)
  return {
    rangeDays,
    totals: {
      requests: rows.length,
      success: rows.filter((row) => row.status === 'success').length,
      failure: rows.filter((row) => row.status === 'failure').length,
      creditsConsumed: rows.reduce((sum, row) => sum + (row.creditsCharged ?? 0), 0),
    },
    byFeature: [...buckets.byFeature.entries()].map(([feature, value]) => ({ feature, ...value })),
    byProvider: [...buckets.byProvider.entries()].map(([provider, value]) => ({ provider, ...value })),
    byPlan: [...buckets.byPlan.entries()].map(([plan, value]) => ({ plan, ...value })),
    series: Array.from({ length: seriesDays }, (_, index) => {
      const key = utcDayKey(now - (seriesDays - 1 - index) * DAY_MS)
      const dayRows = rows.filter((row) => utcDayKey(row.createdAt) === key)
      return {
        date: key,
        requests: dayRows.length,
        success: dayRows.filter((row) => row.status === 'success').length,
        failure: dayRows.filter((row) => row.status === 'failure').length,
        credits: dayRows.reduce((sum, row) => sum + (row.creditsCharged ?? 0), 0),
      }
    }),
    cacheHits: { available: false },
  }
}

export function getAdminActivity(
  config: AppConfig,
  query: { q?: string; page?: string | null; pageSize?: string | null },
): AdminActivityView {
  const pageSize = parsePageSize(query.pageSize ?? null)
  const needle = (query.q ?? '').trim().toLowerCase()
  const events = listAdminAuditEvents()
    .map(toAuditView)
    .filter((row) =>
      !needle
        ? true
        : row.action.includes(needle) ||
          row.actorEmail.includes(needle) ||
          row.targetId.toLowerCase().includes(needle),
    )
  const total = events.length
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const page = Math.min(parsePage(query.page ?? null), pages)
  const start = (page - 1) * pageSize
  return {
    items: events.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    operational: {
      signups: listAllAccounts()
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 12)
        .map((row) => ({ id: row.id, email: row.email, createdAt: row.createdAt })),
      subscriptionChanges: listAllSubscriptions()
        .slice()
        .sort((a, b) => b.lastWebhookAt - a.lastWebhookAt)
        .slice(0, 12)
        .map((row) => toSubscriptionItem(config, row)),
      webhookEvents: listRecentWebhookEvents(20).map((row) => ({
        eventId: row.eventId,
        eventType: row.eventType,
        processedAt: row.processedAt,
      })),
    },
  }
}

export function getAdminSettings(config: AppConfig): AdminSettingsView {
  const billing = getBillingStatus(config)
  return {
    env: config.env,
    billing: {
      configured: billing.configured,
      environment: billing.environment,
      checkoutAvailable: billing.checkoutAvailable,
      webhookConfigured: billing.webhookConfigured,
      portalAvailable: billing.portalAvailable,
      provider: billing.id,
    },
    providers: {
      groq: configuredFlag(config.groqApiKey),
      gemini: configuredFlag(config.geminiApiKey),
      openrouter: configuredFlag(config.openRouterApiKey),
      googleTranslate: config.googleTranslateEnabled && Boolean(config.googleProjectId || config.googleTranslateApiKey)
        ? 'configured'
        : 'not_configured',
      smtp: configuredFlag(config.smtpHost),
    },
    features: {
      advisorEnabled: config.advisorEnabled,
      writingReviewEnabled: config.writingReviewEnabled,
      googleTranslateEnabled: config.googleTranslateEnabled,
      publicStatsEnabled: config.publicStatsEnabled,
    },
    providerHealth: getAdvisorProviderHealth(config).map((row) => ({
      provider: row.provider,
      state: row.state,
      enabled: row.enabled,
      successfulRequests: row.successfulRequests,
      consecutiveFailures: row.consecutiveFailures,
      recentLatencyMs: row.recentLatencyMs,
    })),
  }
}

export function searchAdmin(config: AppConfig, q: string): AdminSearchView {
  const needle = q.trim().toLowerCase()
  if (needle.length < 2) return { query: q, items: [] }
  const items: AdminSearchView['items'] = []
  for (const account of listAllAccounts()) {
    if (account.email.includes(needle) || account.id.includes(needle)) {
      items.push({
        type: 'user',
        id: account.id,
        title: account.email,
        subtitle: account.plan,
        href: `/admin/users/${account.id}`,
      })
    }
    if (items.length >= 20) break
  }
  for (const sub of listAllSubscriptions()) {
    if (sub.paddleSubscriptionId.toLowerCase().includes(needle)) {
      items.push({
        type: 'subscription',
        id: sub.paddleSubscriptionId,
        title: sub.paddleSubscriptionId,
        subtitle: sub.status,
        href: `/admin/subscriptions?id=${encodeURIComponent(sub.paddleSubscriptionId)}`,
      })
    }
  }
  for (const ticket of listAllSupportTickets()) {
    if (ticket.subject.toLowerCase().includes(needle) || ticket.id.includes(needle)) {
      items.push({
        type: 'ticket',
        id: ticket.id,
        title: ticket.subject,
        subtitle: ticket.status,
        href: `/admin/support?id=${encodeURIComponent(ticket.id)}`,
      })
    }
  }
  return { query: q, items: items.slice(0, 20) }
}

export function suspendAdminUser(
  config: AppConfig,
  actor: AccountRecord,
  accountId: string,
  _confirmed: true,
): AdminUserDetailView {
  void _confirmed
  if (actor.id === accountId) {
    throw new GatewayError('AI_INVALID_REQUEST', 'You cannot suspend your own admin account', 400, 'admin')
  }
  const account = findAccountById(accountId)
  if (!account) throw new GatewayError('AI_INVALID_REQUEST', 'User not found', 404, 'admin')
  updateAccount({ ...account, status: 'suspended' })
  deleteSessionsForAccount(accountId)
  recordAdminAction(actor, 'account.suspend', 'account', accountId, { email: account.email })
  return getAdminUserDetail(config, accountId)
}

export function restoreAdminUser(
  config: AppConfig,
  actor: AccountRecord,
  accountId: string,
  _confirmed: true,
): AdminUserDetailView {
  void _confirmed
  const account = findAccountById(accountId)
  if (!account) throw new GatewayError('AI_INVALID_REQUEST', 'User not found', 404, 'admin')
  updateAccount({ ...account, status: 'active' })
  recordAdminAction(actor, 'account.restore', 'account', accountId, { email: account.email })
  return getAdminUserDetail(config, accountId)
}

export function revokeAdminUserSessions(
  actor: AccountRecord,
  accountId: string,
  _confirmed: true,
): { revoked: true; sessionCount: number } {
  void _confirmed
  const account = findAccountById(accountId)
  if (!account) throw new GatewayError('AI_INVALID_REQUEST', 'User not found', 404, 'admin')
  const sessionCount = listSessionsForAccount(accountId).length
  deleteSessionsForAccount(accountId)
  recordAdminAction(actor, 'account.revoke_sessions', 'account', accountId, { email: account.email, sessionCount })
  return { revoked: true, sessionCount }
}

export function recordAdminMutation(
  actor: AccountRecord,
  action: AdminAuditRecord['action'],
  targetType: string,
  targetId: string,
  metadata: AdminAuditRecord['metadata'] = {},
): void {
  recordAdminAction(actor, action, targetType, targetId, metadata)
}
