import {
  DAILY_BRIEF_MAX_GENERATIONS_PER_DAY,
  hashString,
  isLearningFocus,
  practiceTargetPatternId,
  utcDayKey,
  WRITING_LEARNING_CATEGORIES,
  computeTargetPracticeProgression,
  type DailyBriefAction,
  type DailyBriefImprovement,
  type DailyBriefRecurringPattern,
  type DailyBriefState,
  type DailyLearningBriefSnapshot,
  type LearningEventStoreV1,
  type LearningFocus,
  type LearningProfile,
  type PracticeSessionStoreV1,
} from '@flowlary/shared'
import {
  computeProgressMetrics,
  computeTrend,
  type RecurringPattern,
} from '../progress.ts'
import { attachPersonalizationToProgress } from '../personalization.ts'
import { computePracticeRecommendation } from '../practice/recommendation.ts'
import {
  listPracticeRecurringTargets,
  selectPracticeSessionTarget,
} from '../practice/targetSelection.ts'

const WRITING_CATEGORIES = new Set(WRITING_LEARNING_CATEGORIES)

function filterWritingLearningEvents(
  store: LearningEventStoreV1,
): import('@flowlary/shared').LearningEvent[] {
  return store.events.filter(
    (event) =>
      event.source === 'writing' &&
      event.action !== 'rejected' &&
      event.category !== 'layout' &&
      WRITING_CATEGORIES.has(event.category as (typeof WRITING_LEARNING_CATEGORIES)[number]),
  )
}

export function buildDailyBriefEvidenceVersion(input: {
  writingEventCount: number
  wordsWritten: number
  focusCategory: LearningFocus | null
  recurringTargetId: string | null
  recurringCount: number | null
  trendLabel: string
  trendPercent: number | null
  recommendedActionKind: DailyBriefAction['kind']
  targetProgressionState?: string | null
}): string {
  return hashString(
    JSON.stringify({
      writingEventCount: input.writingEventCount,
      wordsWritten: input.wordsWritten,
      focusCategory: input.focusCategory,
      recurringTargetId: input.recurringTargetId,
      recurringCount: input.recurringCount,
      trendLabel: input.trendLabel,
      trendPercent: input.trendPercent,
      recommendedActionKind: input.recommendedActionKind,
      targetProgressionState: input.targetProgressionState ?? null,
    }),
  )
}

function toBriefRecurringPattern(pattern: RecurringPattern): DailyBriefRecurringPattern {
  return {
    category: pattern.category,
    displayOriginal: pattern.displayOriginal,
    displayCorrected: pattern.displayCorrected,
    count: pattern.count,
    targetPatternId: practiceTargetPatternId({
      category: pattern.category,
      normalizedOriginal: pattern.normalizedOriginal,
      displayOriginal: pattern.displayOriginal,
      displayCorrected: pattern.displayCorrected,
      count: pattern.count,
    }),
  }
}

function resolveFocusCategory(
  profile: LearningProfile,
  personalization: ReturnType<typeof attachPersonalizationToProgress>['personalization'],
): LearningFocus | null {
  if (personalization?.systemRecommendedFocus && isLearningFocus(personalization.systemRecommendedFocus)) {
    return personalization.systemRecommendedFocus
  }
  const prioritized = personalization?.prioritizedCategories.find(isLearningFocus)
  if (prioritized) return prioritized
  const userFocus = profile.focusAreas.find(isLearningFocus)
  return userFocus ?? null
}

function resolveRecommendedAction(
  state: DailyBriefState,
  focusCategory: LearningFocus | null,
  practiceTarget: ReturnType<typeof selectPracticeSessionTarget>,
): DailyBriefAction {
  if (state === 'empty' || state === 'insufficient') {
    return { kind: 'keep_writing' }
  }
  if (practiceTarget.targeted && practiceTarget.targetPatternId) {
    return {
      kind: 'practice_pattern',
      targetPatternId: practiceTarget.targetPatternId,
      category: practiceTarget.focus,
    }
  }
  if (focusCategory) {
    return { kind: 'practice_focus', focus: focusCategory }
  }
  return { kind: 'view_progress' }
}

/**
 * Deterministic Daily Learning Brief snapshot from existing learning engine outputs.
 * Does not call AI. Does not scan raw history outside LearningEvent pipeline.
 */
export function computeDailyBriefSnapshot(
  store: LearningEventStoreV1,
  sessionStore: PracticeSessionStoreV1,
  profile: LearningProfile,
  now = Date.now(),
): DailyLearningBriefSnapshot {
  const writingEvents = filterWritingLearningEvents(store)
  const metrics = attachPersonalizationToProgress(
    computeProgressMetrics(store, sessionStore, now),
    profile,
    store.events,
    now,
  )
  const recommendation = computePracticeRecommendation(store.events, now, profile.focusAreas)
  const recurringTargets = listPracticeRecurringTargets(store.events)
  const practiceTarget = selectPracticeSessionTarget('recommended', recommendation, recurringTargets)
  const writingTrend = computeTrend(writingEvents, store.samples, metrics.wordsWritten, now)

  let state: DailyBriefState = 'ready'
  if (writingEvents.length === 0 && metrics.state === 'empty') {
    state = 'empty'
  } else if (
    metrics.state === 'insufficient_words' ||
    metrics.personalization?.state === 'no_data' ||
    metrics.personalization?.state === 'insufficient'
  ) {
    state = 'insufficient'
  }

  const focusCategory = resolveFocusCategory(profile, metrics.personalization)
  const writingRecurring = metrics.recurringPatterns.filter((pattern) =>
    WRITING_CATEGORIES.has(pattern.category as (typeof WRITING_LEARNING_CATEGORIES)[number]),
  )
  const topRecurring =
    writingRecurring.length > 0 && writingRecurring[0]!.count >= 2
      ? toBriefRecurringPattern(writingRecurring[0]!)
      : null

  let improvement: DailyBriefImprovement | null = null
  if (writingTrend.label === 'improved' && writingTrend.percent != null) {
    improvement = { scope: 'overall', direction: 'down', percent: writingTrend.percent }
  } else if (writingTrend.label === 'increased' && writingTrend.percent != null) {
    improvement = { scope: 'overall', direction: 'up', percent: writingTrend.percent }
  }

  const recommendedAction = resolveRecommendedAction(state, focusCategory, practiceTarget)
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const hasRecentWriting = writingEvents.some((event) => event.timestamp > now - weekMs)

  let targetProgression: DailyLearningBriefSnapshot['targetProgression'] = null
  if (topRecurring && writingRecurring[0]) {
    const pattern = writingRecurring[0]!
    const progression = computeTargetPracticeProgression(
      {
        category: pattern.category,
        normalizedOriginal: pattern.normalizedOriginal,
        displayOriginal: pattern.displayOriginal,
        displayCorrected: pattern.displayCorrected,
        count: pattern.count,
      },
      store.events,
      sessionStore.sessions,
    )
    if (
      (progression.state === 'improving' || progression.state === 'stable') &&
      progression.evidenceQuality !== 'insufficient'
    ) {
      targetProgression = {
        targetPatternId: progression.targetPatternId,
        state: progression.state,
        displayOriginal: progression.displayOriginal,
        displayCorrected: progression.displayCorrected,
        cleanAttempts: progression.cleanAttempts,
        practiceAttempts: progression.practiceAttempts,
      }
    }
  }

  const evidenceVersion = buildDailyBriefEvidenceVersion({
    writingEventCount: writingEvents.length,
    wordsWritten: metrics.wordsWritten,
    focusCategory,
    recurringTargetId: topRecurring?.targetPatternId ?? null,
    recurringCount: topRecurring?.count ?? null,
    trendLabel: writingTrend.label,
    trendPercent: writingTrend.percent,
    recommendedActionKind: recommendedAction.kind,
    targetProgressionState: targetProgression?.state ?? null,
  })

  return {
    state,
    evidenceVersion,
    generatedAt: now,
    dayKey: utcDayKey(now),
    focusCategory,
    recurringPattern: topRecurring,
    improvement,
    recommendedAction,
    writingEventCount: writingEvents.length,
    wordsWritten: metrics.wordsWritten,
    practiceSessionsThisWeek: metrics.practiceSummary.sessionsThisWeek,
    hasRecentWriting,
    targetProgression,
  }
}

export { DAILY_BRIEF_MAX_GENERATIONS_PER_DAY, utcDayKey }
