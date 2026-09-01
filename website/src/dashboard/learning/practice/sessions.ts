import {
  MAX_PRACTICE_SESSIONS,
  PRACTICE_SESSION_STORE_VERSION,
  PRACTICE_SESSION_VERSION,
  type PracticeSessionRecord,
  type PracticeSessionStoreV1,
} from '@flowlary/shared'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

let sequence = 0

export function createEmptyPracticeSessionStore(): PracticeSessionStoreV1 {
  return { version: PRACTICE_SESSION_STORE_VERSION, sessions: [] }
}

export function normalizePracticeSessionStore(raw: unknown): PracticeSessionStoreV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyPracticeSessionStore()
  }
  const value = raw as Partial<PracticeSessionStoreV1>
  const sessions: PracticeSessionRecord[] = []
  if (Array.isArray(value.sessions)) {
    for (const item of value.sessions) {
      const session = sanitizePracticeSession(item)
      if (session) sessions.push(session)
    }
  }
  sessions.sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
  return {
    version: PRACTICE_SESSION_STORE_VERSION,
    sessions: sessions.slice(0, MAX_PRACTICE_SESSIONS),
  }
}

function sanitizePracticeSession(raw: unknown): PracticeSessionRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<PracticeSessionRecord>
  if (typeof value.id !== 'string' || typeof value.startedAt !== 'number') return null
  const focus = value.focus
  if (
    focus !== 'recommended' &&
    focus !== 'spelling' &&
    focus !== 'grammar' &&
    focus !== 'wording'
  ) {
    return null
  }
  return {
    id: value.id,
    version: typeof value.version === 'number' ? value.version : PRACTICE_SESSION_VERSION,
    startedAt: value.startedAt,
    completedAt: typeof value.completedAt === 'number' ? value.completedAt : undefined,
    focus,
    targetPattern:
      value.targetPattern &&
      typeof value.targetPattern === 'object' &&
      (value.targetPattern.category === 'spelling' ||
        value.targetPattern.category === 'grammar' ||
        value.targetPattern.category === 'wording')
        ? {
            category: value.targetPattern.category,
            normalizedOriginal: String(value.targetPattern.normalizedOriginal ?? ''),
            displayOriginal: String(value.targetPattern.displayOriginal ?? ''),
            displayCorrected: String(value.targetPattern.displayCorrected ?? ''),
            count: Number(value.targetPattern.count ?? 0),
          }
        : undefined,
    itemsAttempted: typeof value.itemsAttempted === 'number' ? value.itemsAttempted : 0,
    itemsCompleted: typeof value.itemsCompleted === 'number' ? value.itemsCompleted : 0,
    correctionsDetected: typeof value.correctionsDetected === 'number' ? value.correctionsDetected : 0,
    correctionsAccepted: typeof value.correctionsAccepted === 'number' ? value.correctionsAccepted : 0,
    correctionsRejected: typeof value.correctionsRejected === 'number' ? value.correctionsRejected : 0,
    wordsWritten: typeof value.wordsWritten === 'number' ? value.wordsWritten : 0,
    status: value.status === 'abandoned' ? 'abandoned' : 'completed',
  }
}

export type PracticeSummary = {
  sessionsThisWeek: number
  itemsThisWeek: number
  patternsReviewedThisWeek: number
}

export function computePracticeSummary(
  store: PracticeSessionStoreV1,
  now = Date.now(),
): PracticeSummary {
  const weekStart = now - WEEK_MS
  const recent = store.sessions.filter(
    (session) =>
      session.status === 'completed' &&
      (session.completedAt ?? session.startedAt) >= weekStart,
  )
  return {
    sessionsThisWeek: recent.length,
    itemsThisWeek: recent.reduce((sum, session) => sum + session.itemsCompleted, 0),
    patternsReviewedThisWeek: recent.filter((session) => session.targetPattern).length,
  }
}

export function createPracticeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  sequence += 1
  return `ps-${Date.now()}-${sequence}`
}
