import type { LearningEvent, LearningEventCategory } from './learningEvents.ts'
import type { PracticeSessionRecord, PracticeTargetPattern } from './practice.ts'
import { practiceTargetPatternId } from './practice.ts'

export const MIN_TARGET_ATTEMPTS_FOR_PARTIAL = 2
export const MIN_TARGET_ATTEMPTS_FOR_IMPROVING = 4
export const MIN_TARGET_ATTEMPTS_FOR_STABLE = 3
export const STABLE_CLEAN_RATIO = 0.75
export const RECENT_ATTEMPT_WINDOW = 3
export const IMPROVING_DELTA = 0.25

export type TargetProgressionState =
  | 'new'
  | 'insufficient'
  | 'practicing'
  | 'improving'
  | 'stable'
  | 'needs_attention'

export type TargetProgressionEvidenceQuality = 'insufficient' | 'partial' | 'ready'

export type TargetPracticeProgression = {
  targetPatternId: string
  category: LearningEventCategory
  displayOriginal: string
  displayCorrected: string
  state: TargetProgressionState
  evidenceQuality: TargetProgressionEvidenceQuality
  practiceAttempts: number
  cleanAttempts: number
  targetErrorAttempts: number
  cleanRate: number | null
  writingRecurrence: number
  lastPracticedAt: number | null
}

export type TargetAttemptOutcome = {
  batchId: string
  timestamp: number
  hadTargetError: boolean
}

function patternFromId(targetPatternId: string): { category: LearningEventCategory; normalizedOriginal: string } | null {
  const colon = targetPatternId.indexOf(':')
  if (colon <= 0) return null
  const category = targetPatternId.slice(0, colon) as LearningEventCategory
  if (category !== 'spelling' && category !== 'grammar' && category !== 'wording') return null
  const normalizedOriginal = targetPatternId.slice(colon + 1)
  if (!normalizedOriginal) return null
  return { category, normalizedOriginal }
}

export function targetPatternMatchesEvent(
  pattern: Pick<PracticeTargetPattern, 'category' | 'normalizedOriginal'>,
  event: Pick<LearningEvent, 'category' | 'normalizedOriginal' | 'source' | 'action'>,
): boolean {
  return (
    event.source === 'practice' &&
    event.action === 'detected' &&
    event.category === pattern.category &&
    event.normalizedOriginal === pattern.normalizedOriginal
  )
}

/** Infer completed practice item batch IDs from targeted session records. */
export function inferTargetPracticeBatchIds(
  pattern: PracticeTargetPattern,
  sessions: PracticeSessionRecord[],
): string[] {
  const targetId = practiceTargetPatternId(pattern)
  const batchIds: string[] = []
  for (const session of sessions) {
    if (session.status !== 'completed' || !session.targetPattern) continue
    if (practiceTargetPatternId(session.targetPattern) !== targetId) continue
    for (let i = 0; i < session.itemsCompleted; i++) {
      batchIds.push(`practice-${session.id}-${i}`)
    }
  }
  return batchIds
}

export function buildTargetAttemptOutcomes(
  pattern: PracticeTargetPattern,
  events: LearningEvent[],
  sessions: PracticeSessionRecord[],
): TargetAttemptOutcome[] {
  const batchIds = inferTargetPracticeBatchIds(pattern, sessions)
  const uniqueBatchIds = [...new Set(batchIds)]
  const practiceEvents = events.filter((event) => event.source === 'practice')

  return uniqueBatchIds.map((batchId) => {
    const related = practiceEvents.filter((event) => event.batchId === batchId)
    const hadTargetError = related.some((event) => targetPatternMatchesEvent(pattern, event))
    const timestamp = related.reduce((max, event) => Math.max(max, event.timestamp), 0)
    const sessionTs =
      sessions.find((session) => batchId.startsWith(`practice-${session.id}-`))?.completedAt ??
      sessions.find((session) => batchId.startsWith(`practice-${session.id}-`))?.startedAt ??
      0
    return {
      batchId,
      timestamp: timestamp || sessionTs,
      hadTargetError,
    }
  })
}

function resolveEvidenceQuality(attempts: number): TargetProgressionEvidenceQuality {
  if (attempts < MIN_TARGET_ATTEMPTS_FOR_PARTIAL) return 'insufficient'
  if (attempts < MIN_TARGET_ATTEMPTS_FOR_IMPROVING) return 'partial'
  return 'ready'
}

function countWritingRecurrence(
  pattern: Pick<PracticeTargetPattern, 'category' | 'normalizedOriginal'>,
  events: LearningEvent[],
): number {
  return events.filter(
    (event) =>
      event.source === 'writing' &&
      event.action !== 'rejected' &&
      event.category === pattern.category &&
      event.normalizedOriginal === pattern.normalizedOriginal,
  ).length
}

function resolveProgressionState(
  outcomes: TargetAttemptOutcome[],
  writingRecurrence: number,
): TargetProgressionState {
  const attempts = outcomes.length
  if (attempts === 0) return 'new'
  if (attempts === 1) return 'insufficient'

  const sorted = [...outcomes].sort((a, b) => a.timestamp - b.timestamp)
  const targetErrors = sorted.filter((item) => item.hadTargetError).length
  const cleanAttempts = attempts - targetErrors
  const cleanRate = cleanAttempts / attempts

  const recent = sorted.slice(-RECENT_ATTEMPT_WINDOW)
  const recentErrors = recent.filter((item) => item.hadTargetError).length

  if (
    attempts >= MIN_TARGET_ATTEMPTS_FOR_STABLE &&
    cleanRate >= STABLE_CLEAN_RATIO &&
    recentErrors === 0
  ) {
    return 'stable'
  }

  if (
    recentErrors >= 2 ||
    (writingRecurrence >= 2 && attempts >= MIN_TARGET_ATTEMPTS_FOR_PARTIAL && targetErrors / attempts >= 0.5)
  ) {
    return 'needs_attention'
  }

  if (attempts >= MIN_TARGET_ATTEMPTS_FOR_IMPROVING) {
    const midpoint = Math.floor(sorted.length / 2)
    const prior = sorted.slice(0, midpoint)
    const latest = sorted.slice(midpoint)
    if (prior.length > 0 && latest.length > 0) {
      const priorClean = prior.filter((item) => !item.hadTargetError).length / prior.length
      const latestClean = latest.filter((item) => !item.hadTargetError).length / latest.length
      if (latestClean - priorClean >= IMPROVING_DELTA) {
        return 'improving'
      }
    }
  }

  return 'practicing'
}

/** Deterministic target-level progression from existing practice events + session records. */
export function computeTargetPracticeProgression(
  pattern: PracticeTargetPattern,
  events: LearningEvent[],
  sessions: PracticeSessionRecord[],
): TargetPracticeProgression {
  const outcomes = buildTargetAttemptOutcomes(pattern, events, sessions)
  const attempts = outcomes.length
  const targetErrorAttempts = outcomes.filter((item) => item.hadTargetError).length
  const cleanAttempts = attempts - targetErrorAttempts
  const writingRecurrence = countWritingRecurrence(pattern, events)
  const state = resolveProgressionState(outcomes, writingRecurrence)
  const lastPracticedAt =
    outcomes.length > 0 ? Math.max(...outcomes.map((item) => item.timestamp)) : null

  return {
    targetPatternId: practiceTargetPatternId(pattern),
    category: pattern.category,
    displayOriginal: pattern.displayOriginal,
    displayCorrected: pattern.displayCorrected,
    state,
    evidenceQuality: resolveEvidenceQuality(attempts),
    practiceAttempts: attempts,
    cleanAttempts,
    targetErrorAttempts,
    cleanRate: attempts > 0 ? cleanAttempts / attempts : null,
    writingRecurrence,
    lastPracticedAt,
  }
}

export function computeAllTargetPracticeProgressions(
  patterns: PracticeTargetPattern[],
  events: LearningEvent[],
  sessions: PracticeSessionRecord[],
): TargetPracticeProgression[] {
  return patterns.map((pattern) => computeTargetPracticeProgression(pattern, events, sessions))
}

export function progressionForTargetId(
  progressions: TargetPracticeProgression[],
  targetPatternId: string,
): TargetPracticeProgression | null {
  return progressions.find((item) => item.targetPatternId === targetPatternId) ?? null
}

/** Deprioritize stable targets; never removes user category authority. */
export function deprioritizeStablePatterns(
  patterns: PracticeTargetPattern[],
  progressions: TargetPracticeProgression[],
): PracticeTargetPattern[] {
  const stable = new Set(
    progressions.filter((item) => item.state === 'stable').map((item) => item.targetPatternId),
  )
  if (stable.size === 0) return patterns
  const filtered = patterns.filter((pattern) => !stable.has(practiceTargetPatternId(pattern)))
  return filtered.length > 0 ? filtered : patterns
}

export function adjustRecommendationPatternForProgression(
  recommendation: { state: string; focus?: LearningEventCategory; pattern?: PracticeTargetPattern },
  progressions: TargetPracticeProgression[],
  recurringTargets: PracticeTargetPattern[],
): { focus?: LearningEventCategory; pattern?: PracticeTargetPattern } {
  if (!recommendation.pattern) {
    return { focus: recommendation.focus, pattern: recommendation.pattern }
  }
  const currentId = practiceTargetPatternId(recommendation.pattern)
  const current = progressionForTargetId(progressions, currentId)
  if (current?.state !== 'stable') {
    return { focus: recommendation.focus, pattern: recommendation.pattern }
  }
  const deprioritized = deprioritizeStablePatterns(recurringTargets, progressions)
  const next = deprioritized.find((pattern) => practiceTargetPatternId(pattern) !== currentId)
  if (next) {
    return { focus: next.category, pattern: next }
  }
  return { focus: recommendation.focus, pattern: undefined }
}

export function parseTargetPatternId(targetPatternId: string): ReturnType<typeof patternFromId> {
  return patternFromId(targetPatternId)
}
