import type { LearningFocus } from './learning.ts'
import type { LearningEventCategory } from './learningEvents.ts'

export const DAILY_BRIEF_MAX_GENERATIONS_PER_DAY = 3

export type DailyBriefState = 'signed_out' | 'empty' | 'insufficient' | 'ready'

export type DailyBriefAction =
  | { kind: 'practice_pattern'; targetPatternId: string; category: LearningEventCategory }
  | { kind: 'practice_focus'; focus: LearningEventCategory }
  | { kind: 'keep_writing' }
  | { kind: 'view_progress' }

export type DailyBriefRecurringPattern = {
  category: LearningEventCategory
  displayOriginal: string
  displayCorrected: string
  count: number
  targetPatternId: string
}

export type DailyBriefImprovement = {
  scope: 'overall'
  direction: 'down' | 'up'
  percent: number
}

/** Structured insight snapshot — reusable by future Full Report / AI Coach. */
export type DailyLearningBriefSnapshot = {
  state: DailyBriefState
  evidenceVersion: string
  generatedAt: number
  dayKey: string
  focusCategory: LearningFocus | null
  recurringPattern: DailyBriefRecurringPattern | null
  improvement: DailyBriefImprovement | null
  recommendedAction: DailyBriefAction
  writingEventCount: number
  wordsWritten: number
  practiceSessionsThisWeek: number
  hasRecentWriting: boolean
  /** WL-4E: optional target progression signal for top recurring pattern. */
  targetProgression: {
    targetPatternId: string
    state: import('./practiceProgression.ts').TargetProgressionState
    displayOriginal: string
    displayCorrected: string
    cleanAttempts: number
    practiceAttempts: number
  } | null
}

export type DailyLearningBrief = DailyLearningBriefSnapshot & {
  fromCache: boolean
  generationsUsedToday: number
  generationsRemainingToday: number
  limitReached: boolean
}

export type DailyBriefQuotaV1 = {
  version: 1
  dayKey: string
  generationsUsed: number
  lastEvidenceVersion: string | null
  cachedBrief: DailyLearningBriefSnapshot | null
}

export function createEmptyDailyBriefQuota(dayKey: string): DailyBriefQuotaV1 {
  return {
    version: 1,
    dayKey,
    generationsUsed: 0,
    lastEvidenceVersion: null,
    cachedBrief: null,
  }
}
