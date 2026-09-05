import type { AccountPlan, AccountStatus, BillingEnvironment, FlowlarySubscriptionStatus } from './account/types.ts'

export const ADMIN_RANGE_DAYS = [1, 7, 30, 90] as const
export type AdminRangeDays = (typeof ADMIN_RANGE_DAYS)[number]

export type AdminAuditAction =
  | 'account.suspend'
  | 'account.restore'
  | 'account.revoke_sessions'
  | 'support.reply'
  | 'support.update'
  | 'feedback.update'
  | 'testimonial.update'

export type AdminAuditEventView = {
  id: string
  action: string
  actorAccountId: string
  actorEmail: string
  targetType: string
  targetId: string
  metadata: Record<string, string | number | boolean | null>
  createdAt: number
}

export type AdminKpiValue = {
  value: number
  previous: number | null
  deltaPct: number | null
}

export type AdminOverviewView = {
  rangeDays: AdminRangeDays
  generatedAt: number
  kpis: {
    totalUsers: AdminKpiValue
    activeUsers: AdminKpiValue
    newUsers: AdminKpiValue
    freeUsers: AdminKpiValue
    trialUsers: AdminKpiValue
    proUsers: AdminKpiValue
    activeSubscriptions: AdminKpiValue
    aiRequests: AdminKpiValue
    creditsConsumed: AdminKpiValue
  }
  estimatedCatalogMrrCents: number | null
  estimatedCatalogMrrNote: 'catalog_estimate' | 'unavailable'
  userGrowth: { date: string; total: number; newUsers: number }[]
  planDistribution: { plan: string; count: number }[]
  aiUsage: { date: string; requests: number; credits: number; failures: number }[]
  recentSignups: AdminUserListItem[]
  recentSubscriptions: AdminSubscriptionListItem[]
  recentSupport: { id: string; subject: string; status: string; priority: string; createdAt: number }[]
  recentAdminActivity: AdminAuditEventView[]
}

export type AdminUserListItem = {
  id: string
  email: string
  plan: AccountPlan | 'anonymous'
  status: AccountStatus
  emailVerified: boolean
  inTrial: boolean
  isPro: boolean
  joinedAt: number
  lastActivityAt: number | null
  creditsUsedToday: number
  requestCount: number
}

export type AdminUserListView = {
  items: AdminUserListItem[]
  page: number
  pageSize: number
  total: number
}

export type AdminUserDetailView = {
  account: {
    id: string
    email: string
    emailVerified: boolean
    emailVerifiedAt: number | null
    status: AccountStatus
    plan: AccountPlan | 'anonymous'
    inTrial: boolean
    isPro: boolean
    trialEndsAt: number | null
    createdAt: number
    updatedAt: number
    paddleCustomerId: string | null
    paddleSubscriptionId: string | null
    billingEnvironment: BillingEnvironment | null
    studentProActive: boolean
    studentProExpiresAt: number | null
  }
  entitlement: {
    plan: AccountPlan | 'anonymous'
    allowed: boolean
    reason?: string
    creditsRemaining: number
    creditsUsed: number
    dailyLimit: number
    monthlyCreditsUsed: number
    monthlySoftCap: number | null
  }
  subscription: AdminSubscriptionListItem | null
  usage: {
    requestCount: number
    successCount: number
    failureCount: number
    creditsCharged: number
    byOperation: { operation: string; count: number }[]
  }
  learning: {
    learningEvents: number
    practiceSessions: number
    activeDays: number
    meaningfulUseCount: number
    firstWinCompleted: boolean
  }
  supportTickets: { id: string; displayNumber: string; subject: string; status: string; createdAt: number }[]
  sessionCount: number
  lastActivityAt: number | null
}

export type AdminSubscriptionListItem = {
  paddleSubscriptionId: string
  paddleCustomerId: string
  accountId: string
  email: string
  plan: 'free' | 'pro'
  status: FlowlarySubscriptionStatus
  interval: 'month' | 'year' | 'unknown'
  amountCents: number | null
  currency: string | null
  createdAt: number | null
  currentPeriodStart: number | null
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
  paymentFailed: boolean
  billingEnvironment: BillingEnvironment
  lastWebhookAt: number
  lastEventOccurredAt: string | null
}

export type AdminSubscriptionListView = {
  items: AdminSubscriptionListItem[]
  page: number
  pageSize: number
  total: number
}

export type AdminUsageView = {
  rangeDays: AdminRangeDays
  totals: {
    requests: number
    success: number
    failure: number
    creditsConsumed: number
  }
  byFeature: { feature: string; requests: number; success: number; failure: number; credits: number }[]
  byProvider: { provider: string; requests: number; success: number; failure: number }[]
  byPlan: { plan: string; requests: number; credits: number }[]
  series: { date: string; requests: number; success: number; failure: number; credits: number }[]
  cacheHits: { available: false }
}

export type AdminSettingsView = {
  env: string
  billing: {
    configured: boolean
    environment: BillingEnvironment
    checkoutAvailable: boolean
    webhookConfigured: boolean
    portalAvailable: boolean
    provider: 'paddle' | 'none'
  }
  providers: {
    groq: 'configured' | 'not_configured'
    gemini: 'configured' | 'not_configured'
    openrouter: 'configured' | 'not_configured'
    googleTranslate: 'configured' | 'not_configured'
    smtp: 'configured' | 'not_configured'
  }
  features: {
    advisorEnabled: boolean
    writingReviewEnabled: boolean
    googleTranslateEnabled: boolean
    publicStatsEnabled: boolean
  }
  providerHealth: {
    provider: string
    state: string
    enabled: boolean
    successfulRequests: number
    consecutiveFailures: number
    recentLatencyMs?: number
  }[]
}

export type AdminSearchHit = {
  type: 'user' | 'subscription' | 'ticket' | 'activity'
  id: string
  title: string
  subtitle: string
  href: string
}

export type AdminSearchView = {
  query: string
  items: AdminSearchHit[]
}

export type AdminActivityView = {
  items: AdminAuditEventView[]
  page: number
  pageSize: number
  total: number
  operational: {
    signups: { id: string; email: string; createdAt: number }[]
    subscriptionChanges: AdminSubscriptionListItem[]
    webhookEvents: { eventId: string; eventType: string; processedAt: number }[]
  }
}
