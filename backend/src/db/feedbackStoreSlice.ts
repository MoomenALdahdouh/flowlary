import { randomUUID } from 'node:crypto'
import type {
  FeatureRequestStatus,
  FeedbackFeature,
  FeedbackPriority,
  FeedbackPromptId,
  FeedbackSource,
  FeedbackStatus,
  FeedbackSurface,
  FeedbackTag,
  FeedbackType,
  SupportTicketStatus,
} from '@flowlary/shared'
import { FEEDBACK_LIMITS } from '@flowlary/shared'

export type FeedbackRecord = {
  id: string
  accountId: string
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
  metadata: {
    userAgent?: string
    extensionVersion?: string
    appVersion?: string
    includeDiagnostics?: boolean
  } | null
  internalNotes: string[]
  ticketId: string | null
  createdAt: number
  updatedAt: number
  resolvedAt: number | null
}

export type FeatureRequestRecord = {
  id: string
  createdByAccountId: string
  title: string
  description: string
  category: string | null
  status: FeatureRequestStatus
  priority: FeedbackPriority
  voteCount: number
  publicRoadmap: boolean
  roadmapBucket: 'now' | 'next' | 'exploring' | 'shipped' | null
  createdAt: number
  updatedAt: number
}

export type FeatureVoteRecord = {
  accountId: string
  featureRequestId: string
  createdAt: number
}

export type SupportTicketRecord = {
  id: string
  accountId: string
  subject: string
  type: FeedbackType
  status: SupportTicketStatus
  priority: FeedbackPriority
  createdAt: number
  updatedAt: number
  resolvedAt: number | null
}

export type SupportTicketMessageRecord = {
  id: string
  ticketId: string
  author: 'user' | 'support'
  body: string
  createdAt: number
}

export type FeedbackPreferencesRecord = {
  accountId: string
  dontAskAgain: boolean
  dismissedPrompts: Partial<Record<FeedbackPromptId, number>>
  completedSurveys: Partial<Record<FeedbackPromptId, number>>
  contextualPromptsShown: Partial<Record<FeedbackPromptId, number>>
  meaningfulUseCount: number
  firstWinCompletedAt: number | null
  activeDayKeys: string[]
  lastGeneralPromptAt: number | null
  updatedAt: number
}

export type FeedbackAnalyticsRecord = {
  id: string
  event: string
  accountId: string | null
  plan: string | null
  feature: string | null
  surface: string | null
  locale: string | null
  appVersion: string | null
  createdAt: number
}

export type FeedbackSliceSnapshot = {
  feedbackById: Record<string, FeedbackRecord>
  feedbackIdsByAccount: Record<string, string[]>
  featureRequestsById: Record<string, FeatureRequestRecord>
  featureVotes: Record<string, FeatureVoteRecord>
  supportTicketsById: Record<string, SupportTicketRecord>
  supportTicketMessagesByTicket: Record<string, SupportTicketMessageRecord[]>
  supportTicketIdsByAccount: Record<string, string[]>
  preferencesByAccount: Record<string, FeedbackPreferencesRecord>
  analyticsEvents: FeedbackAnalyticsRecord[]
}

const EMPTY: FeedbackSliceSnapshot = {
  feedbackById: {},
  feedbackIdsByAccount: {},
  featureRequestsById: {},
  featureVotes: {},
  supportTicketsById: {},
  supportTicketMessagesByTicket: {},
  supportTicketIdsByAccount: {},
  preferencesByAccount: {},
  analyticsEvents: [],
}

let slice: FeedbackSliceSnapshot = { ...EMPTY, feedbackById: {}, featureRequestsById: {}, featureVotes: {}, supportTicketsById: {}, supportTicketMessagesByTicket: {}, feedbackIdsByAccount: {}, supportTicketIdsByAccount: {}, preferencesByAccount: {}, analyticsEvents: [] }

function cloneSlice(input: FeedbackSliceSnapshot): FeedbackSliceSnapshot {
  return {
    feedbackById: { ...input.feedbackById },
    feedbackIdsByAccount: { ...input.feedbackIdsByAccount },
    featureRequestsById: { ...input.featureRequestsById },
    featureVotes: { ...input.featureVotes },
    supportTicketsById: { ...input.supportTicketsById },
    supportTicketMessagesByTicket: { ...input.supportTicketMessagesByTicket },
    supportTicketIdsByAccount: { ...input.supportTicketIdsByAccount },
    preferencesByAccount: { ...input.preferencesByAccount },
    analyticsEvents: [...input.analyticsEvents],
  }
}

export function loadFeedbackSlice(raw: Partial<FeedbackSliceSnapshot> | undefined): void {
  slice = cloneSlice({
    feedbackById: raw?.feedbackById ?? {},
    feedbackIdsByAccount: raw?.feedbackIdsByAccount ?? {},
    featureRequestsById: raw?.featureRequestsById ?? {},
    featureVotes: raw?.featureVotes ?? {},
    supportTicketsById: raw?.supportTicketsById ?? {},
    supportTicketMessagesByTicket: raw?.supportTicketMessagesByTicket ?? {},
    supportTicketIdsByAccount: raw?.supportTicketIdsByAccount ?? {},
    preferencesByAccount: raw?.preferencesByAccount ?? {},
    analyticsEvents: Array.isArray(raw?.analyticsEvents) ? raw!.analyticsEvents! : [],
  })
}

export function feedbackSliceSnapshot(): FeedbackSliceSnapshot {
  return cloneSlice(slice)
}

export function resetFeedbackSliceForTests(): void {
  slice = cloneSlice(EMPTY)
}

function voteKey(accountId: string, featureRequestId: string): string {
  return `${accountId}:${featureRequestId}`
}

export function defaultPreferences(accountId: string, now = Date.now()): FeedbackPreferencesRecord {
  return {
    accountId,
    dontAskAgain: false,
    dismissedPrompts: {},
    completedSurveys: {},
    contextualPromptsShown: {},
    meaningfulUseCount: 0,
    firstWinCompletedAt: null,
    activeDayKeys: [],
    lastGeneralPromptAt: null,
    updatedAt: now,
  }
}

export function getFeedbackPreferences(accountId: string): FeedbackPreferencesRecord {
  return slice.preferencesByAccount[accountId] ?? defaultPreferences(accountId)
}

export function upsertFeedbackPreferences(
  accountId: string,
  patch: Partial<Omit<FeedbackPreferencesRecord, 'accountId'>>,
  now = Date.now(),
): FeedbackPreferencesRecord {
  const current = getFeedbackPreferences(accountId)
  const next: FeedbackPreferencesRecord = {
    ...current,
    ...patch,
    accountId,
    updatedAt: now,
  }
  slice.preferencesByAccount[accountId] = next
  return next
}

export function insertFeedback(record: Omit<FeedbackRecord, 'id' | 'createdAt' | 'updatedAt' | 'resolvedAt' | 'internalNotes'> & { id?: string; internalNotes?: string[] }): FeedbackRecord {
  const now = Date.now()
  const item: FeedbackRecord = {
    id: record.id ?? randomUUID(),
    accountId: record.accountId,
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
    tags: record.tags,
    locale: record.locale,
    metadata: record.metadata,
    internalNotes: record.internalNotes ?? [],
    ticketId: record.ticketId ?? null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  }
  slice.feedbackById[item.id] = item
  const ids = slice.feedbackIdsByAccount[item.accountId] ?? []
  slice.feedbackIdsByAccount[item.accountId] = [item.id, ...ids.filter((id) => id !== item.id)].slice(0, 500)
  return item
}

export function listFeedbackForAccount(accountId: string): FeedbackRecord[] {
  const ids = slice.feedbackIdsByAccount[accountId] ?? []
  return ids.map((id) => slice.feedbackById[id]).filter(Boolean)
}

export function getFeedbackById(id: string): FeedbackRecord | null {
  return slice.feedbackById[id] ?? null
}

export function listAllFeedback(): FeedbackRecord[] {
  return Object.values(slice.feedbackById).sort((a, b) => b.createdAt - a.createdAt)
}

export function updateFeedbackRecord(id: string, patch: Partial<FeedbackRecord>): FeedbackRecord | null {
  const current = slice.feedbackById[id]
  if (!current) return null
  const next = { ...current, ...patch, id: current.id, accountId: current.accountId, updatedAt: Date.now() }
  slice.feedbackById[id] = next
  return next
}

export function countFeedbackSince(accountId: string, sinceMs: number): number {
  return listFeedbackForAccount(accountId).filter((item) => item.createdAt >= sinceMs).length
}

export function insertFeatureRequest(
  record: Omit<FeatureRequestRecord, 'id' | 'voteCount' | 'createdAt' | 'updatedAt' | 'publicRoadmap' | 'roadmapBucket'> & {
    id?: string
    voteCount?: number
    publicRoadmap?: boolean
    roadmapBucket?: FeatureRequestRecord['roadmapBucket']
  },
): FeatureRequestRecord {
  const now = Date.now()
  const item: FeatureRequestRecord = {
    id: record.id ?? randomUUID(),
    createdByAccountId: record.createdByAccountId,
    title: record.title,
    description: record.description,
    category: record.category,
    status: record.status,
    priority: record.priority,
    voteCount: record.voteCount ?? 1,
    publicRoadmap: record.publicRoadmap ?? false,
    roadmapBucket: record.roadmapBucket ?? null,
    createdAt: now,
    updatedAt: now,
  }
  slice.featureRequestsById[item.id] = item
  return item
}

export function listFeatureRequests(): FeatureRequestRecord[] {
  return Object.values(slice.featureRequestsById).sort((a, b) => b.voteCount - a.voteCount || b.createdAt - a.createdAt)
}

export function getFeatureRequestById(id: string): FeatureRequestRecord | null {
  return slice.featureRequestsById[id] ?? null
}

export function hasFeatureVote(accountId: string, featureRequestId: string): boolean {
  return Boolean(slice.featureVotes[voteKey(accountId, featureRequestId)])
}

export function addFeatureVote(accountId: string, featureRequestId: string): FeatureRequestRecord | null {
  const request = slice.featureRequestsById[featureRequestId]
  if (!request) return null
  const key = voteKey(accountId, featureRequestId)
  if (slice.featureVotes[key]) return request
  slice.featureVotes[key] = { accountId, featureRequestId, createdAt: Date.now() }
  request.voteCount += 1
  request.updatedAt = Date.now()
  slice.featureRequestsById[featureRequestId] = request
  return request
}

export function countFeatureRequestsSince(accountId: string, sinceMs: number): number {
  return Object.values(slice.featureRequestsById).filter(
    (item) => item.createdByAccountId === accountId && item.createdAt >= sinceMs,
  ).length
}

export function insertSupportTicket(
  record: Omit<SupportTicketRecord, 'id' | 'createdAt' | 'updatedAt' | 'resolvedAt'> & { id?: string },
  initialMessage: string,
): { ticket: SupportTicketRecord; message: SupportTicketMessageRecord } {
  const now = Date.now()
  const ticket: SupportTicketRecord = {
    id: record.id ?? randomUUID(),
    accountId: record.accountId,
    subject: record.subject,
    type: record.type,
    status: record.status,
    priority: record.priority ?? 'MEDIUM',
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  }
  const message: SupportTicketMessageRecord = {
    id: randomUUID(),
    ticketId: ticket.id,
    author: 'user',
    body: initialMessage,
    createdAt: now,
  }
  slice.supportTicketsById[ticket.id] = ticket
  slice.supportTicketMessagesByTicket[ticket.id] = [message]
  const ids = slice.supportTicketIdsByAccount[ticket.accountId] ?? []
  slice.supportTicketIdsByAccount[ticket.accountId] = [ticket.id, ...ids.filter((id) => id !== ticket.id)].slice(0, 200)
  return { ticket, message }
}

export function listSupportTicketsForAccount(accountId: string): SupportTicketRecord[] {
  const ids = slice.supportTicketIdsByAccount[accountId] ?? []
  return ids.map((id) => slice.supportTicketsById[id]).filter(Boolean)
}

export function getSupportTicketById(id: string): SupportTicketRecord | null {
  return slice.supportTicketsById[id] ?? null
}

export function listSupportTicketMessages(ticketId: string): SupportTicketMessageRecord[] {
  return slice.supportTicketMessagesByTicket[ticketId] ?? []
}

export function appendSupportTicketMessage(
  ticketId: string,
  author: 'user' | 'support',
  body: string,
): SupportTicketMessageRecord | null {
  const ticket = slice.supportTicketsById[ticketId]
  if (!ticket) return null
  const now = Date.now()
  const message: SupportTicketMessageRecord = {
    id: randomUUID(),
    ticketId,
    author,
    body,
    createdAt: now,
  }
  const messages = slice.supportTicketMessagesByTicket[ticketId] ?? []
  slice.supportTicketMessagesByTicket[ticketId] = [...messages, message]
  ticket.updatedAt = now
  slice.supportTicketsById[ticketId] = ticket
  return message
}

export function updateSupportTicket(id: string, patch: Partial<SupportTicketRecord>): SupportTicketRecord | null {
  const current = slice.supportTicketsById[id]
  if (!current) return null
  const next = { ...current, ...patch, id: current.id, accountId: current.accountId, updatedAt: Date.now() }
  slice.supportTicketsById[id] = next
  return next
}

export function listAllSupportTickets(): SupportTicketRecord[] {
  return Object.values(slice.supportTicketsById).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getFeedbackByTicketId(ticketId: string): FeedbackRecord | null {
  return Object.values(slice.feedbackById).find((item) => item.ticketId === ticketId) ?? null
}

export function countTicketMessagesSince(ticketId: string, sinceMs: number): number {
  return (slice.supportTicketMessagesByTicket[ticketId] ?? []).filter((item) => item.createdAt >= sinceMs).length
}

export function countSupportTicketsSince(accountId: string, sinceMs: number): number {
  return listSupportTicketsForAccount(accountId).filter((item) => item.createdAt >= sinceMs).length
}

export function appendFeedbackAnalytics(event: Omit<FeedbackAnalyticsRecord, 'id' | 'createdAt'>): void {
  const item: FeedbackAnalyticsRecord = {
    id: randomUUID(),
    createdAt: Date.now(),
    ...event,
  }
  slice.analyticsEvents.unshift(item)
  if (slice.analyticsEvents.length > FEEDBACK_LIMITS.maxAnalyticsEvents) {
    slice.analyticsEvents.length = FEEDBACK_LIMITS.maxAnalyticsEvents
  }
}

export function listFeedbackAnalytics(limit = 500): FeedbackAnalyticsRecord[] {
  return slice.analyticsEvents.slice(0, limit)
}

export function averageFeedbackRating(): number | null {
  const ratings = Object.values(slice.feedbackById)
    .map((item) => item.rating)
    .filter((value): value is number => typeof value === 'number')
  if (ratings.length === 0) return null
  const sum = ratings.reduce((acc, value) => acc + value, 0)
  return Math.round((sum / ratings.length) * 10) / 10
}

export function countFeedbackRatings(): number {
  return Object.values(slice.feedbackById).filter((item) => typeof item.rating === 'number').length
}

export function listAllFeedbackPreferences(): FeedbackPreferencesRecord[] {
  return Object.values(slice.preferencesByAccount)
}

export function listPublicFeatureRequests(limit = 20) {
  return Object.values(slice.featureRequestsById)
    .filter((item) => item.publicRoadmap)
    .sort((a, b) => b.voteCount - a.voteCount || b.createdAt - a.createdAt)
    .slice(0, limit)
}
