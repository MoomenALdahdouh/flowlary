import type {
  FeedbackPriority,
  SupportTicketAdminView,
  SupportTicketMessageView,
  SupportTicketPublicView,
  SupportTicketStatus,
} from '@flowlary/shared'
import {
  FEEDBACK_LIMITS,
  clampFeedbackText,
  formatSupportTicketNumber,
  normalizeFeedbackFeature,
  normalizeFeedbackPriority,
  normalizeFeedbackSource,
  normalizeFeedbackSurface,
  normalizeFeedbackTags,
  normalizeFeedbackType,
  normalizeSupportTicketStatus,
  resolveSupportIssueType,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import {
  appendFeedbackAnalytics,
  countSupportTicketsSince,
  appendSupportTicketMessage,
  countTicketMessagesSince,
  getFeedbackByTicketId,
  getSupportTicketById,
  insertFeedback,
  insertSupportTicket,
  listAllSupportTickets,
  listSupportTicketMessages,
  listSupportTicketsForAccount,
  updateFeedbackRecord,
  updateSupportTicket,
} from '../db/feedbackStoreSlice.ts'
import { findAccountById, touch, type AccountRecord } from '../db/store.ts'
import { GatewayError } from '../gateway/errors.ts'
import { checkFeedbackOperationRateLimit } from '../middleware/rateLimit.ts'
import { resolveServerEntitlementForAccount } from './accountService.ts'
import {
  maskEmail,
  sendSupportOperatorNotificationEmail,
  sendSupportTicketCreatedEmail,
  sendSupportTicketReplyEmail,
  sendSupportTicketResolvedEmail,
} from './emailService.ts'

function trackSupportEvent(
  event: 'support_ticket_created' | 'support_ticket_replied' | 'support_ticket_resolved',
  accountId: string,
  surface: 'support' | 'account' | 'admin',
): void {
  appendFeedbackAnalytics({ event, accountId, plan: null, feature: null, surface })
}

function persistTouch(): void {
  touch()
}

function sinceDays(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000
}

function defaultPriorityForType(type: string): FeedbackPriority {
  if (type === 'BUG_REPORT') return 'HIGH'
  return 'MEDIUM'
}

function toTicketPublic(
  ticket: NonNullable<ReturnType<typeof getSupportTicketById>>,
  lastPreview?: string | null,
): SupportTicketPublicView {
  const messages = listSupportTicketMessages(ticket.id)
  const last = messages[messages.length - 1]
  return {
    id: ticket.id,
    subject: ticket.subject,
    type: ticket.type,
    status: ticket.status,
    priority: ticket.priority ?? 'MEDIUM',
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    lastMessagePreview: (lastPreview ?? last?.body.slice(0, 160)) ?? null,
    displayNumber: formatSupportTicketNumber(ticket.id),
  }
}

function sanitizeDiagnosticsMetadata(body: Record<string, unknown>) {
  const metadataRaw = body.metadata
  if (!metadataRaw || typeof metadataRaw !== 'object') return null
  const raw = metadataRaw as Record<string, unknown>
  return {
    userAgent: typeof raw.userAgent === 'string' ? raw.userAgent.slice(0, 300) : undefined,
    extensionVersion: typeof raw.extensionVersion === 'string' ? raw.extensionVersion.slice(0, 32) : undefined,
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion.slice(0, 32) : undefined,
    includeDiagnostics: Boolean(raw.includeDiagnostics),
  }
}

function appendDiagnosticsToMessage(message: string, metadata: ReturnType<typeof sanitizeDiagnosticsMetadata>): string {
  if (!metadata?.includeDiagnostics) return message
  const lines = ['', '---', 'Technical details (user approved):']
  if (metadata.userAgent) lines.push(`Browser: ${metadata.userAgent}`)
  if (metadata.extensionVersion) lines.push(`Extension: ${metadata.extensionVersion}`)
  if (metadata.appVersion) lines.push(`App: ${metadata.appVersion}`)
  return `${message}${lines.join('\n')}`.slice(0, FEEDBACK_LIMITS.ticketMessageMax)
}

function syncFeedbackFromTicket(ticketId: string, status: SupportTicketStatus, priority?: FeedbackPriority): void {
  const feedback = getFeedbackByTicketId(ticketId)
  if (!feedback) return
  const feedbackStatus =
    status === 'INVESTIGATING'
      ? 'INVESTIGATING'
      : status === 'WAITING_FOR_USER'
        ? 'WAITING_FOR_USER'
        : status === 'RESOLVED'
          ? 'RESOLVED'
          : status === 'CLOSED'
            ? 'CLOSED'
            : 'OPEN'
  updateFeedbackRecord(feedback.id, {
    status: feedbackStatus,
    priority: priority ?? feedback.priority,
    resolvedAt: ['RESOLVED', 'CLOSED'].includes(status) ? Date.now() : feedback.resolvedAt,
  })
}

function enforceTicketMessageLimit(ticketId: string): void {
  if (countTicketMessagesSince(ticketId, sinceDays(1)) >= FEEDBACK_LIMITS.supportMessagesPerTicketPerDay) {
    throw new GatewayError('AI_RATE_LIMITED', 'Daily message limit reached for this ticket', 429, 'support')
  }
}

function assertTicketReplyAllowed(status: SupportTicketStatus): void {
  if (status === 'CLOSED' || status === 'RESOLVED') {
    throw new GatewayError('AI_INVALID_REQUEST', 'This support request is closed', 400, 'support')
  }
}

export function createSupportTicketWithNotifications(
  config: AppConfig,
  account: AccountRecord,
  body: Record<string, unknown>,
): SupportTicketPublicView {
  checkFeedbackOperationRateLimit(account.id, 'support-ticket')
  if (countSupportTicketsSince(account.id, sinceDays(1)) >= FEEDBACK_LIMITS.supportTicketsPerDay) {
    throw new GatewayError('AI_RATE_LIMITED', 'Daily support ticket limit reached', 429, 'support')
  }
  const subject = clampFeedbackText(body.subject, FEEDBACK_LIMITS.subjectMax)
  const rawMessage = clampFeedbackText(body.message, FEEDBACK_LIMITS.ticketMessageMax)
  if (!subject || !rawMessage) throw new GatewayError('AI_INVALID_REQUEST', 'Subject and message required', 400, 'support')

  const issue = resolveSupportIssueType(body.issueType)
  const type = issue?.feedbackType ?? normalizeFeedbackType(body.type) ?? 'SUPPORT_REQUEST'
  const tags = issue ? [issue.tag, ...normalizeFeedbackTags(body.tags).filter((tag) => tag !== issue.tag)] : normalizeFeedbackTags(body.tags)
  const metadata = sanitizeDiagnosticsMetadata(body)
  const message = appendDiagnosticsToMessage(rawMessage, metadata)
  const priority = defaultPriorityForType(type)

  const { ticket } = insertSupportTicket(
    { accountId: account.id, subject, type, status: 'OPEN', priority },
    message,
  )

  insertFeedback({
    accountId: account.id,
    type,
    category: issue?.id ?? null,
    title: subject,
    message,
    rating: null,
    source: normalizeFeedbackSource(body.source) ?? 'website',
    surface: normalizeFeedbackSurface(body.surface) ?? 'support',
    feature: normalizeFeedbackFeature(body.feature),
    status: 'OPEN',
    priority,
    tags: tags.slice(0, 8),
    locale: typeof body.locale === 'string' ? body.locale.slice(0, 16) : 'en',
    metadata,
    ticketId: ticket.id,
  })

  trackSupportEvent('support_ticket_created', account.id, 'support')
  persistTouch()

  const publicTicket = toTicketPublic(ticket, message.slice(0, 160))
  void sendSupportTicketCreatedEmail(config, account.email, publicTicket)
  void sendSupportOperatorNotificationEmail(config, account.email, publicTicket, 'created')

  return publicTicket
}

export function listAccountSupportTicketsPublic(accountId: string): SupportTicketPublicView[] {
  return listSupportTicketsForAccount(accountId).map((ticket) => toTicketPublic(ticket))
}

export function getAccountSupportTicketDetail(accountId: string, ticketId: string) {
  const ticket = getSupportTicketById(ticketId)
  if (!ticket || ticket.accountId !== accountId) throw new GatewayError('AI_INVALID_REQUEST', 'Ticket not found', 404, 'support')
  const messages = listSupportTicketMessages(ticketId).map((message) => ({
    id: message.id,
    ticketId: message.ticketId,
    author: message.author,
    body: message.body,
    createdAt: message.createdAt,
  }))
  return { ticket: toTicketPublic(ticket), messages }
}

export function addUserSupportTicketMessage(
  accountId: string,
  ticketId: string,
  body: Record<string, unknown>,
): SupportTicketMessageView {
  const ticket = getSupportTicketById(ticketId)
  if (!ticket || ticket.accountId !== accountId) throw new GatewayError('AI_INVALID_REQUEST', 'Ticket not found', 404, 'support')
  assertTicketReplyAllowed(ticket.status)
  enforceTicketMessageLimit(ticketId)

  const messageBody = clampFeedbackText(body.message, FEEDBACK_LIMITS.ticketMessageMax)
  if (!messageBody) throw new GatewayError('AI_INVALID_REQUEST', 'Message required', 400, 'support')

  const message = appendSupportTicketMessage(ticketId, 'user', messageBody)
  if (!message) throw new GatewayError('AI_UNAVAILABLE', 'Could not add message', 503, 'support')

  const nextStatus: SupportTicketStatus = ticket.status === 'WAITING_FOR_USER' ? 'OPEN' : ticket.status
  if (nextStatus !== ticket.status) updateSupportTicket(ticketId, { status: nextStatus })
  syncFeedbackFromTicket(ticketId, nextStatus)
  persistTouch()

  return { id: message.id, ticketId: message.ticketId, author: message.author, body: message.body, createdAt: message.createdAt }
}

export function resolveSupportTicketByUser(config: AppConfig, accountId: string, ticketId: string): SupportTicketPublicView {
  const ticket = getSupportTicketById(ticketId)
  if (!ticket || ticket.accountId !== accountId) throw new GatewayError('AI_INVALID_REQUEST', 'Ticket not found', 404, 'support')
  if (ticket.status === 'CLOSED') throw new GatewayError('AI_INVALID_REQUEST', 'Ticket already closed', 400, 'support')
  const updated = updateSupportTicket(ticketId, { status: 'RESOLVED', resolvedAt: Date.now() })
  if (!updated) throw new GatewayError('AI_UNAVAILABLE', 'Could not resolve ticket', 503, 'support')
  syncFeedbackFromTicket(ticketId, 'RESOLVED')
  trackSupportEvent('support_ticket_resolved', accountId, 'account')
  persistTouch()
  const publicTicket = toTicketPublic(updated)
  const account = findAccountById(accountId)
  if (account) void sendSupportTicketResolvedEmail(config, account.email, publicTicket)
  return publicTicket
}

function toTicketAdmin(ticket: NonNullable<ReturnType<typeof getSupportTicketById>>): SupportTicketAdminView {
  const account = findAccountById(ticket.accountId)
  const entitlement = account ? resolveServerEntitlementForAccount(account) : null
  const feedback = getFeedbackByTicketId(ticket.id)
  const messages = listSupportTicketMessages(ticket.id)
  return {
    ...toTicketPublic(ticket),
    accountId: ticket.accountId,
    accountEmailMasked: maskEmail(account?.email ?? 'unknown'),
    accountEmail: account?.email ?? 'unknown',
    plan: entitlement?.plan ?? account?.plan ?? 'unknown',
    messageCount: messages.length,
    internalNotes: feedback ? [...feedback.internalNotes] : [],
  }
}

export function adminListSupportTickets(filters: {
  status?: string
  type?: string
  priority?: string
  q?: string
  limit?: number
}): SupportTicketAdminView[] {
  let items = listAllSupportTickets()
  if (filters.status) items = items.filter((item) => item.status === filters.status)
  if (filters.type) items = items.filter((item) => item.type === filters.type)
  if (filters.priority) items = items.filter((item) => item.priority === filters.priority)
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase()
    items = items.filter(
      (item) =>
        item.subject.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        formatSupportTicketNumber(item.id).toLowerCase().includes(q),
    )
  }
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  return items.slice(0, limit).map((item) => toTicketAdmin(item))
}

export function adminGetSupportTicketDetail(ticketId: string) {
  const ticket = getSupportTicketById(ticketId)
  if (!ticket) throw new GatewayError('AI_INVALID_REQUEST', 'Ticket not found', 404, 'support-admin')
  const messages = listSupportTicketMessages(ticketId).map((message) => ({
    id: message.id,
    ticketId: message.ticketId,
    author: message.author,
    body: message.body,
    createdAt: message.createdAt,
  }))
  return { ticket: toTicketAdmin(ticket), messages }
}

export function adminReplySupportTicket(
  config: AppConfig,
  ticketId: string,
  body: Record<string, unknown>,
): SupportTicketMessageView {
  const ticket = getSupportTicketById(ticketId)
  if (!ticket) throw new GatewayError('AI_INVALID_REQUEST', 'Ticket not found', 404, 'support-admin')
  const messageBody = clampFeedbackText(body.message, FEEDBACK_LIMITS.ticketMessageMax)
  if (!messageBody) throw new GatewayError('AI_INVALID_REQUEST', 'Message required', 400, 'support-admin')

  const message = appendSupportTicketMessage(ticketId, 'support', messageBody)
  if (!message) throw new GatewayError('AI_UNAVAILABLE', 'Could not add message', 503, 'support-admin')

  const nextStatus = normalizeSupportTicketStatus(body.status) ?? 'WAITING_FOR_USER'
  updateSupportTicket(ticketId, { status: nextStatus })
  syncFeedbackFromTicket(ticketId, nextStatus)
  trackSupportEvent('support_ticket_replied', ticket.accountId, 'admin')
  persistTouch()

  const account = findAccountById(ticket.accountId)
  if (account) {
    void sendSupportTicketReplyEmail(config, account.email, toTicketPublic(getSupportTicketById(ticketId)!))
  }

  return { id: message.id, ticketId: message.ticketId, author: message.author, body: message.body, createdAt: message.createdAt }
}

export function adminUpdateSupportTicketRecord(ticketId: string, patch: Record<string, unknown>): SupportTicketAdminView {
  const current = getSupportTicketById(ticketId)
  if (!current) throw new GatewayError('AI_INVALID_REQUEST', 'Ticket not found', 404, 'support-admin')

  const status = normalizeSupportTicketStatus(patch.status) ?? current.status
  const priority = normalizeFeedbackPriority(patch.priority) ?? current.priority
  const note = typeof patch.internalNote === 'string' ? patch.internalNote.trim().slice(0, FEEDBACK_LIMITS.internalNoteMax) : ''

  const updated = updateSupportTicket(ticketId, {
    status,
    priority,
    resolvedAt: ['RESOLVED', 'CLOSED'].includes(status) ? Date.now() : status === 'OPEN' ? null : current.resolvedAt,
  })
  if (!updated) throw new GatewayError('AI_UNAVAILABLE', 'Could not update ticket', 503, 'support-admin')

  const feedback = getFeedbackByTicketId(ticketId)
  if (feedback) {
    updateFeedbackRecord(feedback.id, {
      status:
        status === 'INVESTIGATING'
          ? 'INVESTIGATING'
          : status === 'WAITING_FOR_USER'
            ? 'WAITING_FOR_USER'
            : status === 'RESOLVED'
              ? 'RESOLVED'
              : status === 'CLOSED'
                ? 'CLOSED'
                : 'OPEN',
      priority,
      internalNotes: note ? [...feedback.internalNotes, note] : feedback.internalNotes,
      resolvedAt: ['RESOLVED', 'CLOSED'].includes(status) ? Date.now() : feedback.resolvedAt,
    })
  } else {
    syncFeedbackFromTicket(ticketId, status, priority)
  }

  if (['RESOLVED', 'CLOSED'].includes(status)) {
    trackSupportEvent('support_ticket_resolved', current.accountId, 'admin')
  }
  persistTouch()
  return toTicketAdmin(updated)
}
