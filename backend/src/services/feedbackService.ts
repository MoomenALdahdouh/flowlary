import type {
  FeedbackAdminItemView,
  FeedbackAdminSummaryView,
  FeedbackConfigView,
  FeedbackEligibilityView,
  FeedbackEventName,
  FeedbackPreferencesView,
  FeedbackPromptId,
  FeedbackPublicView,
  FeatureRequestPublicView,
} from '@flowlary/shared'
import {
  FEEDBACK_LIMITS,
  clampFeedbackText,
  normalizeDismissAction,
  normalizeFeedbackFeature,
  normalizeFeedbackPromptId,
  normalizeFeedbackSource,
  normalizeFeedbackSurface,
  normalizeFeedbackTags,
  normalizeFeedbackType,
  normalizeRating,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import {
  addFeatureVote,
  appendFeedbackAnalytics,
  averageFeedbackRating,
  countFeatureRequestsSince,
  countFeedbackSince,
  countSupportTicketsSince,
  defaultPreferences,
  getFeatureRequestById,
  getFeedbackById,
  getFeedbackPreferences,
  hasFeatureVote,
  insertFeatureRequest,
  insertFeedback,
  listAllFeedback,
  listFeatureRequests,
  listFeedbackAnalytics,
  listFeedbackForAccount,
  resetFeedbackSliceForTests,
  updateFeedbackRecord,
  upsertFeedbackPreferences,
  type FeedbackRecord,
  type FeatureRequestRecord,
} from '../db/feedbackStoreSlice.ts'
import { findAccountById, touch, type AccountRecord } from '../db/store.ts'
import { GatewayError } from '../gateway/errors.ts'
import { checkFeedbackOperationRateLimit } from '../middleware/rateLimit.ts'
import { resolveServerEntitlementForAccount } from './accountService.ts'
import { maskEmail } from './emailService.ts'
import { maybeCreateTestimonialFromFeedback } from './testimonialService.ts'

function persistTouch(): void {
  touch()
}

function utcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

function toPreferencesView(record = defaultPreferences('')): FeedbackPreferencesView {
  return {
    dontAskAgain: record.dontAskAgain,
    dismissedPrompts: { ...record.dismissedPrompts },
    completedSurveys: { ...record.completedSurveys },
    contextualPromptsShown: { ...record.contextualPromptsShown },
    meaningfulUseCount: record.meaningfulUseCount,
    firstWinCompletedAt: record.firstWinCompletedAt,
    activeDayKeys: [...record.activeDayKeys],
    lastGeneralPromptAt: record.lastGeneralPromptAt,
  }
}

function toFeedbackPublic(record: FeedbackRecord): FeedbackPublicView {
  return {
    id: record.id,
    type: record.type,
    category: record.category,
    title: record.title,
    message: record.message,
    rating: record.rating,
    source: record.source,
    surface: record.surface,
    feature: record.feature,
    status: record.status,
    priority: record.priority,
    tags: [...record.tags],
    locale: record.locale,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resolvedAt: record.resolvedAt,
  }
}

function toFeatureRequestPublic(request: FeatureRequestRecord, accountId: string): FeatureRequestPublicView {
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    category: request.category,
    status: request.status,
    priority: request.priority,
    voteCount: request.voteCount,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    votedByMe: hasFeatureVote(accountId, request.id),
    publicRoadmap: request.publicRoadmap,
    roadmapBucket: request.publicRoadmap ? request.roadmapBucket : null,
  }
}

export function isFeedbackAdmin(config: AppConfig, account: AccountRecord): boolean {
  if (config.feedbackAdminEmails.length === 0) return false
  return config.feedbackAdminEmails.includes(account.email.trim().toLowerCase())
}

export function getFeedbackConfig(config: AppConfig): FeedbackConfigView {
  return {
    chromeWebStoreUrl: config.chromeWebStoreUrl,
    edgeAddonsUrl: config.edgeAddonsUrl,
    storeReviewAvailable: Boolean(config.chromeWebStoreUrl || config.edgeAddonsUrl),
    cooldowns: {
      dismissedPromptMs: FEEDBACK_LIMITS.dismissedPromptCooldownMs,
      surveyCompletedMs: FEEDBACK_LIMITS.surveyCompletedCooldownMs,
      generalPromptMs: FEEDBACK_LIMITS.generalPromptCooldownMs,
    },
    limits: {
      feedbackPerDay: FEEDBACK_LIMITS.feedbackPerDay,
      featureRequestsPerDay: FEEDBACK_LIMITS.featureRequestsPerDay,
      supportTicketsPerDay: FEEDBACK_LIMITS.supportTicketsPerDay,
    },
  }
}

export function trackFeedbackEvent(
  event: FeedbackEventName,
  input: {
    accountId?: string | null
    plan?: string | null
    feature?: string | null
    surface?: string | null
    locale?: string | null
    appVersion?: string | null
  },
): void {
  appendFeedbackAnalytics({
    event,
    accountId: input.accountId ?? null,
    plan: input.plan ?? null,
    feature: input.feature ?? null,
    surface: input.surface ?? null,
    locale: input.locale ?? null,
    appVersion: input.appVersion ?? null,
  })
  persistTouch()
}

function enforceDailyFeedbackLimit(accountId: string, operation: 'feedback' | 'feature-request' | 'support-ticket'): void {
  const since = Date.now() - 24 * 60 * 60 * 1000
  if (operation === 'feedback' && countFeedbackSince(accountId, since) >= FEEDBACK_LIMITS.feedbackPerDay) {
    throw new GatewayError('AI_RATE_LIMITED', 'Daily feedback limit reached', 429, 'feedback')
  }
  if (operation === 'feature-request' && countFeatureRequestsSince(accountId, since) >= FEEDBACK_LIMITS.featureRequestsPerDay) {
    throw new GatewayError('AI_RATE_LIMITED', 'Daily feature request limit reached', 429, 'feedback')
  }
  if (operation === 'support-ticket' && countSupportTicketsSince(accountId, since) >= FEEDBACK_LIMITS.supportTicketsPerDay) {
    throw new GatewayError('AI_RATE_LIMITED', 'Daily support ticket limit reached', 429, 'feedback')
  }
  checkFeedbackOperationRateLimit(accountId, operation)
}

export function recordMeaningfulUse(accountId: string, feature?: string | null): FeedbackPreferencesView {
  const prefs = getFeedbackPreferences(accountId)
  const dayKey = utcDayKey()
  const activeDayKeys = prefs.activeDayKeys.includes(dayKey) ? prefs.activeDayKeys : [...prefs.activeDayKeys, dayKey].slice(-60)
  const next = upsertFeedbackPreferences(accountId, { meaningfulUseCount: prefs.meaningfulUseCount + 1, activeDayKeys })
  persistTouch()
  return toPreferencesView(next)
}

export function markFirstWinCompleted(accountId: string): FeedbackPreferencesView {
  const next = upsertFeedbackPreferences(accountId, { firstWinCompletedAt: Date.now() })
  persistTouch()
  return toPreferencesView(next)
}

export function getFeedbackEligibility(account: AccountRecord): FeedbackEligibilityView {
  const prefs = getFeedbackPreferences(account.id)
  const now = Date.now()
  const eligible: FeedbackPromptId[] = []
  if (prefs.dontAskAgain) return { eligiblePrompts: [], preferences: toPreferencesView(prefs) }

  const dismissedAt = (id: FeedbackPromptId) => prefs.dismissedPrompts[id] ?? 0
  const completedAt = (id: FeedbackPromptId) => prefs.completedSurveys[id] ?? 0
  const cooldownOk = (at: number, ms: number) => !at || now - at >= ms

  if (
    prefs.meaningfulUseCount >= FEEDBACK_LIMITS.meaningfulUsesBeforeGeneralPrompt &&
    cooldownOk(prefs.lastGeneralPromptAt ?? 0, FEEDBACK_LIMITS.generalPromptCooldownMs) &&
    cooldownOk(dismissedAt('general_satisfaction'), FEEDBACK_LIMITS.dismissedPromptCooldownMs) &&
    !completedAt('general_satisfaction')
  ) {
    eligible.push('general_satisfaction')
  }
  if (
    prefs.activeDayKeys.length >= FEEDBACK_LIMITS.day7ActiveDays &&
    cooldownOk(dismissedAt('day7_usefulness'), FEEDBACK_LIMITS.dismissedPromptCooldownMs) &&
    !completedAt('day7_usefulness')
  ) {
    eligible.push('day7_usefulness')
  }
  if (
    prefs.activeDayKeys.length >= FEEDBACK_LIMITS.day14ActiveDays &&
    cooldownOk(dismissedAt('day14_feature_preference'), FEEDBACK_LIMITS.dismissedPromptCooldownMs) &&
    !completedAt('day14_feature_preference')
  ) {
    eligible.push('day14_feature_preference')
  }
  if (
    prefs.activeDayKeys.length >= FEEDBACK_LIMITS.day30ActiveDays &&
    cooldownOk(dismissedAt('day30_deeper'), FEEDBACK_LIMITS.surveyCompletedCooldownMs) &&
    !completedAt('day30_deeper')
  ) {
    eligible.push('day30_deeper')
  }

  return { eligiblePrompts: eligible, preferences: toPreferencesView(prefs) }
}

export function dismissFeedbackPrompt(accountId: string, input: { promptId: unknown; action: unknown }): FeedbackPreferencesView {
  const promptId = normalizeFeedbackPromptId(input.promptId)
  const action = normalizeDismissAction(input.action)
  if (!promptId || !action) throw new GatewayError('AI_INVALID_REQUEST', 'Invalid dismiss payload', 400, 'feedback')
  const prefs = getFeedbackPreferences(accountId)
  const patch: Partial<ReturnType<typeof getFeedbackPreferences>> = {
    dismissedPrompts: { ...prefs.dismissedPrompts, [promptId]: Date.now() },
  }
  if (action === 'dont_ask_again') patch.dontAskAgain = true
  if (promptId === 'general_satisfaction') patch.lastGeneralPromptAt = Date.now()
  const next = upsertFeedbackPreferences(accountId, patch)
  trackFeedbackEvent('feedback_prompt_dismissed', { accountId, surface: 'contextual' })
  persistTouch()
  return toPreferencesView(next)
}

export function markPromptShown(accountId: string, promptIdRaw: unknown): FeedbackPreferencesView {
  const promptId = normalizeFeedbackPromptId(promptIdRaw)
  if (!promptId) throw new GatewayError('AI_INVALID_REQUEST', 'Invalid prompt id', 400, 'feedback')
  const prefs = getFeedbackPreferences(accountId)
  const next = upsertFeedbackPreferences(accountId, {
    contextualPromptsShown: { ...prefs.contextualPromptsShown, [promptId]: Date.now() },
    lastGeneralPromptAt: promptId === 'general_satisfaction' ? Date.now() : prefs.lastGeneralPromptAt,
  })
  trackFeedbackEvent('feedback_prompt_shown', { accountId, surface: 'contextual' })
  persistTouch()
  return toPreferencesView(next)
}

export function submitFeedback(account: AccountRecord, body: Record<string, unknown>): FeedbackPublicView {
  enforceDailyFeedbackLimit(account.id, 'feedback')
  const type = normalizeFeedbackType(body.type) ?? 'GENERAL_FEEDBACK'
  const message = clampFeedbackText(body.message, FEEDBACK_LIMITS.messageMax)
  if (!message) throw new GatewayError('AI_INVALID_REQUEST', 'Message is required', 400, 'feedback')
  const metadataRaw = body.metadata
  const record = insertFeedback({
    accountId: account.id,
    type,
    category: typeof body.category === 'string' ? body.category.slice(0, 64) : null,
    title: clampFeedbackText(body.title, FEEDBACK_LIMITS.titleMax) || null,
    message,
    rating: body.rating === undefined || body.rating === null ? null : normalizeRating(body.rating),
    source: normalizeFeedbackSource(body.source) ?? 'website',
    surface: normalizeFeedbackSurface(body.surface) ?? 'support',
    feature: normalizeFeedbackFeature(body.feature),
    status: 'SUBMITTED',
    priority: 'MEDIUM',
    tags: normalizeFeedbackTags(body.tags),
    locale: typeof body.locale === 'string' ? body.locale.slice(0, 16) : 'en',
    metadata:
      metadataRaw && typeof metadataRaw === 'object'
        ? {
            userAgent: typeof (metadataRaw as Record<string, unknown>).userAgent === 'string'
              ? String((metadataRaw as Record<string, unknown>).userAgent).slice(0, 300)
              : undefined,
            extensionVersion:
              typeof (metadataRaw as Record<string, unknown>).extensionVersion === 'string'
                ? String((metadataRaw as Record<string, unknown>).extensionVersion).slice(0, 32)
                : undefined,
            appVersion:
              typeof (metadataRaw as Record<string, unknown>).appVersion === 'string'
                ? String((metadataRaw as Record<string, unknown>).appVersion).slice(0, 32)
                : undefined,
            includeDiagnostics: Boolean((metadataRaw as Record<string, unknown>).includeDiagnostics),
          }
        : null,
  })
  if (record.rating) trackFeedbackEvent('rating_submitted', { accountId: account.id, surface: record.surface })
  trackFeedbackEvent('feedback_submitted', { accountId: account.id, feature: record.feature, surface: record.surface })
  const promptId = normalizeFeedbackPromptId(body.promptId)
  if (promptId) {
    const prefs = getFeedbackPreferences(account.id)
    upsertFeedbackPreferences(account.id, { completedSurveys: { ...prefs.completedSurveys, [promptId]: Date.now() } })
    trackFeedbackEvent('survey_completed', { accountId: account.id, surface: record.surface })
  }
  maybeCreateTestimonialFromFeedback(account, record, body)
  if (body.testimonialConsent === 'yes') {
    trackFeedbackEvent('testimonial_consent_given', { accountId: account.id, surface: record.surface })
  }
  persistTouch()
  return toFeedbackPublic(record)
}

export function submitRating(account: AccountRecord, body: Record<string, unknown>): FeedbackPublicView {
  const rating = normalizeRating(body.rating)
  if (!rating) throw new GatewayError('AI_INVALID_REQUEST', 'Rating must be 1-5', 400, 'feedback')
  return submitFeedback(account, {
    ...body,
    type: 'SATISFACTION',
    rating,
    message: clampFeedbackText(body.message, FEEDBACK_LIMITS.messageMax) || (rating <= 3 ? 'Needs improvement' : 'Positive experience'),
  })
}

export function createFeatureRequest(account: AccountRecord, body: Record<string, unknown>): FeatureRequestPublicView {
  enforceDailyFeedbackLimit(account.id, 'feature-request')
  const title = clampFeedbackText(body.title, FEEDBACK_LIMITS.titleMax)
  const description = clampFeedbackText(body.description, FEEDBACK_LIMITS.descriptionMax)
  if (!title || !description) throw new GatewayError('AI_INVALID_REQUEST', 'Title and description required', 400, 'feedback')
  const duplicate = listFeatureRequests().find((item) => item.title.trim().toLowerCase() === title.toLowerCase())
  if (duplicate) {
    addFeatureVote(account.id, duplicate.id)
    persistTouch()
    return toFeatureRequestPublic(getFeatureRequestById(duplicate.id)!, account.id)
  }
  const request = insertFeatureRequest({
    createdByAccountId: account.id,
    title,
    description,
    category: typeof body.category === 'string' ? body.category.slice(0, 64) : null,
    status: 'SUBMITTED',
    priority: 'MEDIUM',
    voteCount: 0,
  })
  addFeatureVote(account.id, request.id)
  insertFeedback({
    accountId: account.id,
    type: 'FEATURE_REQUEST',
    category: request.category,
    title: request.title,
    message: request.description,
    rating: null,
    source: normalizeFeedbackSource(body.source) ?? 'website',
    surface: normalizeFeedbackSurface(body.surface) ?? 'support',
    feature: normalizeFeedbackFeature(body.feature),
    status: 'SUBMITTED',
    priority: 'MEDIUM',
    tags: ['OTHER'],
    locale: typeof body.locale === 'string' ? body.locale.slice(0, 16) : 'en',
    metadata: null,
  })
  trackFeedbackEvent('feature_request_created', { accountId: account.id, surface: 'support' })
  persistTouch()
  return toFeatureRequestPublic(request, account.id)
}

export function voteFeatureRequest(accountId: string, featureRequestId: string): FeatureRequestPublicView {
  if (!getFeatureRequestById(featureRequestId)) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Feature request not found', 404, 'feedback')
  }
  if (hasFeatureVote(accountId, featureRequestId)) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Already voted', 400, 'feedback')
  }
  checkFeedbackOperationRateLimit(accountId, 'feature-vote')
  const updated = addFeatureVote(accountId, featureRequestId)
  if (!updated) throw new GatewayError('AI_INVALID_REQUEST', 'Could not vote', 400, 'feedback')
  trackFeedbackEvent('feature_request_voted', { accountId, surface: 'support' })
  persistTouch()
  return toFeatureRequestPublic(updated, accountId)
}

export function listPublicFeatureRequests(accountId: string): FeatureRequestPublicView[] {
  return listFeatureRequests().map((request) => toFeatureRequestPublic(request, accountId))
}

export function listAccountFeedback(accountId: string): FeedbackPublicView[] {
  return listFeedbackForAccount(accountId).map(toFeedbackPublic)
}

export function getAdminSummary(): FeedbackAdminSummaryView {
  const all = listAllFeedback()
  const open = all.filter((item) => ['SUBMITTED', 'OPEN', 'UNDER_REVIEW', 'INVESTIGATING', 'WAITING_FOR_USER'].includes(item.status))
  return {
    total: all.length,
    open: open.length,
    unresolved: open.length,
    featureRequests: all.filter((item) => item.type === 'FEATURE_REQUEST').length,
    bugReports: all.filter((item) => item.type === 'BUG_REPORT').length,
    averageRating: averageFeedbackRating(),
  }
}

export function listAdminFeedbackItems(filters: { type?: string; status?: string; limit?: number }): FeedbackAdminItemView[] {
  let items = listAllFeedback()
  if (filters.type) items = items.filter((item) => item.type === filters.type)
  if (filters.status) items = items.filter((item) => item.status === filters.status)
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  return items.slice(0, limit).map((item) => ({
    ...toFeedbackPublic(item),
    accountId: item.accountId,
    accountEmailMasked: maskEmail(findAccountById(item.accountId)?.email ?? 'unknown'),
    plan: findAccountById(item.accountId)?.plan ?? 'unknown',
    internalNotes: [...item.internalNotes],
  }))
}

export function adminUpdateFeedback(feedbackId: string, patch: Record<string, unknown>): FeedbackAdminItemView {
  const current = getFeedbackById(feedbackId)
  if (!current) throw new GatewayError('AI_INVALID_REQUEST', 'Feedback not found', 404, 'feedback')
  const status = typeof patch.status === 'string' ? patch.status : current.status
  const priority = typeof patch.priority === 'string' ? patch.priority : current.priority
  const note = typeof patch.internalNote === 'string' ? patch.internalNote.trim().slice(0, FEEDBACK_LIMITS.internalNoteMax) : ''
  const updated = updateFeedbackRecord(feedbackId, {
    status: status as FeedbackRecord['status'],
    priority: priority as FeedbackRecord['priority'],
    tags: patch.tags ? normalizeFeedbackTags(patch.tags) : current.tags,
    internalNotes: note ? [...current.internalNotes, note] : current.internalNotes,
    resolvedAt: ['RESOLVED', 'CLOSED', 'SHIPPED', 'DECLINED'].includes(status) ? Date.now() : current.resolvedAt,
  })
  if (!updated) throw new GatewayError('AI_UNAVAILABLE', 'Could not update feedback', 503, 'feedback')
  if (['RESOLVED', 'CLOSED'].includes(status)) {
    trackFeedbackEvent('support_ticket_resolved', { accountId: updated.accountId, surface: 'admin' })
  }
  persistTouch()
  return {
    ...toFeedbackPublic(updated),
    accountId: updated.accountId,
    accountEmailMasked: maskEmail(findAccountById(updated.accountId)?.email ?? 'unknown'),
    plan: findAccountById(updated.accountId)?.plan ?? 'unknown',
    internalNotes: [...updated.internalNotes],
  }
}

export function resetFeedbackServicesForTests(): void {
  resetFeedbackSliceForTests()
}

export function getFeedbackAnalyticsEvents(limit = 100) {
  return listFeedbackAnalytics(limit)
}
