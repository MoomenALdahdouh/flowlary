import type { LearningEventCategory } from './learningEvents.ts'

export const PRACTICE_SESSION_VERSION = 1
export const PRACTICE_SESSION_STORE_VERSION = 1
export const PRACTICE_ITEMS_PER_SESSION = 5
export const MAX_PRACTICE_SESSIONS = 200

export type PracticeFocus = LearningEventCategory | 'recommended'

export type PracticeTargetPattern = {
  category: LearningEventCategory
  normalizedOriginal: string
  displayOriginal: string
  displayCorrected: string
  count: number
}

export type PracticeExerciseType =
  | 'use_correct_form'
  | 'complete_the_sentence'
  | 'rewrite_naturally'
  | 'correct_the_sentence'
  | 'free_writing'

export type PracticeExerciseSpec =
  | {
      targeted: true
      exerciseType: Exclude<PracticeExerciseType, 'free_writing'>
      category: LearningEventCategory
      targetPatternId: string
      targetPattern: PracticeTargetPattern
      prompt: string
      learningObjective: string
      expectedSkill: string
    }
  | {
      targeted: false
      exerciseType: 'free_writing'
      category: LearningEventCategory
      prompt: string
    }

export function practiceTargetPatternId(pattern: PracticeTargetPattern): string {
  return `${pattern.category}:${pattern.normalizedOriginal}`
}

const PRACTICE_TARGET_CATEGORIES = new Set<LearningEventCategory>(['spelling', 'grammar', 'wording'])

/** Parse `category:normalizedOriginal` produced by practiceTargetPatternId(). */
export function parsePracticeTargetPatternId(id: string): {
  category: LearningEventCategory
  normalizedOriginal: string
} | null {
  const trimmed = id.trim()
  if (!trimmed) return null
  const colon = trimmed.indexOf(':')
  if (colon <= 0) return null
  const category = trimmed.slice(0, colon) as LearningEventCategory
  const normalizedOriginal = trimmed.slice(colon + 1).trim().toLowerCase()
  if (!normalizedOriginal || !PRACTICE_TARGET_CATEGORIES.has(category)) return null
  return { category, normalizedOriginal }
}

/** Minimum recurrence count aligned with computeRecurringPatterns(). */
export const PRACTICE_TARGET_MIN_COUNT = 2

export type PracticeSessionStatus = 'completed' | 'abandoned'

export type PracticeSessionRecord = {
  id: string
  version: number
  startedAt: number
  completedAt?: number
  focus: PracticeFocus
  targetPattern?: PracticeTargetPattern
  itemsAttempted: number
  itemsCompleted: number
  correctionsDetected: number
  correctionsAccepted: number
  correctionsRejected: number
  wordsWritten: number
  status: PracticeSessionStatus
}

export type PracticeSessionStoreV1 = {
  version: typeof PRACTICE_SESSION_STORE_VERSION
  sessions: PracticeSessionRecord[]
}

export type PracticeDataState = 'none' | 'emerging' | 'ready'

export type PracticeRecommendation = {
  state: PracticeDataState
  focus?: LearningEventCategory
  pattern?: PracticeTargetPattern
}

export type PracticeItemState = {
  id: string
  prompt: string
  userText: string
  completed: boolean
  correctionsDetected: number
  correctionsAccepted: number
  correctionsRejected: number
}
