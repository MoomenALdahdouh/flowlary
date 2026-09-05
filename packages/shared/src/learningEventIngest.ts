import {
  hashWritingSample,
  isLearningEventAction,
  isLearningEventCategory,
  isValidLearningChange,
  LEARNING_EVENT_VERSION,
  normalizeLearningText,
  WRITING_LEARNING_CATEGORIES,
  type LearningEvent,
  type LearningEventAction,
  type LearningEventCategory,
  type LearningEventSource,
} from './learningEvents.ts'

export const MAX_LEARNING_EVENT_INGEST_BATCH = 25
export const MAX_LEARNING_EVENT_FIELD_CHARS = 512
export const MAX_LEARNING_EVENT_AGE_MS = 366 * 24 * 60 * 60 * 1000
export const MAX_LEARNING_EVENT_FUTURE_MS = 5 * 60 * 1000

export type LearningEventIngestInput = {
  batchId: string
  category: LearningEventCategory
  original: string
  corrected: string
  action: LearningEventAction
  source: LearningEventSource
  sampleWordCount: number
  sampleHash: string
  timestamp?: number
}

export type LearningEventIngestResult = {
  accepted: number
  deduplicated: number
  rejected: number
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

export function learningEventDedupeKeyFromParts(
  batchId: string,
  category: LearningEventCategory,
  normalizedOriginal: string,
  action: LearningEventAction,
): string {
  return `${batchId}:${category}:${normalizedOriginal}:${action}`
}

export function validateLearningEventIngestInput(
  raw: unknown,
  now = Date.now(),
  options?: { website?: boolean },
): LearningEventIngestInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<LearningEventIngestInput>
  const batchId = boundedString(value.batchId, 128)
  const original = boundedString(value.original, MAX_LEARNING_EVENT_FIELD_CHARS)
  const corrected = boundedString(value.corrected, MAX_LEARNING_EVENT_FIELD_CHARS)
  const sampleHash = boundedString(value.sampleHash, 64)
  if (!batchId || !original || !corrected || !sampleHash) return null
  if (!isLearningEventCategory(value.category)) return null
  if (!isLearningEventAction(value.action)) return null
  if (value.source !== 'writing' && value.source !== 'practice') return null
  if (!isValidLearningChange(original, corrected)) return null

  if (options?.website) {
    if (value.category === 'layout') {
      if (value.source !== 'writing') return null
      if (value.action !== 'detected' && value.action !== 'accepted') return null
    } else if (value.source === 'practice') {
      if (!(WRITING_LEARNING_CATEGORIES as readonly string[]).includes(value.category)) return null
    } else if (value.source === 'writing') {
      if (value.action !== 'detected') return null
      if (!(WRITING_LEARNING_CATEGORIES as readonly string[]).includes(value.category)) return null
    } else {
      return null
    }
  }

  const sampleWordCount =
    typeof value.sampleWordCount === 'number' && value.sampleWordCount >= 0 && value.sampleWordCount <= 50_000
      ? Math.floor(value.sampleWordCount)
      : null
  if (sampleWordCount == null) return null

  const timestamp = typeof value.timestamp === 'number' ? value.timestamp : now
  if (timestamp > now + MAX_LEARNING_EVENT_FUTURE_MS) return null
  if (timestamp < now - MAX_LEARNING_EVENT_AGE_MS) return null

  return {
    batchId,
    category: value.category,
    original,
    corrected,
    action: value.action,
    source: value.source,
    sampleWordCount,
    sampleHash,
    timestamp,
  }
}

export function materializeLearningEvent(
  input: LearningEventIngestInput,
  id: string,
): LearningEvent {
  return {
    id,
    version: LEARNING_EVENT_VERSION,
    timestamp: input.timestamp ?? Date.now(),
    batchId: input.batchId,
    source: input.source === 'practice' ? 'practice' : 'writing',
    category: input.category,
    original: input.original,
    corrected: input.corrected,
    normalizedOriginal: normalizeLearningText(input.original),
    normalizedCorrected: normalizeLearningText(input.corrected),
    action: input.action,
    sampleWordCount: input.sampleWordCount,
    sampleHash: input.sampleHash,
  }
}

export function buildSampleHashFromText(text: string): string {
  return hashWritingSample(text)
}
