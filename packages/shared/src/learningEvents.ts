import type { ChangeType } from './correction/index.ts'

export const LEARNING_EVENT_VERSION = 1
export const LEARNING_EVENT_STORE_VERSION = 1

/** Maximum persisted learning events (newest retained on trim). */
export const MAX_LEARNING_EVENTS = 2000

/** Minimum written words before showing errors / 100 words. */
export const MIN_WORDS_FOR_ERROR_RATE = 50

/** Rolling trend window (7 days). */
export const PROGRESS_TREND_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

/** Minimum unique errors in each trend period before showing a percentage. */
export const MIN_ERRORS_FOR_TREND = 3

export type LearningEventCategory = ChangeType

/** Writing-quality categories (English correction). */
export const WRITING_LEARNING_CATEGORIES = ['spelling', 'grammar', 'wording'] as const

/** Input-mechanics categories (keyboard layout). */
export const INPUT_LEARNING_CATEGORIES = ['layout'] as const

export const LEARNING_CATEGORIES = [
  ...WRITING_LEARNING_CATEGORIES,
  ...INPUT_LEARNING_CATEGORIES,
] as const

export type LearningEventAction = 'detected' | 'accepted' | 'rejected'

export type LearningEventSource = 'writing' | 'practice'

export type LearningEvent = {
  id: string
  version: number
  timestamp: number
  batchId: string
  source: LearningEventSource
  category: LearningEventCategory
  original: string
  corrected: string
  normalizedOriginal: string
  normalizedCorrected: string
  action: LearningEventAction
  /** Words in the user's writing sample for this correction batch. */
  sampleWordCount: number
  /** Stable hash of the writing sample text (dedupes word-count totals). */
  sampleHash: string
}

export type WritingSampleRecord = {
  hash: string
  batchId: string
  wordCount: number
  timestamp: number
}

export type LearningEventStoreV1 = {
  version: typeof LEARNING_EVENT_STORE_VERSION
  events: LearningEvent[]
  samples: WritingSampleRecord[]
}

export function isLearningEventCategory(value: unknown): value is LearningEventCategory {
  return (
    value === 'spelling' ||
    value === 'grammar' ||
    value === 'wording' ||
    value === 'layout'
  )
}

export function isLearningEventAction(value: unknown): value is LearningEventAction {
  return value === 'detected' || value === 'accepted' || value === 'rejected'
}

/**
 * Deterministic normalization for recurring-pattern comparison.
 * Trims, collapses whitespace, lowercases — no stemming or semantic folding.
 */
export function normalizeLearningText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function learningEventDedupeKey(event: Pick<LearningEvent, 'batchId' | 'category' | 'normalizedOriginal'>): string {
  return `${event.batchId}:${event.category}:${event.normalizedOriginal}`
}

export function isValidLearningChange(original: string, corrected: string): boolean {
  const from = original.trim()
  const to = corrected.trim()
  if (!from || !to) return false
  if (from === to) return false
  if (normalizeLearningText(from) === normalizeLearningText(to)) return false
  return true
}

export function changePresentInWritingSample(sample: string, original: string): boolean {
  if (!original.trim()) return false
  return sample.includes(original)
}

/** Simple stable hash for writing-sample deduplication (not cryptographic). */
export function hashWritingSample(text: string): string {
  const normalized = normalizeLearningText(text)
  let hash = 2166136261
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
