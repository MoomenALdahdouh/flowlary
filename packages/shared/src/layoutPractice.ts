/** WL-6 — Keyboard Layout Practice (input utility, not English learning). */

export const LAYOUT_PRACTICE_SESSION_VERSION = 1
export const LAYOUT_PRACTICE_SESSION_STORE_VERSION = 1
export const LAYOUT_PRACTICE_ITEMS_PER_SESSION = 10
export const MAX_LAYOUT_PRACTICE_SESSIONS = 100

export type LayoutPracticeSessionStatus = 'completed' | 'abandoned'

export type LayoutPracticeSessionRecord = {
  id: string
  version: number
  startedAt: number
  completedAt?: number
  sourceLayout: string
  targetLayout: string
  itemsAttempted: number
  itemsCorrect: number
  itemsIncorrect: number
  status: LayoutPracticeSessionStatus
}

export type LayoutPracticeSessionStoreV1 = {
  version: typeof LAYOUT_PRACTICE_SESSION_STORE_VERSION
  sessions: LayoutPracticeSessionRecord[]
}

export type LayoutPracticeExercise = {
  id: string
  /** Text as it appears when typed on the wrong layout. */
  prompt: string
  /** Correct text in the target layout. */
  expectedAnswer: string
  sourceLayout: string
  targetLayout: string
}
