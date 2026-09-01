import { randomUUID } from 'node:crypto'
import {
  LEARNING_EVENT_STORE_VERSION,
  MAX_LEARNING_EVENTS,
  learningEventDedupeKeyFromParts,
  materializeLearningEvent,
  type LearningEventIngestInput,
  type LearningEventIngestResult,
  type LearningEventStoreV1,
} from '@flowlary/shared'
import { ensureLoaded, touch } from '../db/store.ts'
import { learningEventsSnapshot } from '../db/learningEventsStoreSlice.ts'

function emptyStore(): LearningEventStoreV1 {
  return { version: LEARNING_EVENT_STORE_VERSION, events: [], samples: [] }
}

function readAccountStore(accountId: string): LearningEventStoreV1 {
  ensureLoaded()
  const raw = learningEventsSnapshot.learningEventsByAccount[accountId]
  if (!raw || !Array.isArray(raw.events)) return emptyStore()
  return {
    version: LEARNING_EVENT_STORE_VERSION,
    events: raw.events.slice(0, MAX_LEARNING_EVENTS),
    samples: Array.isArray(raw.samples) ? raw.samples.slice(0, MAX_LEARNING_EVENTS) : [],
  }
}

function writeAccountStore(accountId: string, store: LearningEventStoreV1): void {
  ensureLoaded()
  learningEventsSnapshot.learningEventsByAccount[accountId] = {
    version: LEARNING_EVENT_STORE_VERSION,
    events: store.events.slice(0, MAX_LEARNING_EVENTS),
    samples: store.samples.slice(0, MAX_LEARNING_EVENTS),
  }
  touch()
}

export function ingestAccountLearningEvents(
  accountId: string,
  inputs: LearningEventIngestInput[],
): LearningEventIngestResult {
  if (!accountId || inputs.length === 0) {
    return { accepted: 0, deduplicated: 0, rejected: 0 }
  }

  const store = readAccountStore(accountId)
  const existingKeys = new Set(
    store.events.map((event) =>
      learningEventDedupeKeyFromParts(
        event.batchId,
        event.category,
        event.normalizedOriginal,
        event.action,
      ),
    ),
  )

  let accepted = 0
  let deduplicated = 0

  for (const input of inputs) {
    const normalizedOriginal = materializeLearningEvent(input, 'probe').normalizedOriginal
    const dedupeKey = learningEventDedupeKeyFromParts(
      input.batchId,
      input.category,
      normalizedOriginal,
      input.action,
    )
    if (existingKeys.has(dedupeKey)) {
      deduplicated += 1
      continue
    }

    const event = materializeLearningEvent(input, randomUUID())
    store.events.unshift(event)
    existingKeys.add(dedupeKey)
    accepted += 1

    if (!store.samples.some((sample) => sample.hash === input.sampleHash)) {
      store.samples.unshift({
        hash: input.sampleHash,
        batchId: input.batchId,
        wordCount: input.sampleWordCount,
        timestamp: event.timestamp,
      })
    }
  }

  store.events.sort((a, b) => b.timestamp - a.timestamp)
  store.samples.sort((a, b) => b.timestamp - a.timestamp)
  writeAccountStore(accountId, store)

  return { accepted, deduplicated, rejected: 0 }
}

export function listAccountLearningEvents(accountId: string): LearningEventStoreV1 {
  return readAccountStore(accountId)
}

export function clearAccountLearningEvents(accountId: string): void {
  ensureLoaded()
  delete learningEventsSnapshot.learningEventsByAccount[accountId]
  touch()
}

export function resetAccountLearningEventsForTests(): void {
  ensureLoaded()
  learningEventsSnapshot.learningEventsByAccount = {}
}
