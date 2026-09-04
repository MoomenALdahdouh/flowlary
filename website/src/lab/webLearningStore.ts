import {
  LEARNING_EVENT_STORE_VERSION,
  LEARNING_EVENT_VERSION,
  MAX_LEARNING_EVENTS,
  changePresentInWritingSample,
  hashWritingSample,
  isValidLearningChange,
  normalizeLearningText,
  type CorrectionChange,
  type CorrectionResponse,
  type LearningEvent,
  isLearningEventCategory,
  type LearningEventCategory,
  type LearningEventStoreV1,
  type LearningEventAction,
} from '@flowlary/shared'
import { countWords } from '@flowlary/shared'
import { canStoreProduct } from '../cookies/consent.ts'

const STORE_PREFIX = 'flowlary.web.account.'

function storageKey(accountId: string): string {
  return `${STORE_PREFIX}${accountId}.learning.events`
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createEmptyWebLearningStore(): LearningEventStoreV1 {
  return { version: LEARNING_EVENT_STORE_VERSION, events: [], samples: [] }
}

function sanitizeEvent(raw: unknown): LearningEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<LearningEvent>
  if (
    typeof value.id !== 'string' ||
    typeof value.timestamp !== 'number' ||
    typeof value.batchId !== 'string' ||
    typeof value.original !== 'string' ||
    typeof value.corrected !== 'string' ||
    !isValidLearningChange(value.original, value.corrected)
  ) {
    return null
  }
  if (value.category === 'layout') return null
  if (!isLearningEventCategory(value.category)) return null
  if (value.action !== 'detected' && value.action !== 'accepted' && value.action !== 'rejected') {
    return null
  }
  if (value.source !== 'writing' && value.source !== 'practice') return null

  return {
    id: value.id,
    version: typeof value.version === 'number' ? value.version : LEARNING_EVENT_VERSION,
    timestamp: value.timestamp,
    batchId: value.batchId,
    source: value.source === 'practice' ? 'practice' : 'writing',
    category: value.category,
    original: value.original,
    corrected: value.corrected,
    normalizedOriginal: normalizeLearningText(value.original),
    normalizedCorrected: normalizeLearningText(value.corrected),
    action: value.action,
    sampleWordCount: typeof value.sampleWordCount === 'number' ? value.sampleWordCount : 0,
    sampleHash: typeof value.sampleHash === 'string' ? value.sampleHash : '',
  }
}

export function normalizeWebLearningStore(raw: unknown): LearningEventStoreV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyWebLearningStore()
  }
  const value = raw as Partial<LearningEventStoreV1>
  const eventsRaw = Array.isArray(value.events) ? value.events : []
  const events: LearningEvent[] = []
  for (const item of eventsRaw) {
    const event = sanitizeEvent(item)
    if (event) events.push(event)
  }
  events.sort((a, b) => b.timestamp - a.timestamp)
  return {
    version: LEARNING_EVENT_STORE_VERSION,
    events: events.slice(0, MAX_LEARNING_EVENTS),
    samples: Array.isArray(value.samples) ? value.samples.slice(0, MAX_LEARNING_EVENTS) : [],
  }
}

export function readWebLearningStore(accountId: string): LearningEventStoreV1 {
  if (!accountId || typeof localStorage === 'undefined') return createEmptyWebLearningStore()
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    if (!raw) return createEmptyWebLearningStore()
    return normalizeWebLearningStore(JSON.parse(raw))
  } catch {
    return createEmptyWebLearningStore()
  }
}

export function writeWebLearningStore(accountId: string, store: LearningEventStoreV1): void {
  if (!accountId || !canStoreProduct()) return
  localStorage.setItem(storageKey(accountId), JSON.stringify(store))
}

export type WebLearningEventInput = {
  batchId: string
  sampleText: string
  sampleWordCount: number
  category: LearningEventCategory
  original: string
  corrected: string
  action: LearningEventAction
}

function validWritingChanges(segment: string, changes: CorrectionChange[]): CorrectionChange[] {
  return changes.filter(
    (change) =>
      change.type !== 'layout' &&
      changePresentInWritingSample(segment, change.original) &&
      isValidLearningChange(change.original, change.corrected),
  )
}

export function buildWebLearningInputs(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
  action: LearningEventAction = 'detected',
): WebLearningEventInput[] {
  const sampleWordCount = countWords(segment)
  return validWritingChanges(segment, response.changes).map((change) => ({
    batchId,
    sampleText: segment,
    sampleWordCount,
    category: change.type,
    original: change.original,
    corrected: change.corrected,
    action,
  }))
}

/** Record learning events for a successful website correction (account-scoped, deduped). */
export function recordWebCorrectionLearning(
  accountId: string,
  batchId: string,
  segment: string,
  response: CorrectionResponse,
): number {
  if (!accountId) return 0
  const inputs = buildWebLearningInputs(batchId, segment, response, 'detected')
  if (inputs.length === 0) return 0

  const store = readWebLearningStore(accountId)
  const existingKeys = new Set(
    store.events.map((event) => `${event.batchId}:${event.category}:${event.normalizedOriginal}:${event.action}`),
  )
  let added = 0
  const now = Date.now()

  for (const input of inputs) {
    if (!isValidLearningChange(input.original, input.corrected)) continue
    if (!changePresentInWritingSample(input.sampleText, input.original)) continue
    const built = input

    const normalizedOriginal = normalizeLearningText(built.original)
    const dedupeKey = `${built.batchId}:${built.category}:${normalizedOriginal}:${built.action}`
    if (existingKeys.has(dedupeKey)) continue

    const sampleHash = hashWritingSample(built.sampleText)
    store.events.unshift({
      id: createEventId(),
      version: LEARNING_EVENT_VERSION,
      timestamp: now,
      batchId: built.batchId,
      source: 'writing',
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
        timestamp: now,
      })
    }
  }

  store.events = store.events.slice(0, MAX_LEARNING_EVENTS)
  writeWebLearningStore(accountId, store)
  return added
}

export function clearWebLearningStore(accountId: string): void {
  if (!accountId) return
  try {
    localStorage.removeItem(storageKey(accountId))
  } catch {
    /* ignore */
  }
}
