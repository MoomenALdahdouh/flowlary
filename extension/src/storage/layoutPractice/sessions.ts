import {
  LAYOUT_PRACTICE_SESSION_VERSION,
  LAYOUT_PRACTICE_SESSION_STORE_VERSION,
  MAX_LAYOUT_PRACTICE_SESSIONS,
  type LayoutPracticeSessionRecord,
  type LayoutPracticeSessionStoreV1,
} from '@flowlary/shared'
import type { FlowlaryStorage } from '../index.ts'
import {
  assertWriteGuard,
  captureWriteGuard,
  getAccountScopedStorage,
  type AccountWriteGuard,
} from '../accountScopedStorage.ts'
import { activeAccountContext } from '../activeAccountContext.ts'

let sequence = 0

export function createLayoutPracticeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  sequence += 1
  return `lps-${Date.now()}-${sequence}`
}

export function createEmptyLayoutPracticeSessionStore(): LayoutPracticeSessionStoreV1 {
  return { version: LAYOUT_PRACTICE_SESSION_STORE_VERSION, sessions: [] }
}

export function sanitizeLayoutPracticeSession(raw: unknown): LayoutPracticeSessionRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<LayoutPracticeSessionRecord>
  if (
    typeof value.id !== 'string' ||
    typeof value.startedAt !== 'number' ||
    typeof value.sourceLayout !== 'string' ||
    typeof value.targetLayout !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    version: typeof value.version === 'number' ? value.version : LAYOUT_PRACTICE_SESSION_VERSION,
    startedAt: value.startedAt,
    completedAt: typeof value.completedAt === 'number' ? value.completedAt : undefined,
    sourceLayout: value.sourceLayout,
    targetLayout: value.targetLayout,
    itemsAttempted: typeof value.itemsAttempted === 'number' ? value.itemsAttempted : 0,
    itemsCorrect: typeof value.itemsCorrect === 'number' ? value.itemsCorrect : 0,
    itemsIncorrect: typeof value.itemsIncorrect === 'number' ? value.itemsIncorrect : 0,
    status: value.status === 'abandoned' ? 'abandoned' : 'completed',
  }
}

export function normalizeLayoutPracticeSessionStore(raw: unknown): LayoutPracticeSessionStoreV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyLayoutPracticeSessionStore()
  }
  const value = raw as Partial<LayoutPracticeSessionStoreV1>
  const sessions: LayoutPracticeSessionRecord[] = []
  if (Array.isArray(value.sessions)) {
    for (const item of value.sessions) {
      const session = sanitizeLayoutPracticeSession(item)
      if (session) sessions.push(session)
    }
  }
  sessions.sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
  return {
    version: LAYOUT_PRACTICE_SESSION_STORE_VERSION,
    sessions: sessions.slice(0, MAX_LAYOUT_PRACTICE_SESSIONS),
  }
}

export class LayoutPracticeSessionStore {
  private writeChain: Promise<void> = Promise.resolve()

  constructor(private storage: FlowlaryStorage) {}

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(fn, fn)
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  private async readStore(): Promise<LayoutPracticeSessionStoreV1> {
    if (!activeAccountContext.getAccountId()) return createEmptyLayoutPracticeSessionStore()
    const raw = await getAccountScopedStorage(this.storage).get('layoutPracticeSessions')
    return normalizeLayoutPracticeSessionStore(raw)
  }

  private async writeStore(
    store: LayoutPracticeSessionStoreV1,
    guard: AccountWriteGuard,
  ): Promise<boolean> {
    if (!assertWriteGuard(guard)) return false
    return getAccountScopedStorage(this.storage).set('layoutPracticeSessions', store, guard)
  }

  async saveSession(session: LayoutPracticeSessionRecord): Promise<boolean> {
    return this.enqueue(async () => {
      if (!activeAccountContext.getAccountId()) return false
      const guard = captureWriteGuard()
      const store = await this.readStore()
      store.sessions.unshift(session)
      store.sessions = store.sessions.slice(0, MAX_LAYOUT_PRACTICE_SESSIONS)
      return this.writeStore(store, guard)
    })
  }
}

export function getLayoutPracticeSessionStore(storage: FlowlaryStorage): LayoutPracticeSessionStore {
  return new LayoutPracticeSessionStore(storage)
}
