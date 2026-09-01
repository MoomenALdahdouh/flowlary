import {
  hashWritingSample,
  learningEventDedupeKeyFromParts,
  normalizeLearningText,
  type CorrectionResponse,
  type LearningEvent,
  type LearningEventIngestInput,
} from '@flowlary/shared'
import {
  fetchLearningEvents,
  ingestLearningEvents,
} from '../account/learningEventsClient.ts'
import {
  buildWebLearningInputs,
  readWebLearningStore,
  type WebLearningEventInput,
} from './webLearningStore.ts'

const STORE_PREFIX = 'flowlary.web.account.'
const QUEUE_SUFFIX = '.learning.queue'
const MIGRATION_SUFFIX = '.learning.migrated.v1'

export type LearningSyncStatus = 'idle' | 'synced' | 'pending' | 'already_recorded'

function queueKey(accountId: string): string {
  return `${STORE_PREFIX}${accountId}${QUEUE_SUFFIX}`
}

function migrationKey(accountId: string): string {
  return `${STORE_PREFIX}${accountId}${MIGRATION_SUFFIX}`
}

function ingestDedupeKey(input: LearningEventIngestInput): string {
  return learningEventDedupeKeyFromParts(
    input.batchId,
    input.category,
    normalizeLearningText(input.original),
    input.action,
  )
}

function webInputToIngest(input: WebLearningEventInput, sampleText: string): LearningEventIngestInput {
  return {
    batchId: input.batchId,
    category: input.category,
    original: input.original,
    corrected: input.corrected,
    action: input.action,
    source: 'writing',
    sampleWordCount: input.sampleWordCount,
    sampleHash: hashWritingSample(sampleText),
  }
}

function eventToIngest(event: LearningEvent): LearningEventIngestInput {
  return {
    batchId: event.batchId,
    category: event.category,
    original: event.original,
    corrected: event.corrected,
    action: event.action,
    source: 'writing',
    sampleWordCount: event.sampleWordCount,
    sampleHash: event.sampleHash,
    timestamp: event.timestamp,
  }
}

export function readLearningEventQueue(accountId: string): LearningEventIngestInput[] {
  if (!accountId || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(queueKey(accountId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is LearningEventIngestInput => {
      return Boolean(item && typeof item === 'object' && typeof (item as LearningEventIngestInput).batchId === 'string')
    })
  } catch {
    return []
  }
}

export function writeLearningEventQueue(accountId: string, queue: LearningEventIngestInput[]): void {
  if (!accountId || typeof localStorage === 'undefined') return
  if (queue.length === 0) {
    localStorage.removeItem(queueKey(accountId))
    return
  }
  localStorage.setItem(queueKey(accountId), JSON.stringify(queue))
}

function enqueueLearningEvents(accountId: string, events: LearningEventIngestInput[]): void {
  const existing = readLearningEventQueue(accountId)
  const keys = new Set(existing.map(ingestDedupeKey))
  const merged = [...existing]
  for (const event of events) {
    const key = ingestDedupeKey(event)
    if (keys.has(key)) continue
    keys.add(key)
    merged.push(event)
  }
  writeLearningEventQueue(accountId, merged)
}

export async function flushLearningEventQueue(accountId: string): Promise<boolean> {
  const queue = readLearningEventQueue(accountId)
  if (queue.length === 0) return true

  const result = await ingestLearningEvents(queue)
  if (!result.ok) return false

  writeLearningEventQueue(accountId, [])
  return true
}

export async function migrateLocalWebLearningEvents(accountId: string): Promise<void> {
  if (!accountId || typeof localStorage === 'undefined') return
  if (localStorage.getItem(migrationKey(accountId)) === '1') return

  const store = readWebLearningStore(accountId)
  const inputs = store.events
    .filter((event) => event.source === 'writing' && event.action === 'detected' && event.category !== 'layout')
    .map(eventToIngest)

  if (inputs.length > 0) {
    const result = await ingestLearningEvents(inputs)
    if (!result.ok) {
      enqueueLearningEvents(accountId, inputs)
      return
    }
  }

  localStorage.setItem(migrationKey(accountId), '1')
}

export async function syncWritingLabCorrection(
  accountId: string,
  batchId: string,
  segment: string,
  response: CorrectionResponse,
): Promise<LearningSyncStatus> {
  const inputs = buildWebLearningInputs(batchId, segment, response).map((input) =>
    webInputToIngest(input, segment),
  )
  if (inputs.length === 0) return 'idle'

  const result = await ingestLearningEvents(inputs)
  if (result.ok) {
    void flushLearningEventQueue(accountId)
    if (result.accepted === 0 && result.deduplicated > 0) return 'already_recorded'
    return 'synced'
  }

  enqueueLearningEvents(accountId, inputs)
  return 'pending'
}

/** Canonical learning events for the signed-in account (server-first, local fallback). */
export async function fetchCanonicalLearningEvents(accountId: string): Promise<LearningEvent[]> {
  const remote = await fetchLearningEvents()
  if (remote.ok) return remote.store.events
  return readWebLearningStore(accountId).events
}

export async function bootstrapWebLearningSync(accountId: string): Promise<void> {
  await migrateLocalWebLearningEvents(accountId)
  await flushLearningEventQueue(accountId)
  const { pushRemoteLearningProfile, pushRemotePracticeSessions } = await import('../account/learningSyncClient.ts')
  const { readLearningProfile, readPracticeSessionStore } = await import('../dashboard/storage/webLocalStore.ts')
  void pushRemoteLearningProfile(readLearningProfile(accountId))
  void pushRemotePracticeSessions(readPracticeSessionStore(accountId))
}

export function resetWebLearningSyncForTests(): void {
  if (typeof localStorage === 'undefined') return
  const keys: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key && (key.includes('.learning.queue') || key.includes('.learning.migrated.v1'))) {
      keys.push(key)
    }
  }
  for (const key of keys) localStorage.removeItem(key)
}
