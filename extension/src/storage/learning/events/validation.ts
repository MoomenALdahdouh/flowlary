import {
  isLearningEventAction,
  isLearningEventCategory,
  LEARNING_EVENT_STORE_VERSION,
  MAX_LEARNING_EVENTS,
  normalizeLearningText,
  type LearningEvent,
  type LearningEventStoreV1,
  type WritingSampleRecord,
} from '@flowlary/shared'

export function sanitizeLearningEvent(raw: unknown, now = Date.now()): LearningEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<LearningEvent>
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.batchId !== 'string' ||
    !value.batchId.trim() ||
    typeof value.original !== 'string' ||
    typeof value.corrected !== 'string' ||
    !isLearningEventCategory(value.category) ||
    !isLearningEventAction(value.action) ||
    typeof value.sampleHash !== 'string'
  ) {
    return null
  }

  const original = value.original.trim()
  const corrected = value.corrected.trim()
  if (!original || !corrected || original === corrected) return null

  const sourceRaw = (value as { source?: unknown }).source
  return {
    id: value.id.trim(),
    version: typeof value.version === 'number' ? value.version : 1,
    timestamp: typeof value.timestamp === 'number' ? value.timestamp : now,
    batchId: value.batchId.trim(),
    source: sourceRaw === 'practice' || sourceRaw === 'future-practice' ? 'practice' : 'writing',
    category: value.category,
    original,
    corrected,
    normalizedOriginal:
      typeof value.normalizedOriginal === 'string'
        ? value.normalizedOriginal
        : normalizeLearningText(original),
    normalizedCorrected:
      typeof value.normalizedCorrected === 'string'
        ? value.normalizedCorrected
        : normalizeLearningText(corrected),
    action: value.action,
    sampleWordCount: typeof value.sampleWordCount === 'number' ? Math.max(0, value.sampleWordCount) : 0,
    sampleHash: value.sampleHash,
  }
}

export function sanitizeWritingSample(raw: unknown, now = Date.now()): WritingSampleRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<WritingSampleRecord>
  if (typeof value.hash !== 'string' || typeof value.batchId !== 'string') return null
  return {
    hash: value.hash,
    batchId: value.batchId.trim(),
    wordCount: typeof value.wordCount === 'number' ? Math.max(0, value.wordCount) : 0,
    timestamp: typeof value.timestamp === 'number' ? value.timestamp : now,
  }
}

export function normalizeLearningEventStore(raw: unknown): LearningEventStoreV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { version: LEARNING_EVENT_STORE_VERSION, events: [], samples: [] }
  }
  const value = raw as Partial<LearningEventStoreV1> & { entries?: unknown[] }
  const eventsSource = Array.isArray(value.events) ? value.events : value.entries
  const events: LearningEvent[] = []
  if (Array.isArray(eventsSource)) {
    for (const item of eventsSource) {
      const event = sanitizeLearningEvent(item)
      if (event) events.push(event)
    }
  }

  const samples: WritingSampleRecord[] = []
  if (Array.isArray(value.samples)) {
    for (const item of value.samples) {
      const sample = sanitizeWritingSample(item)
      if (sample) samples.push(sample)
    }
  }

  events.sort((a, b) => b.timestamp - a.timestamp)
  return {
    version: LEARNING_EVENT_STORE_VERSION,
    events: pruneLearningEvents(events),
    samples: pruneWritingSamples(samples),
  }
}

export function pruneLearningEvents(events: LearningEvent[]): LearningEvent[] {
  return events.slice(0, MAX_LEARNING_EVENTS)
}

export function pruneWritingSamples(samples: WritingSampleRecord[]): WritingSampleRecord[] {
  const byHash = new Map<string, WritingSampleRecord>()
  for (const sample of samples.sort((a, b) => b.timestamp - a.timestamp)) {
    if (!byHash.has(sample.hash)) byHash.set(sample.hash, sample)
  }
  return [...byHash.values()].slice(0, MAX_LEARNING_EVENTS)
}

export function isDuplicateLearningEvent(existing: LearningEvent[], candidate: LearningEvent): boolean {
  return existing.some(
    (event) =>
      event.batchId === candidate.batchId &&
      event.category === candidate.category &&
      event.normalizedOriginal === candidate.normalizedOriginal &&
      event.action === candidate.action,
  )
}
