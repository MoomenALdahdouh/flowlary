import {
  changePresentInWritingSample,
  hashWritingSample,
  isLearningEventAction,
  isLearningEventCategory,
  isValidLearningChange,
  LEARNING_EVENT_STORE_VERSION,
  LEARNING_EVENT_VERSION,
  MAX_LEARNING_EVENTS,
  normalizeLearningText,
  type LearningEvent,
  type LearningEventAction,
  type LearningEventCategory,
  type LearningEventStoreV1,
  type WritingSampleRecord,
} from '@flowlary/shared'
import type { FlowlaryStorage } from '../../index.ts'
import {
  assertWriteGuard,
  captureWriteGuard,
  getAccountScopedStorage,
  type AccountWriteGuard,
} from '../../accountScopedStorage.ts'
import { activeAccountContext } from '../../activeAccountContext.ts'
import {
  clearRemoteLearningEvents,
  pullAndMergeRemoteLearningEvents,
  pullRemoteLearningProfile,
  pullRemotePracticeSessions,
  pushRemoteLearningProfile,
  pushRemotePracticeSessions,
  syncLearningEventsToRemote,
} from './remoteSync.ts'
import {
  clearPracticeSessions,
  getPracticeSessionStore,
  normalizePracticeSessionStore,
} from '../practice/sessions.ts'
import { getLearningProfile, setLearningProfile } from '../index.ts'

let sequence = 0

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  sequence += 1
  return `${Date.now()}-${sequence}`
}

export function createEmptyLearningEventStore(): LearningEventStoreV1 {
  return { version: LEARNING_EVENT_STORE_VERSION, events: [], samples: [] }
}

export function sanitizeLearningEvent(raw: unknown): LearningEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<LearningEvent>
  if (
    typeof value.id !== 'string' ||
    typeof value.timestamp !== 'number' ||
    typeof value.batchId !== 'string' ||
    typeof value.original !== 'string' ||
    typeof value.corrected !== 'string' ||
    !isLearningEventCategory(value.category) ||
    !isLearningEventAction(value.action)
  ) {
    return null
  }
  if (!isValidLearningChange(value.original, value.corrected)) return null
  const sourceRaw = (value as { source?: unknown }).source
  if (sourceRaw !== 'writing' && sourceRaw !== 'practice' && sourceRaw !== 'future-practice') {
    return null
  }

  const normalizedOriginal = normalizeLearningText(value.original)
  const normalizedCorrected = normalizeLearningText(value.corrected)

  return {
    id: value.id,
    version: typeof value.version === 'number' ? value.version : LEARNING_EVENT_VERSION,
    timestamp: value.timestamp,
    batchId: value.batchId,
    source: sourceRaw === 'practice' || sourceRaw === 'future-practice' ? 'practice' : 'writing',
    category: value.category,
    original: value.original,
    corrected: value.corrected,
    normalizedOriginal,
    normalizedCorrected,
    action: value.action,
    sampleWordCount: typeof value.sampleWordCount === 'number' ? value.sampleWordCount : 0,
    sampleHash: typeof value.sampleHash === 'string' ? value.sampleHash : '',
  }
}

export function normalizeLearningEventStore(raw: unknown): LearningEventStoreV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyLearningEventStore()
  }
  const value = raw as Partial<LearningEventStoreV1 & { entries?: unknown[] }>
  const eventsRaw = Array.isArray(value.events) ? value.events : Array.isArray(value.entries) ? value.entries : []
  const events: LearningEvent[] = []
  for (const item of eventsRaw) {
    const event = sanitizeLearningEvent(item)
    if (event) events.push(event)
  }
  events.sort((a, b) => b.timestamp - a.timestamp)

  const samples: WritingSampleRecord[] = []
  if (Array.isArray(value.samples)) {
    for (const item of value.samples) {
      if (!item || typeof item !== 'object') continue
      const sample = item as Partial<WritingSampleRecord>
      if (
        typeof sample.hash !== 'string' ||
        typeof sample.batchId !== 'string' ||
        typeof sample.wordCount !== 'number' ||
        typeof sample.timestamp !== 'number'
      ) {
        continue
      }
      samples.push({
        hash: sample.hash,
        batchId: sample.batchId,
        wordCount: sample.wordCount,
        timestamp: sample.timestamp,
      })
    }
  }

  return {
    version: LEARNING_EVENT_STORE_VERSION,
    events: pruneLearningEvents(events),
    samples,
  }
}

export function pruneLearningEvents(events: LearningEvent[]): LearningEvent[] {
  return events.slice(0, MAX_LEARNING_EVENTS)
}

export type LearningEventInput = {
  batchId: string
  sampleText: string
  sampleWordCount: number
  category: LearningEventCategory
  original: string
  corrected: string
  action: LearningEventAction
  source?: import('@flowlary/shared').LearningEventSource
  timestamp?: number
}

export function buildLearningEventInput(
  input: Omit<LearningEventInput, 'sampleHash'>,
): LearningEventInput | null {
  if (!isValidLearningChange(input.original, input.corrected)) return null
  if (!changePresentInWritingSample(input.sampleText, input.original)) return null
  return input
}

export class LearningEventService {
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

  private async readStore(): Promise<LearningEventStoreV1> {
    if (!activeAccountContext.getAccountId()) return createEmptyLearningEventStore()
    const raw = await getAccountScopedStorage(this.storage).get('learningEvents')
    return normalizeLearningEventStore(raw)
  }

  private async writeStore(store: LearningEventStoreV1, guard: AccountWriteGuard): Promise<boolean> {
    if (!assertWriteGuard(guard)) return false
    return getAccountScopedStorage(this.storage).set(
      'learningEvents',
      { ...store, _v: LEARNING_EVENT_STORE_VERSION } as unknown as Record<string, unknown>,
      guard,
    )
  }

  async initialize(): Promise<void> {
    await this.enqueue(async () => {
      if (!activeAccountContext.getAccountId()) return
      const guard = captureWriteGuard()
      const local = await this.readStore()
      const merged = await pullAndMergeRemoteLearningEvents(this.storage, local)
      await this.writeStore(merged, guard)
    })
  }

  async getEvents(): Promise<LearningEvent[]> {
    const store = await this.readStore()
    return store.events
  }

  async getStore(): Promise<LearningEventStoreV1> {
    return this.readStore()
  }

  async record(inputs: LearningEventInput[]): Promise<number> {
    if (inputs.length === 0) return 0
    return this.enqueue(async () => {
      if (!activeAccountContext.getAccountId()) return 0
      const guard = captureWriteGuard()
      const store = await this.readStore()
      const existingKeys = new Set(
        store.events.map((event) => `${event.batchId}:${event.category}:${event.normalizedOriginal}:${event.action}`),
      )
      let added = 0
      const now = Date.now()

      for (const input of inputs) {
        const built = buildLearningEventInput(input)
        if (!built) continue

        const normalizedOriginal = normalizeLearningText(built.original)
        const dedupeKey = `${built.batchId}:${built.category}:${normalizedOriginal}:${built.action}`
        if (existingKeys.has(dedupeKey)) continue

        const sampleHash = hashWritingSample(built.sampleText)
        const timestamp = built.timestamp ?? now

        store.events.unshift({
          id: createEventId(),
          version: LEARNING_EVENT_VERSION,
          timestamp,
          batchId: built.batchId,
          source: built.source ?? 'writing',
          category: built.category,
          original: built.original,
          corrected: built.corrected,
          normalizedOriginal,
          normalizedCorrected: normalizeLearningText(built.corrected),
          action: built.action,
          sampleWordCount: built.sampleWordCount,
          sampleHash,
        })
        existingKeys.add(dedupeKey)
        added += 1

        if (!store.samples.some((sample) => sample.hash === sampleHash)) {
          store.samples.unshift({
            hash: sampleHash,
            batchId: built.batchId,
            wordCount: built.sampleWordCount,
            timestamp,
          })
        }
      }

      store.events = pruneLearningEvents(store.events.sort((a, b) => b.timestamp - a.timestamp))
      store.samples = store.samples
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_LEARNING_EVENTS)

      if (added > 0) {
        const ok = await this.writeStore(store, guard)
        if (!ok) return 0
        void syncLearningEventsToRemote(this.storage, inputs)
      }
      return added
    })
  }

  async clearEvents(): Promise<void> {
    await this.enqueue(async () => {
      if (!activeAccountContext.getAccountId()) return
      const guard = captureWriteGuard()
      await this.writeStore(createEmptyLearningEventStore(), guard)
    })
  }
}

let serviceInstance: LearningEventService | null = null

export function getLearningEventService(storage: FlowlaryStorage): LearningEventService {
  if (!serviceInstance) serviceInstance = new LearningEventService(storage)
  return serviceInstance
}

export function resetLearningEventServiceForTests(): void {
  serviceInstance = null
  sequence = 0
}

export async function ensureRemoteLearningSynced(storage: FlowlaryStorage): Promise<void> {
  const [remoteProfile, remotePractice] = await Promise.all([
    pullRemoteLearningProfile(storage),
    pullRemotePracticeSessions(storage),
  ])

  const localProfile = await getLearningProfile(storage)
  if (remoteProfile) {
    const merged = remoteProfile.updatedAt >= localProfile.updatedAt ? remoteProfile : localProfile
    await setLearningProfile(storage, merged)
    if (localProfile.updatedAt > remoteProfile.updatedAt) {
      await pushRemoteLearningProfile(storage, merged)
    }
  } else {
    await pushRemoteLearningProfile(storage, localProfile)
  }

  const scoped = getAccountScopedStorage(storage)
  const localPractice = normalizePracticeSessionStore(await scoped.get('learningSessions'))
  const mergedPractice = remotePractice
    ? normalizePracticeSessionStore({
        version: localPractice.version,
        sessions: [
          ...new Map(
            [...localPractice.sessions, ...remotePractice.sessions].map((session) => [session.id, session]),
          ).values(),
        ],
      })
    : localPractice
  await scoped.set('learningSessions', mergedPractice as unknown as Record<string, unknown>)
  if (
    mergedPractice.sessions.length > (remotePractice?.sessions.length ?? 0) ||
    localPractice.sessions.length > 0
  ) {
    await pushRemotePracticeSessions(storage, mergedPractice)
  }
}

export async function ensureLearningEventsInitialized(storage: FlowlaryStorage): Promise<void> {
  if (!activeAccountContext.getAccountId()) return
  await getLearningEventService(storage).initialize()
  await ensureRemoteLearningSynced(storage)
}

export async function recordLearningEvents(
  storage: FlowlaryStorage,
  inputs: LearningEventInput[],
): Promise<number> {
  if (!activeAccountContext.getAccountId()) return 0
  const service = getLearningEventService(storage)
  await service.initialize()
  return service.record(inputs)
}

export async function clearLearningEvents(storage: FlowlaryStorage): Promise<void> {
  if (!activeAccountContext.getAccountId()) return
  await getLearningEventService(storage).clearEvents()
  await clearRemoteLearningEvents(storage)
  await clearPracticeSessions(storage)
}

export async function getLearningEvents(storage: FlowlaryStorage): Promise<LearningEvent[]> {
  if (!activeAccountContext.getAccountId()) return []
  return getLearningEventService(storage).getEvents()
}
