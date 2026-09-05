import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AccountPlan,
  AccountStatus,
  BillingEnvironment,
  FlowlarySubscriptionStatus,
  LearningEventStoreV1,
  LearningProfile,
  PracticeSessionStoreV1,
} from '@flowlary/shared'
import { ensureLearningEventsSliceLoaded, learningEventsSnapshot } from './learningEventsStoreSlice.ts'
import { ensureLearningSyncSliceLoaded, learningSyncSnapshot } from './learningSyncStoreSlice.ts'
import { loadStudentSlice, studentSliceSnapshot } from './studentBenefitSlice.ts'
import { feedbackSliceSnapshot, loadFeedbackSlice } from './feedbackStoreSlice.ts'
import { loadTestimonialSlice, testimonialSliceSnapshot } from './testimonialStoreSlice.ts'

export type AccountRecord = {
  id: string
  email: string
  passwordHash: string
  plan: AccountPlan
  status: AccountStatus
  trialEndsAt: number | null
  /**
   * @deprecated Phase 26 — ignored for quota. Kept for store migration compatibility.
   */
  usageBalanceMs: number
  /** Credits consumed today (UTC day). */
  dailyCreditsUsed: number
  /** UTC day key YYYY-MM-DD for dailyCreditsUsed. */
  dailyCreditsDayKey: string
  /** Credits consumed this UTC month (Pro soft cap). */
  monthlyCreditsUsed: number
  /** UTC month key YYYY-MM for monthlyCreditsUsed. */
  monthlyCreditsMonthKey: string
  paddleCustomerId: string | null
  paddleSubscriptionId: string | null
  billingEnvironment: BillingEnvironment | null
  emailVerified: boolean
  emailVerifiedAt: number | null
  createdAt: number
  updatedAt: number
}

export type EmailVerificationRecord = {
  accountId: string
  tokenHash: string
  expiresAt: number
  resendCount: number
  resendWindowStartedAt: number
  lastResendAt: number
}

export type PasswordResetRecord = {
  accountId: string
  tokenHash: string
  expiresAt: number
  lastSentAt: number
}

export type SubscriptionRecord = {
  accountId: string
  paddleCustomerId: string
  paddleSubscriptionId: string
  status: FlowlarySubscriptionStatus
  priceId: string | null
  plan: 'free' | 'pro'
  currentPeriodStart: number | null
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
  paymentFailed: boolean
  lastWebhookAt: number
  lastEventOccurredAt: string | null
  billingEnvironment: BillingEnvironment
}

export type WebhookEventRecord = {
  eventId: string
  eventType: string
  processedAt: number
}

export type AdminAuditRecord = {
  id: string
  action: string
  actorAccountId: string
  actorEmail: string
  targetType: string
  targetId: string
  metadata: Record<string, string | number | boolean | null>
  createdAt: number
}

export type SessionRecord = {
  id: string
  accountId: string
  refreshTokenHash: string
  expiresAt: number
  createdAt: number
}

export type InstallLinkRecord = {
  installId: string
  accountId: string | null
  createdAt: number
}

export type UsagePersistRecord = {
  id: string
  accountId: string | null
  userId: string
  operation: 'correction' | 'translation' | 'layout-classification' | 'hypothesis-advisor' | 'writing-review'
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  status: 'success' | 'failure'
  latencyMs: number
  /** Weighted credits charged on success (Phase 26). */
  creditsCharged?: number
  mode?: string | null
  requestId: string
  createdAt: number
  plan?: string
}

type StoreSnapshot = {
  accounts: Record<string, AccountRecord>
  sessions: Record<string, SessionRecord>
  installs: Record<string, InstallLinkRecord>
  usage: UsagePersistRecord[]
  subscriptions: Record<string, SubscriptionRecord>
  webhookEvents: Record<string, WebhookEventRecord>
  learningEventsByAccount: Record<string, LearningEventStoreV1>
  learningProfileByAccount: Record<string, LearningProfile>
  practiceSessionsByAccount: Record<string, PracticeSessionStoreV1>
  emailVerifications: Record<string, EmailVerificationRecord>
  passwordResets: Record<string, PasswordResetRecord>
  studentBenefits?: Record<string, import('./studentTypes.ts').StudentBenefitRecord>
  studentVerificationRequests?: Record<string, import('./studentTypes.ts').StudentVerificationRequestRecord>
  studentReferenceIndex?: Record<string, string>
  feedbackById?: Record<string, import('./feedbackStoreSlice.ts').FeedbackRecord>
  feedbackIdsByAccount?: Record<string, string[]>
  featureRequestsById?: Record<string, import('./feedbackStoreSlice.ts').FeatureRequestRecord>
  featureVotes?: Record<string, import('./feedbackStoreSlice.ts').FeatureVoteRecord>
  supportTicketsById?: Record<string, import('./feedbackStoreSlice.ts').SupportTicketRecord>
  supportTicketMessagesByTicket?: Record<string, import('./feedbackStoreSlice.ts').SupportTicketMessageRecord[]>
  supportTicketIdsByAccount?: Record<string, string[]>
  feedbackPreferencesByAccount?: Record<string, import('./feedbackStoreSlice.ts').FeedbackPreferencesRecord>
  feedbackAnalyticsEvents?: import('./feedbackStoreSlice.ts').FeedbackAnalyticsRecord[]
  testimonialsById?: Record<string, import('@flowlary/shared').TestimonialRecord>
  publishedTestimonialIds?: string[]
  adminAuditEvents?: AdminAuditRecord[]
}

const EMPTY_SNAPSHOT = (): StoreSnapshot => ({
  accounts: {},
  sessions: {},
  installs: {},
  usage: [],
  subscriptions: {},
  webhookEvents: {},
  learningEventsByAccount: {},
  learningProfileByAccount: {},
  practiceSessionsByAccount: {},
  emailVerifications: {},
  passwordResets: {},
  adminAuditEvents: [],
})

let dataPath = resolve(process.cwd(), 'data', 'flowlary-store.json')
let snapshot: StoreSnapshot = EMPTY_SNAPSHOT()
let loaded = false

export function configureStorePath(path: string): void {
  dataPath = path
  loaded = false
}

export function resetStoreForTests(): void {
  snapshot = EMPTY_SNAPSHOT()
  loadStudentSlice({ benefits: {}, verificationRequests: {}, referenceIndex: {} })
  loadFeedbackSlice(undefined)
  loadTestimonialSlice(undefined)
  ensureLearningEventsSliceLoaded(snapshot.learningEventsByAccount)
  ensureLearningSyncSliceLoaded(snapshot.learningProfileByAccount, snapshot.practiceSessionsByAccount)
  loaded = true
}

export function ensureLoaded(): void {
  if (loaded) return
  loaded = true
  if (dataPath === ':memory:') {
    ensureLearningEventsSliceLoaded(snapshot.learningEventsByAccount)
    ensureLearningSyncSliceLoaded(snapshot.learningProfileByAccount, snapshot.practiceSessionsByAccount)
    return
  }
  if (!existsSync(dataPath)) {
    mkdirSync(dirname(dataPath), { recursive: true })
    persist()
    return
  }
  try {
    const raw = JSON.parse(readFileSync(dataPath, 'utf8')) as StoreSnapshot
    snapshot = {
      accounts: normalizeAccounts(raw.accounts ?? {}),
      sessions: raw.sessions ?? {},
      installs: raw.installs ?? {},
      usage: Array.isArray(raw.usage) ? raw.usage : [],
      subscriptions: raw.subscriptions ?? {},
      webhookEvents: raw.webhookEvents ?? {},
      learningEventsByAccount: raw.learningEventsByAccount ?? {},
      learningProfileByAccount: raw.learningProfileByAccount ?? {},
      practiceSessionsByAccount: raw.practiceSessionsByAccount ?? {},
      emailVerifications: normalizeEmailVerifications(raw.emailVerifications ?? {}),
      passwordResets: raw.passwordResets ?? {},
      adminAuditEvents: Array.isArray(raw.adminAuditEvents) ? raw.adminAuditEvents : [],
    }
    loadStudentSlice({
      benefits: raw.studentBenefits ?? {},
      verificationRequests: raw.studentVerificationRequests ?? {},
      referenceIndex: raw.studentReferenceIndex ?? {},
    })
    loadFeedbackSlice({
      feedbackById: raw.feedbackById ?? {},
      feedbackIdsByAccount: raw.feedbackIdsByAccount ?? {},
      featureRequestsById: raw.featureRequestsById ?? {},
      featureVotes: raw.featureVotes ?? {},
      supportTicketsById: raw.supportTicketsById ?? {},
      supportTicketMessagesByTicket: raw.supportTicketMessagesByTicket ?? {},
      supportTicketIdsByAccount: raw.supportTicketIdsByAccount ?? {},
      preferencesByAccount: raw.feedbackPreferencesByAccount ?? {},
      analyticsEvents: raw.feedbackAnalyticsEvents ?? [],
    })
    loadTestimonialSlice({
      testimonialsById: raw.testimonialsById ?? {},
      publishedIds: raw.publishedTestimonialIds ?? [],
    })
    ensureLearningEventsSliceLoaded(snapshot.learningEventsByAccount)
  ensureLearningSyncSliceLoaded(snapshot.learningProfileByAccount, snapshot.practiceSessionsByAccount)
  } catch {
    snapshot = EMPTY_SNAPSHOT()
  }
}

/**
 * JSON persistence is single-process. Writes are exclusive-locked and atomic
 * (temp file + rename). Concurrent Node processes can still lose updates if
 * they hold stale in-memory snapshots — do not horizontally scale this store.
 */
function persist(): void {
  if (dataPath === ':memory:') return
  mkdirSync(dirname(dataPath), { recursive: true })
  withStoreLock(() => {
    const student = studentSliceSnapshot()
    const feedback = feedbackSliceSnapshot()
    const testimonials = testimonialSliceSnapshot()
    const tmp = `${dataPath}.${randomUUID()}.tmp`
    writeFileSync(
      tmp,
      JSON.stringify(
        {
          ...snapshot,
          studentBenefits: student.benefits,
          studentVerificationRequests: student.verificationRequests,
          studentReferenceIndex: student.referenceIndex,
          feedbackById: feedback.feedbackById,
          feedbackIdsByAccount: feedback.feedbackIdsByAccount,
          featureRequestsById: feedback.featureRequestsById,
          featureVotes: feedback.featureVotes,
          supportTicketsById: feedback.supportTicketsById,
          supportTicketMessagesByTicket: feedback.supportTicketMessagesByTicket,
          supportTicketIdsByAccount: feedback.supportTicketIdsByAccount,
          feedbackPreferencesByAccount: feedback.preferencesByAccount,
          feedbackAnalyticsEvents: feedback.analyticsEvents,
          testimonialsById: testimonials.testimonialsById,
          publishedTestimonialIds: testimonials.publishedIds,
        },
        null,
        2,
      ),
      'utf8',
    )
    renameSync(tmp, dataPath)
  })
}

function withStoreLock(fn: () => void): void {
  const lockPath = `${dataPath}.lock`
  const deadline = Date.now() + 2_000
  let fd: number | undefined

  while (fd === undefined && Date.now() < deadline) {
    try {
      fd = openSync(lockPath, 'wx')
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'EEXIST') throw err
      sleepSync(10)
    }
  }

  if (fd === undefined) {
    try {
      unlinkSync(lockPath)
    } catch {
      /* stale lock */
    }
    fd = openSync(lockPath, 'wx')
  }

  try {
    fn()
  } finally {
    closeSync(fd)
    try {
      unlinkSync(lockPath)
    } catch {
      /* ignore */
    }
  }
}

function sleepSync(ms: number): void {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* spin — persist is infrequent and must stay synchronous */
  }
}

export function touch(): void {
  ensureLoaded()
  ensureLearningEventsSliceLoaded(snapshot.learningEventsByAccount)
  ensureLearningSyncSliceLoaded(snapshot.learningProfileByAccount, snapshot.practiceSessionsByAccount)
  persist()
}

export function createAccount(
  input: Omit<AccountRecord, 'id' | 'createdAt' | 'updatedAt' | 'paddleCustomerId' | 'paddleSubscriptionId' | 'billingEnvironment'> &
    Partial<Pick<AccountRecord, 'paddleCustomerId' | 'paddleSubscriptionId' | 'billingEnvironment'>>,
): AccountRecord {
  ensureLoaded()
  const now = Date.now()
  const account: AccountRecord = {
    ...input,
    paddleCustomerId: input.paddleCustomerId ?? null,
    paddleSubscriptionId: input.paddleSubscriptionId ?? null,
    billingEnvironment: input.billingEnvironment ?? null,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  snapshot.accounts[account.id] = account
  touch()
  return account
}

export function findAccountByEmail(email: string): AccountRecord | null {
  ensureLoaded()
  const normalized = email.trim().toLowerCase()
  return (
    Object.values(snapshot.accounts).find((row) => row.email === normalized) ?? null
  )
}

export function findAccountById(id: string): AccountRecord | null {
  ensureLoaded()
  return snapshot.accounts[id] ?? null
}

export function listAllAccounts(): AccountRecord[] {
  ensureLoaded()
  return Object.values(snapshot.accounts)
}

export function listAllInstallLinks(): InstallLinkRecord[] {
  ensureLoaded()
  return Object.values(snapshot.installs)
}

export function listAllSubscriptions(): SubscriptionRecord[] {
  ensureLoaded()
  return Object.values(snapshot.subscriptions)
}

export function updateAccount(account: AccountRecord): AccountRecord {
  ensureLoaded()
  account.updatedAt = Date.now()
  snapshot.accounts[account.id] = account
  touch()
  return account
}

export function createSession(session: Omit<SessionRecord, 'id' | 'createdAt'>): SessionRecord {
  ensureLoaded()
  const row: SessionRecord = {
    ...session,
    id: randomUUID(),
    createdAt: Date.now(),
  }
  snapshot.sessions[row.id] = row
  touch()
  return row
}

export function findSessionById(id: string): SessionRecord | null {
  ensureLoaded()
  return snapshot.sessions[id] ?? null
}

export function deleteSession(id: string): void {
  ensureLoaded()
  delete snapshot.sessions[id]
  touch()
}

export function deleteSessionsForAccount(accountId: string): void {
  ensureLoaded()
  for (const [id, row] of Object.entries(snapshot.sessions)) {
    if (row.accountId === accountId) delete snapshot.sessions[id]
  }
  touch()
}

export function listSessionsForAccount(accountId: string): SessionRecord[] {
  ensureLoaded()
  return Object.values(snapshot.sessions).filter((row) => row.accountId === accountId)
}

export function countSessionsForAccount(accountId: string): number {
  return listSessionsForAccount(accountId).length
}

export function listRecentWebhookEvents(limit = 50): WebhookEventRecord[] {
  ensureLoaded()
  return Object.values(snapshot.webhookEvents)
    .sort((a, b) => b.processedAt - a.processedAt)
    .slice(0, Math.min(Math.max(limit, 1), 200))
}

export function appendAdminAuditEvent(
  input: Omit<AdminAuditRecord, 'id' | 'createdAt'> & { createdAt?: number },
): AdminAuditRecord {
  ensureLoaded()
  const row: AdminAuditRecord = {
    ...input,
    id: randomUUID(),
    createdAt: input.createdAt ?? Date.now(),
  }
  const events = snapshot.adminAuditEvents ?? []
  events.unshift(row)
  if (events.length > 5_000) events.length = 5_000
  snapshot.adminAuditEvents = events
  touch()
  return row
}

export function listAdminAuditEvents(): AdminAuditRecord[] {
  ensureLoaded()
  return snapshot.adminAuditEvents ?? []
}

export function upsertInstall(installId: string, accountId: string | null): InstallLinkRecord {
  ensureLoaded()
  const existing = snapshot.installs[installId]
  const row: InstallLinkRecord = {
    installId,
    accountId: accountId ?? existing?.accountId ?? null,
    createdAt: existing?.createdAt ?? Date.now(),
  }
  snapshot.installs[installId] = row
  touch()
  return row
}

export function linkInstallToAccount(installId: string, accountId: string): void {
  upsertInstall(installId, accountId)
}

export function appendUsage(record: Omit<UsagePersistRecord, 'id'>): UsagePersistRecord {
  ensureLoaded()
  const row: UsagePersistRecord = { ...record, id: randomUUID() }
  snapshot.usage.push(row)
  if (snapshot.usage.length > 50_000) {
    snapshot.usage.splice(0, snapshot.usage.length - 50_000)
  }
  touch()
  return row
}

export function listUsage(filter?: { accountId?: string; userId?: string }): UsagePersistRecord[] {
  ensureLoaded()
  return snapshot.usage.filter((row) => {
    if (filter?.accountId && row.accountId !== filter.accountId) return false
    if (filter?.userId && row.userId !== filter.userId) return false
    return true
  })
}

function normalizeEmailVerifications(
  raw: Record<string, EmailVerificationRecord & { codeHash?: string }>,
): Record<string, EmailVerificationRecord> {
  const out: Record<string, EmailVerificationRecord> = {}
  for (const [accountId, row] of Object.entries(raw)) {
    const tokenHash = row.tokenHash ?? row.codeHash
    if (!tokenHash) continue
    out[accountId] = {
      accountId: row.accountId ?? accountId,
      tokenHash,
      expiresAt: row.expiresAt,
      resendCount: row.resendCount ?? 0,
      resendWindowStartedAt: row.resendWindowStartedAt ?? Date.now(),
      lastResendAt: row.lastResendAt ?? Date.now(),
    }
  }
  return out
}

function normalizeAccounts(raw: Record<string, AccountRecord>): Record<string, AccountRecord> {
  const out: Record<string, AccountRecord> = {}
  const now = Date.now()
  const dayKey = new Date(now).toISOString().slice(0, 10)
  const monthKey = new Date(now).toISOString().slice(0, 7)
  for (const [id, row] of Object.entries(raw)) {
    out[id] = {
      ...row,
      usageBalanceMs: typeof row.usageBalanceMs === 'number' ? row.usageBalanceMs : 0,
      dailyCreditsUsed: typeof row.dailyCreditsUsed === 'number' ? row.dailyCreditsUsed : 0,
      dailyCreditsDayKey: typeof row.dailyCreditsDayKey === 'string' ? row.dailyCreditsDayKey : dayKey,
      monthlyCreditsUsed: typeof row.monthlyCreditsUsed === 'number' ? row.monthlyCreditsUsed : 0,
      monthlyCreditsMonthKey:
        typeof row.monthlyCreditsMonthKey === 'string' ? row.monthlyCreditsMonthKey : monthKey,
      paddleCustomerId: row.paddleCustomerId ?? null,
      paddleSubscriptionId: row.paddleSubscriptionId ?? null,
      billingEnvironment: row.billingEnvironment ?? null,
      emailVerified: row.emailVerified ?? true,
      emailVerifiedAt:
        typeof row.emailVerifiedAt === 'number'
          ? row.emailVerifiedAt
          : row.emailVerified === false
            ? null
            : row.createdAt ?? now,
    }
  }
  return out
}

export function findAccountByPaddleCustomerId(customerId: string): AccountRecord | null {
  ensureLoaded()
  if (!customerId) return null
  return Object.values(snapshot.accounts).find((row) => row.paddleCustomerId === customerId) ?? null
}

export function findSubscriptionById(paddleSubscriptionId: string): SubscriptionRecord | null {
  ensureLoaded()
  return snapshot.subscriptions[paddleSubscriptionId] ?? null
}

export function findSubscriptionByAccountId(accountId: string): SubscriptionRecord | null {
  ensureLoaded()
  return Object.values(snapshot.subscriptions).find((row) => row.accountId === accountId) ?? null
}

export function upsertSubscription(record: SubscriptionRecord): SubscriptionRecord {
  ensureLoaded()
  snapshot.subscriptions[record.paddleSubscriptionId] = record
  touch()
  return record
}

export function hasProcessedWebhook(eventId: string): boolean {
  ensureLoaded()
  return Boolean(snapshot.webhookEvents[eventId])
}

export function markWebhookProcessed(eventId: string, eventType: string): void {
  ensureLoaded()
  snapshot.webhookEvents[eventId] = { eventId, eventType, processedAt: Date.now() }
  const ids = Object.keys(snapshot.webhookEvents)
  if (ids.length > 5_000) {
    const sorted = ids
      .map((id) => snapshot.webhookEvents[id])
      .sort((a, b) => a.processedAt - b.processedAt)
    for (const row of sorted.slice(0, ids.length - 5_000)) {
      delete snapshot.webhookEvents[row.eventId]
    }
  }
  touch()
}

export function summarizeUsageForAccount(accountId: string): {
  requestCount: number
  successCount: number
  failureCount: number
} {
  const rows = listUsage({ accountId })
  return {
    requestCount: rows.length,
    successCount: rows.filter((r) => r.status === 'success').length,
    failureCount: rows.filter((r) => r.status === 'failure').length,
  }
}

export function getEmailVerification(accountId: string): EmailVerificationRecord | null {
  ensureLoaded()
  return snapshot.emailVerifications[accountId] ?? null
}

export function setEmailVerification(record: EmailVerificationRecord): void {
  ensureLoaded()
  snapshot.emailVerifications[record.accountId] = record
  touch()
}

export function clearEmailVerification(accountId: string): void {
  ensureLoaded()
  delete snapshot.emailVerifications[accountId]
  touch()
}

export function findEmailVerificationByTokenHash(tokenHash: string): EmailVerificationRecord | null {
  ensureLoaded()
  for (const record of Object.values(snapshot.emailVerifications)) {
    if (record.tokenHash === tokenHash) return record
  }
  return null
}

export function getPasswordReset(accountId: string): PasswordResetRecord | null {
  ensureLoaded()
  return snapshot.passwordResets[accountId] ?? null
}

export function setPasswordReset(record: PasswordResetRecord): void {
  ensureLoaded()
  snapshot.passwordResets[record.accountId] = record
  touch()
}

export function clearPasswordReset(accountId: string): void {
  ensureLoaded()
  delete snapshot.passwordResets[accountId]
  touch()
}

export function findPasswordResetByTokenHash(tokenHash: string): PasswordResetRecord | null {
  ensureLoaded()
  for (const record of Object.values(snapshot.passwordResets)) {
    if (record.tokenHash === tokenHash) return record
  }
  return null
}
