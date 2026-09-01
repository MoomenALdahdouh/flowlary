import {
  listPublicSupportedPlatforms,
  PRODUCT_STATISTICS_THRESHOLDS,
  PRO_MONTHLY_PRICE_CENTS,
  type AccountPersonalStatsView,
  type GrowthAdminSummaryView,
  type PublicFeatureRequestStat,
  type PublicProductStatsView,
  type PublicTestimonialView,
  type PublicTrustPayload,
  type TrustMetricState,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import {
  averageFeedbackRating,
  countFeedbackRatings,
  listAllFeedback,
  listAllFeedbackPreferences,
  listFeatureRequests,
  listPublicFeatureRequests,
} from '../db/feedbackStoreSlice.ts'
import { learningEventsSnapshot } from '../db/learningEventsStoreSlice.ts'
import { learningSyncSnapshot } from '../db/learningSyncStoreSlice.ts'
import { studentSliceSnapshot } from '../db/studentBenefitSlice.ts'
import {
  findAccountById,
  listAllAccounts,
  listAllInstallLinks,
  listAllSubscriptions,
  listUsage,
  type AccountRecord,
} from '../db/store.ts'
import { listPublishedTestimonials, listAllTestimonials } from '../db/testimonialStoreSlice.ts'
import { isFeedbackAdmin } from './feedbackService.ts'
import { resolveServerEntitlementForAccount } from './accountService.ts'

const CACHE_TTL_MS = 10 * 60 * 1000

type CacheEntry<T> = { expiresAt: number; value: T }

let publicTrustCache: CacheEntry<PublicTrustPayload> | null = null
let growthCache: CacheEntry<GrowthAdminSummaryView> | null = null

export function resetProductStatisticsCacheForTests(): void {
  publicTrustCache = null
  growthCache = null
}

function nowMs(): number {
  return Date.now()
}

function sinceDays(days: number): number {
  return nowMs() - days * 24 * 60 * 60 * 1000
}

function metricState(value: number | null | undefined, min: number, enabled: boolean): TrustMetricState {
  if (!enabled) return 'DISABLED'
  if (value == null || value < min) return 'INSUFFICIENT_DATA'
  return 'AVAILABLE'
}

function aggregateUsage(sinceMs?: number) {
  const rows = listUsage().filter((row) => row.status === 'success' && (!sinceMs || row.createdAt >= sinceMs))
  return {
    writingChecks: rows.length,
    corrections: rows.filter((row) => row.operation === 'correction').length,
    translations: rows.filter((row) => row.operation === 'translation').length,
    layoutChecks: rows.filter((row) => row.operation === 'layout-classification').length,
    accountIds: new Set(rows.map((row) => row.accountId).filter(Boolean) as string[]),
  }
}

function activeAccountIdsFromPreferences(sinceMs: number): Set<string> {
  const ids = new Set<string>()
  for (const prefs of listAllFeedbackPreferences()) {
    if (prefs.meaningfulUseCount > 0 && prefs.activeDayKeys.some((day) => Date.parse(`${day}T00:00:00Z`) >= sinceMs)) {
      ids.add(prefs.accountId)
    }
    if (prefs.firstWinCompletedAt && prefs.firstWinCompletedAt >= sinceMs) ids.add(prefs.accountId)
  }
  return ids
}

function buildVerifiedStoreRatings(config: AppConfig) {
  const storeRatings: PublicProductStatsView['storeRatings'] = {}
  if (config.verifiedChromeRating != null && config.verifiedChromeReviewCount != null) {
    storeRatings.chrome = {
      rating: config.verifiedChromeRating,
      reviewCount: config.verifiedChromeReviewCount,
      source: 'chrome_web_store',
    }
  }
  if (config.verifiedEdgeRating != null && config.verifiedEdgeReviewCount != null) {
    storeRatings.edge = {
      rating: config.verifiedEdgeRating,
      reviewCount: config.verifiedEdgeReviewCount,
      source: 'edge_addons',
    }
  }
  return Object.keys(storeRatings).length > 0 ? storeRatings : undefined
}

export function buildPublicProductStats(config: AppConfig): PublicProductStatsView {
  const enabled = config.publicStatsEnabled
  const accounts = listAllAccounts()
  const registeredUsers = accounts.length
  const usageAll = aggregateUsage()
  const usage30 = aggregateUsage(sinceDays(30))
  const activeFromUsage = usage30.accountIds
  const activeFromPrefs = activeAccountIdsFromPreferences(sinceDays(30))
  const activeUsersLast30Days = new Set([...activeFromUsage, ...activeFromPrefs]).size
  const linkedInstalls = listAllInstallLinks().length
  const avg = averageFeedbackRating()
  const ratingCount = countFeedbackRatings()

  const metrics: PublicProductStatsView['metrics'] = {}
  const metricStates: PublicProductStatsView['metricStates'] = {}

  if (metricState(registeredUsers, PRODUCT_STATISTICS_THRESHOLDS.minRegisteredUsers, enabled) === 'AVAILABLE') {
    metrics.registeredUsers = registeredUsers
  }
  metricStates.registeredUsers = metricState(
    registeredUsers,
    PRODUCT_STATISTICS_THRESHOLDS.minRegisteredUsers,
    enabled && config.showRegisteredUsers,
  )

  if (enabled && config.showActiveUsers && activeUsersLast30Days > 0) {
    metrics.activeUsersLast30Days = activeUsersLast30Days
    metricStates.activeUsersLast30Days = 'AVAILABLE'
  } else {
    metricStates.activeUsersLast30Days = enabled ? 'INSUFFICIENT_DATA' : 'DISABLED'
  }

  if (enabled && config.showWritingChecks && usageAll.writingChecks > 0) {
    metrics.writingChecks = usageAll.writingChecks
    metrics.corrections = usageAll.corrections
    metrics.translations = usageAll.translations
    metricStates.writingChecks = 'AVAILABLE'
    metricStates.corrections = 'AVAILABLE'
    metricStates.translations = 'AVAILABLE'
  } else {
    metricStates.writingChecks = enabled ? 'INSUFFICIENT_DATA' : 'DISABLED'
  }

  if (enabled && config.showLinkedInstalls && linkedInstalls > 0) {
    metrics.linkedInstalls = linkedInstalls
    metricStates.linkedInstalls = 'AVAILABLE'
  } else {
    metricStates.linkedInstalls = enabled ? 'INSUFFICIENT_DATA' : 'DISABLED'
  }

  const internalRatingState = metricState(
    ratingCount,
    PRODUCT_STATISTICS_THRESHOLDS.minInternalRatings,
    enabled && config.showInternalRating,
  )
  metricStates.averageInternalRating = internalRatingState
  metricStates.internalRatingCount = internalRatingState
  const internalRating =
    internalRatingState === 'AVAILABLE' && avg != null
      ? { average: avg, count: ratingCount, source: 'flowlary_users' as const }
      : undefined
  if (internalRating) {
    metrics.averageInternalRating = avg!
    metrics.internalRatingCount = ratingCount
  }

  const storeRatings = enabled && config.showStoreRatings ? buildVerifiedStoreRatings(config) : undefined
  if (storeRatings?.chrome) {
    metrics.chromeRating = storeRatings.chrome.rating
    metrics.chromeReviewCount = storeRatings.chrome.reviewCount
    metricStates.chromeRating = 'AVAILABLE'
    metricStates.chromeReviewCount = 'AVAILABLE'
  }
  if (storeRatings?.edge) {
    metrics.edgeRating = storeRatings.edge.rating
    metrics.edgeReviewCount = storeRatings.edge.reviewCount
    metricStates.edgeRating = 'AVAILABLE'
    metricStates.edgeReviewCount = 'AVAILABLE'
  }

  return {
    generatedAt: nowMs(),
    cacheTtlSeconds: Math.round(CACHE_TTL_MS / 1000),
    metrics,
    metricStates,
    internalRating,
    storeRatings,
  }
}

function toPublicFeatureRequest(item: ReturnType<typeof listFeatureRequests>[number]): PublicFeatureRequestStat {
  return {
    id: item.id,
    title: item.title,
    voteCount: item.voteCount,
    status: item.status,
    roadmapBucket: item.publicRoadmap ? item.roadmapBucket : null,
  }
}

function toPublicTestimonial(item: ReturnType<typeof listPublishedTestimonials>[number]): PublicTestimonialView {
  return {
    id: item.id,
    displayName: item.displayName,
    role: item.role,
    country: item.country,
    quote: item.displayQuote,
    feature: item.feature,
  }
}

export function getPublicTrustPayload(config: AppConfig): PublicTrustPayload {
  if (publicTrustCache && publicTrustCache.expiresAt > nowMs()) {
    return publicTrustCache.value
  }
  const stats = buildPublicProductStats(config)
  const featureRequests = config.showFeatureRequests
    ? listPublicFeatureRequests(12)
        .filter((item) => item.voteCount >= PRODUCT_STATISTICS_THRESHOLDS.minFeatureRequestVotes)
        .map(toPublicFeatureRequest)
    : []
  const testimonials =
    config.showTestimonials &&
    listPublishedTestimonials().length >= PRODUCT_STATISTICS_THRESHOLDS.minPublishedTestimonials
      ? listPublishedTestimonials(6).map(toPublicTestimonial)
      : []
  const roadmap = config.showRoadmap
    ? listFeatureRequests()
        .filter((item) => item.publicRoadmap)
        .map(toPublicFeatureRequest)
    : []
  const payload: PublicTrustPayload = {
    stats,
    platforms: config.showPlatforms ? listPublicSupportedPlatforms() : [],
    featureRequests,
    testimonials,
    roadmap,
  }
  publicTrustCache = { expiresAt: nowMs() + CACHE_TTL_MS, value: payload }
  return payload
}

export function getAccountPersonalStats(account: AccountRecord): AccountPersonalStatsView {
  const usage = listUsage({ accountId: account.id }).filter((row) => row.status === 'success')
  const learningStore = learningEventsSnapshot.learningEventsByAccount[account.id]
  const learningEvents = learningStore?.events?.length ?? 0
  const practiceStore = learningSyncSnapshot.practiceSessionsByAccount[account.id]
  const practiceSessions = practiceStore?.sessions?.length ?? 0
  const prefs = listAllFeedbackPreferences().find((row) => row.accountId === account.id)
  const entitlement = resolveServerEntitlementForAccount(account)
  return {
    writingChecksUsed: usage.length,
    corrections: usage.filter((row) => row.operation === 'correction').length,
    translations: usage.filter((row) => row.operation === 'translation').length,
    layoutChecks: usage.filter((row) => row.operation === 'layout-classification').length,
    learningEvents,
    practiceSessions,
    activeDays: prefs?.activeDayKeys.length ?? 0,
    meaningfulUseCount: prefs?.meaningfulUseCount ?? 0,
    firstWinCompleted: Boolean(prefs?.firstWinCompletedAt),
    creditsUsedToday: account.dailyCreditsUsed,
    creditsRemainingToday: entitlement.creditsRemaining ?? null,
  }
}

export function getGrowthAdminSummary(config: AppConfig, account: AccountRecord): GrowthAdminSummaryView {
  if (!isFeedbackAdmin(config, account)) {
    throw new Error('Admin access required')
  }
  if (growthCache && growthCache.expiresAt > nowMs()) {
    return growthCache.value
  }

  const accounts = listAllAccounts()
  const student = studentSliceSnapshot()
  const prefs = listAllFeedbackPreferences()
  const usageAll = aggregateUsage()
  const usage30 = aggregateUsage(sinceDays(30))
  const usage7 = aggregateUsage(sinceDays(7))
  const subscriptions = listAllSubscriptions()
  const activeProSubs = subscriptions.filter((row) => row.plan === 'pro' && row.status === 'active')

  const summary: GrowthAdminSummaryView = {
    acquisition: {
      registeredUsers: accounts.length,
      verifiedEmails: accounts.filter((row) => row.emailVerified).length,
      linkedInstalls: listAllInstallLinks().length,
      trialAccounts: accounts.filter((row) => row.plan === 'trial').length,
      studentApplications: Object.keys(student.verificationRequests).length,
      studentActive: Object.values(student.benefits).filter((row) => row.status === 'active').length,
    },
    activation: {
      firstWinCompleted: prefs.filter((row) => row.firstWinCompletedAt).length,
      meaningfulUseAccounts: prefs.filter((row) => row.meaningfulUseCount > 0).length,
      notInstrumented: ['website_signup_started', 'extension_install_started', 'first_correction_server'],
    },
    engagement: {
      activeUsersLast7Days: usage7.accountIds.size,
      activeUsersLast30Days: new Set([...usage30.accountIds, ...activeAccountIdsFromPreferences(sinceDays(30))]).size,
      writingChecksTotal: usageAll.writingChecks,
      writingChecksLast30Days: usage30.writingChecks,
    },
    retention: {
      notInstrumented: ['D1', 'D7', 'D14', 'D30'],
    },
    monetization: {
      proSubscriptions: activeProSubs.length,
      trialToProNotInstrumented: true,
      mrrCents: activeProSubs.length > 0 ? activeProSubs.length * PRO_MONTHLY_PRICE_CENTS : null,
    },
    feedback: {
      totalFeedback: listAllFeedback().length,
      averageInternalRating: averageFeedbackRating(),
      internalRatingCount: countFeedbackRatings(),
      featureRequests: listFeatureRequests().length,
    },
    funnel: {
      registeredUsers: accounts.length,
      linkedInstalls: listAllInstallLinks().length,
      firstWinCompleted: prefs.filter((row) => row.firstWinCompletedAt).length,
      meaningfulUseAccounts: prefs.filter((row) => row.meaningfulUseCount > 0).length,
      trialAccounts: accounts.filter((row) => row.plan === 'trial').length,
      proAccounts: accounts.filter((row) => row.plan === 'pro').length,
      stagesNotInstrumented: ['visitor', 'signup_started', 'extension_install_started', 'trial_started', 'checkout_started'],
    },
  }

  growthCache = { expiresAt: nowMs() + CACHE_TTL_MS, value: summary }
  return summary
}

export function getAccountForPersonalStats(accountId: string): AccountRecord | null {
  return findAccountById(accountId)
}

export function listTestimonialsForAdmin() {
  return listAllTestimonials()
}
