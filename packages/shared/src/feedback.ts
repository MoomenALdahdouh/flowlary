export const FEEDBACK_TYPES = [
  'GENERAL_FEEDBACK',
  'SATISFACTION',
  'FEATURE_REQUEST',
  'BUG_REPORT',
  'QUESTION',
  'SUPPORT_REQUEST',
  'PRAISE',
  'COMPLAINT',
  'BILLING',
  'STUDENT',
  'OTHER',
] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_STATUSES = [
  'SUBMITTED',
  'OPEN',
  'UNDER_REVIEW',
  'INVESTIGATING',
  'WAITING_FOR_USER',
  'RESOLVED',
  'CLOSED',
  'DECLINED',
] as const

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const FEEDBACK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number]

export const FEEDBACK_TAGS = [
  'CORRECTION',
  'TRANSLATION',
  'LAYOUT',
  'LEARNING',
  'EXTENSION',
  'WEBSITE',
  'PERFORMANCE',
  'UI_UX',
  'BILLING',
  'STUDENT',
  'ONBOARDING',
  'OTHER',
] as const

export type FeedbackTag = (typeof FEEDBACK_TAGS)[number]

export const FEEDBACK_SOURCES = ['website', 'extension', 'account', 'support', 'admin'] as const
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]

export const FEEDBACK_SURFACES = [
  'support',
  'account',
  'popup',
  'dashboard',
  'contextual',
  'admin',
  'contact',
] as const

export type FeedbackSurface = (typeof FEEDBACK_SURFACES)[number]

export const FEEDBACK_FEATURES = [
  'correction',
  'translation',
  'layout',
  'learning',
  'speed_box',
  'account',
  'billing',
  'student',
  'general',
] as const

export type FeedbackFeature = (typeof FEEDBACK_FEATURES)[number]

export const FEATURE_REQUEST_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'PLANNED',
  'IN_PROGRESS',
  'SHIPPED',
  'DECLINED',
] as const

export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number]

export const SUPPORT_TICKET_STATUSES = [
  'OPEN',
  'INVESTIGATING',
  'WAITING_FOR_USER',
  'RESOLVED',
  'CLOSED',
] as const

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number]

export const SATISFACTION_IMPROVE_CATEGORIES = [
  'correction_quality',
  'translation',
  'speed',
  'user_interface',
  'learning',
  'reliability',
  'missing_feature',
  'other',
] as const

export type SatisfactionImproveCategory = (typeof SATISFACTION_IMPROVE_CATEGORIES)[number]

export const FEEDBACK_PROMPT_IDS = [
  'general_satisfaction',
  'day7_usefulness',
  'day14_feature_preference',
  'day30_deeper',
  'contextual_correction',
  'contextual_translation',
  'contextual_layout',
  'contextual_learning',
  'support_resolved',
] as const

export type FeedbackPromptId = (typeof FEEDBACK_PROMPT_IDS)[number]

export const FEEDBACK_DISMISS_ACTIONS = ['not_now', 'dont_ask_again'] as const
export type FeedbackDismissAction = (typeof FEEDBACK_DISMISS_ACTIONS)[number]

export type FeedbackMetadata = {
  userAgent?: string
  extensionVersion?: string
  appVersion?: string
  includeDiagnostics?: boolean
}

export type FeedbackPublicView = {
  id: string
  type: FeedbackType
  category: string | null
  title: string | null
  message: string
  rating: number | null
  source: FeedbackSource
  surface: FeedbackSurface
  feature: FeedbackFeature | null
  status: FeedbackStatus
  priority: FeedbackPriority
  tags: FeedbackTag[]
  locale: string
  createdAt: number
  updatedAt: number
  resolvedAt: number | null
}

export type FeatureRequestPublicView = {
  id: string
  title: string
  description: string
  category: string | null
  status: FeatureRequestStatus
  priority: FeedbackPriority
  voteCount: number
  createdAt: number
  updatedAt: number
  votedByMe: boolean
  publicRoadmap: boolean
  roadmapBucket: 'now' | 'next' | 'exploring' | 'shipped' | null
}

export type SupportTicketPublicView = {
  id: string
  subject: string
  type: FeedbackType
  status: SupportTicketStatus
  priority: FeedbackPriority
  createdAt: number
  updatedAt: number
  resolvedAt: number | null
  lastMessagePreview: string | null
  displayNumber: string
}

export type SupportTicketAdminView = SupportTicketPublicView & {
  accountId: string
  accountEmailMasked: string
  accountEmail: string
  plan: string
  messageCount: number
  internalNotes: string[]
}

export const SUPPORT_ISSUE_TYPES = [
  { id: 'GENERAL', feedbackType: 'SUPPORT_REQUEST', tag: 'OTHER' as FeedbackTag },
  { id: 'BUG', feedbackType: 'BUG_REPORT', tag: 'OTHER' as FeedbackTag },
  { id: 'ACCOUNT', feedbackType: 'QUESTION', tag: 'OTHER' as FeedbackTag },
  { id: 'BILLING', feedbackType: 'BILLING', tag: 'BILLING' as FeedbackTag },
  { id: 'STUDENT', feedbackType: 'STUDENT', tag: 'STUDENT' as FeedbackTag },
  { id: 'AI', feedbackType: 'SUPPORT_REQUEST', tag: 'CORRECTION' as FeedbackTag },
  { id: 'TRANSLATION', feedbackType: 'SUPPORT_REQUEST', tag: 'TRANSLATION' as FeedbackTag },
  { id: 'EXTENSION', feedbackType: 'BUG_REPORT', tag: 'EXTENSION' as FeedbackTag },
  { id: 'LEARNING', feedbackType: 'QUESTION', tag: 'LEARNING' as FeedbackTag },
  { id: 'OTHER', feedbackType: 'OTHER', tag: 'OTHER' as FeedbackTag },
] as const

export type SupportIssueTypeId = (typeof SUPPORT_ISSUE_TYPES)[number]['id']

export function resolveSupportIssueType(value: unknown): (typeof SUPPORT_ISSUE_TYPES)[number] | null {
  if (typeof value !== 'string') return null
  return SUPPORT_ISSUE_TYPES.find((item) => item.id === value) ?? null
}

export function formatSupportTicketNumber(ticketId: string): string {
  const compact = ticketId.replace(/-/g, '')
  const numeric = parseInt(compact.slice(0, 8), 16)
  const display = Number.isFinite(numeric) ? (numeric % 9000) + 1000 : 1000
  return String(display).padStart(4, '0')
}

export type SupportTicketMessageView = {
  id: string
  ticketId: string
  author: 'user' | 'support'
  body: string
  createdAt: number
}

export type FeedbackPreferencesView = {
  dontAskAgain: boolean
  dismissedPrompts: Partial<Record<FeedbackPromptId, number>>
  completedSurveys: Partial<Record<FeedbackPromptId, number>>
  contextualPromptsShown: Partial<Record<FeedbackPromptId, number>>
  meaningfulUseCount: number
  firstWinCompletedAt: number | null
  activeDayKeys: string[]
  lastGeneralPromptAt: number | null
}

export type FeedbackConfigView = {
  chromeWebStoreUrl: string | null
  edgeAddonsUrl: string | null
  storeReviewAvailable: boolean
  cooldowns: {
    dismissedPromptMs: number
    surveyCompletedMs: number
    generalPromptMs: number
  }
  limits: {
    feedbackPerDay: number
    featureRequestsPerDay: number
    supportTicketsPerDay: number
  }
}

export type FeedbackEligibilityView = {
  eligiblePrompts: FeedbackPromptId[]
  preferences: FeedbackPreferencesView
}

export type FeedbackAdminSummaryView = {
  total: number
  open: number
  unresolved: number
  featureRequests: number
  bugReports: number
  averageRating: number | null
}

export type FeedbackAdminItemView = FeedbackPublicView & {
  accountId: string
  accountEmailMasked: string
  plan: string
  internalNotes: string[]
}

export const FEEDBACK_LIMITS = {
  titleMax: 120,
  messageMax: 4000,
  descriptionMax: 2000,
  subjectMax: 120,
  ticketMessageMax: 4000,
  internalNoteMax: 2000,
  feedbackPerDay: 10,
  featureRequestsPerDay: 5,
  supportTicketsPerDay: 10,
  supportMessagesPerTicketPerDay: 30,
  dismissedPromptCooldownMs: 14 * 24 * 60 * 60 * 1000,
  surveyCompletedCooldownMs: 30 * 24 * 60 * 60 * 1000,
  generalPromptCooldownMs: 14 * 24 * 60 * 60 * 1000,
  meaningfulUsesBeforeGeneralPrompt: 4,
  day7ActiveDays: 7,
  day14ActiveDays: 14,
  day30ActiveDays: 30,
  maxAnalyticsEvents: 10_000,
} as const

export type FeedbackEventName =
  | 'feedback_prompt_shown'
  | 'feedback_prompt_dismissed'
  | 'feedback_submitted'
  | 'rating_submitted'
  | 'feature_request_created'
  | 'feature_request_voted'
  | 'support_ticket_created'
  | 'support_ticket_replied'
  | 'support_ticket_resolved'
  | 'contextual_feedback_submitted'
  | 'survey_started'
  | 'survey_completed'
  | 'store_review_cta_clicked'
  | 'testimonial_consent_given'

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

export function normalizeFeedbackType(value: unknown): FeedbackType | null {
  return isOneOf(FEEDBACK_TYPES, value) ? value : null
}

export function normalizeFeedbackStatus(value: unknown): FeedbackStatus | null {
  return isOneOf(FEEDBACK_STATUSES, value) ? value : null
}

export function normalizeFeedbackPriority(value: unknown): FeedbackPriority | null {
  return isOneOf(FEEDBACK_PRIORITIES, value) ? value : null
}

export function normalizeFeedbackTag(value: unknown): FeedbackTag | null {
  return isOneOf(FEEDBACK_TAGS, value) ? value : null
}

export function normalizeFeedbackSource(value: unknown): FeedbackSource | null {
  return isOneOf(FEEDBACK_SOURCES, value) ? value : null
}

export function normalizeFeedbackSurface(value: unknown): FeedbackSurface | null {
  return isOneOf(FEEDBACK_SURFACES, value) ? value : null
}

export function normalizeFeedbackFeature(value: unknown): FeedbackFeature | null {
  return isOneOf(FEEDBACK_FEATURES, value) ? value : null
}

export function normalizeFeatureRequestStatus(value: unknown): FeatureRequestStatus | null {
  return isOneOf(FEATURE_REQUEST_STATUSES, value) ? value : null
}

export function normalizeSupportTicketStatus(value: unknown): SupportTicketStatus | null {
  return isOneOf(SUPPORT_TICKET_STATUSES, value) ? value : null
}

export function normalizeFeedbackPromptId(value: unknown): FeedbackPromptId | null {
  return isOneOf(FEEDBACK_PROMPT_IDS, value) ? value : null
}

export function normalizeDismissAction(value: unknown): FeedbackDismissAction | null {
  return isOneOf(FEEDBACK_DISMISS_ACTIONS, value) ? value : null
}

export function normalizeRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 1 || value > 5) return null
  return value
}

export function normalizeFeedbackTags(values: unknown): FeedbackTag[] {
  if (!Array.isArray(values)) return []
  const out: FeedbackTag[] = []
  for (const item of values) {
    const tag = normalizeFeedbackTag(item)
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out.slice(0, 8)
}

export function clampFeedbackText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}
