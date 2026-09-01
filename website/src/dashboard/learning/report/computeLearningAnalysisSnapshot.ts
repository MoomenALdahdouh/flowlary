import {
  FULL_REPORT_SCHEMA_VERSION,
  hashString,
  isLearningFocus,
  practiceTargetPatternId,
  PROGRESS_TREND_PERIOD_MS,
  resolveExplanation,
  utcDayKey,
  WRITING_LEARNING_CATEGORIES,
  type LearningAnalysisSnapshot,
  type LearningEventStoreV1,
  type LearningFocus,
  type LearningProfile,
  type PracticeSessionStoreV1,
  type ReportEvidenceQuality,
  type ReportExplanationSummary,
  type ReportRecurringPattern,
  type ReportStrength,
  computeTargetPracticeProgression,
  computeAllTargetPracticeProgressions,
  type TargetPracticeProgression,
} from '@flowlary/shared'
import {
  computeProgressMetrics,
  computeRecurringPatterns,
  computeTrend,
  type RecurringPattern,
} from '../progress.ts'
import { attachPersonalizationToProgress } from '../personalization.ts'
import { computePracticeRecommendation } from '../practice/recommendation.ts'
import {
  filterWritingPracticeEvents,
  listPracticeRecurringTargets,
  selectPracticeSessionTarget,
} from '../practice/targetSelection.ts'

const WRITING_CATEGORIES = new Set(WRITING_LEARNING_CATEGORIES)
const PERIOD_DAYS = Math.round(PROGRESS_TREND_PERIOD_MS / (24 * 60 * 60 * 1000))

function filterWritingEvents(store: LearningEventStoreV1) {
  return filterWritingPracticeEvents(store.events)
}

function toReportPattern(pattern: RecurringPattern): ReportRecurringPattern {
  const base: ReportRecurringPattern = {
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

  if (!WRITING_CATEGORIES.has(pattern.category as LearningFocus)) {
    return base
  }

  try {
    const explanation = resolveExplanation({
      type: pattern.category,
      original: pattern.displayOriginal,
      corrected: pattern.displayCorrected,
      start: 0,
      end: pattern.displayOriginal.length,
    })
    const summary: ReportExplanationSummary = {
      source: explanation.source,
      confidence: explanation.confidence,
      ruleId: explanation.ruleId,
      ruleTitle: explanation.ruleTitle,
      summary: explanation.summary,
      why: explanation.why,
    }
    return { ...base, explanation: summary }
  } catch {
    return base
  }
}

function resolveEvidenceQuality(
  writingEventCount: number,
  wordsWritten: number,
  progressState: string,
  personalizationState?: string,
): ReportEvidenceQuality {
  if (writingEventCount === 0) return 'no_data'
  if (
    progressState === 'insufficient_words' ||
    personalizationState === 'no_data' ||
    personalizationState === 'insufficient'
  ) {
    return 'insufficient'
  }
  if (wordsWritten < 50 || writingEventCount < 3) return 'partial'
  return 'ready'
}

function buildStrengths(
  categoryMetrics: Record<LearningFocus, number>,
  recurringPatterns: ReportRecurringPattern[],
  categoryPercentWriting: Partial<Record<LearningFocus, number>>,
): ReportStrength[] {
  const recurringCategories = new Set(
    recurringPatterns.map((pattern) => pattern.category).filter(isLearningFocus),
  )
  const strengths: ReportStrength[] = []

  for (const focus of WRITING_LEARNING_CATEGORIES) {
    if (!recurringCategories.has(focus) && (categoryMetrics[focus] ?? 0) <= 1) {
      strengths.push({ category: focus, reason: 'no_recurring_observed' })
    }
  }

  const sorted = [...WRITING_LEARNING_CATEGORIES].sort(
    (a, b) => (categoryPercentWriting[a] ?? 100) - (categoryPercentWriting[b] ?? 100),
  )
  const lowest = sorted[0]
  if (lowest && (categoryPercentWriting[lowest] ?? 0) < 20 && !strengths.some((s) => s.category === lowest)) {
    strengths.push({ category: lowest, reason: 'lowest_category_share' })
  }

  return strengths.slice(0, 3)
}

function buildAreasToImprove(prioritized: LearningFocus[]): LearningFocus[] {
  return prioritized.filter(isLearningFocus).slice(0, 3)
}

export function buildFullReportEvidenceVersion(snapshot: Omit<LearningAnalysisSnapshot, 'evidenceVersion' | 'generatedAt' | 'dayKey'>): string {
  return hashString(
    JSON.stringify({
      schemaVersion: snapshot.schemaVersion,
      evidenceQuality: snapshot.evidenceQuality,
      wordsWritten: snapshot.activity.wordsWritten,
      writingEventCount: snapshot.activity.writingEventCount,
      errorCount: snapshot.activity.errorCount,
      trend: snapshot.trend,
      focusCategory: snapshot.focusCategory,
      recurring: snapshot.recurringPatterns.map((p) => `${p.targetPatternId}:${p.count}`),
      areas: snapshot.areasToImprove,
      practice: snapshot.practiceProgressions.map((p) => `${p.targetPatternId}:${p.state}`),
    }),
  )
}

/** Deterministic analysis snapshot from existing learning engine outputs. */
export function computeLearningAnalysisSnapshot(
  store: LearningEventStoreV1,
  sessionStore: PracticeSessionStoreV1,
  profile: LearningProfile,
  now = Date.now(),
): LearningAnalysisSnapshot {
  const writingEvents = filterWritingEvents(store)
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

  const personalization = metrics.personalization
  const evidenceQuality = resolveEvidenceQuality(
    writingEvents.length,
    metrics.wordsWritten,
    metrics.state,
    personalization?.state,
  )

  const writingRecurring = computeRecurringPatterns(writingEvents, 8)
    .filter((pattern) => WRITING_CATEGORIES.has(pattern.category as LearningFocus))
    .map(toReportPattern)

  const categoryMetrics = {
    spelling: metrics.byType.spelling ?? 0,
    grammar: metrics.byType.grammar ?? 0,
    wording: metrics.byType.wording ?? 0,
  } satisfies Record<LearningFocus, number>

  const categoryPercentWriting: Partial<Record<LearningFocus, number>> = {}
  if (metrics.byTypePercentWriting) {
    for (const focus of WRITING_LEARNING_CATEGORIES) {
      categoryPercentWriting[focus] = metrics.byTypePercentWriting[focus]
    }
  }

  const prioritizedCategories = (personalization?.prioritizedCategories ?? []).filter(isLearningFocus)
  const focusCategory =
    personalization?.systemRecommendedFocus && isLearningFocus(personalization.systemRecommendedFocus)
      ? personalization.systemRecommendedFocus
      : prioritizedCategories[0] ?? profile.focusAreas.find(isLearningFocus) ?? null

  const strengths = buildStrengths(categoryMetrics, writingRecurring, categoryPercentWriting)
  const areasToImprove = buildAreasToImprove(prioritizedCategories)

  let recommendedAction = practiceTarget.targeted && practiceTarget.targetPatternId
    ? { kind: 'practice_pattern' as const, targetPatternId: practiceTarget.targetPatternId, category: practiceTarget.focus }
    : focusCategory
      ? { kind: 'practice_focus' as const, focus: focusCategory }
      : { kind: 'keep_writing' as const }

  const practiceProgressions = computeAllTargetPracticeProgressions(
    listPracticeRecurringTargets(store.events, 8),
    store.events,
    sessionStore.sessions,
  )
    .filter((item) => item.practiceAttempts > 0)
    .slice(0, 5)

  const partial: Omit<LearningAnalysisSnapshot, 'evidenceVersion' | 'generatedAt' | 'dayKey'> = {
    schemaVersion: FULL_REPORT_SCHEMA_VERSION,
    evidenceQuality,
    periodDays: PERIOD_DAYS,
    activity: {
      wordsWritten: metrics.wordsWritten,
      writingEventCount: writingEvents.length,
      errorCount: metrics.errorCount,
      writingErrorCount: metrics.writingErrorCount,
      errorsPer100Words: metrics.errorsPer100Words,
      practiceSessionsThisWeek: metrics.practiceSummary.sessionsThisWeek,
    },
    categoryMetrics,
    categoryPercentWriting,
    recurringPatterns: writingRecurring,
    trend: {
      label: writingTrend.label,
      direction: writingTrend.direction,
      percent: writingTrend.percent,
    },
    focusCategory,
    userFocusAreas: [...profile.focusAreas].filter(isLearningFocus),
    systemRecommendedFocus:
      personalization?.systemRecommendedFocus && isLearningFocus(personalization.systemRecommendedFocus)
        ? personalization.systemRecommendedFocus
        : null,
    prioritizedCategories,
    strengths,
    areasToImprove,
    practicePlan: {
      recommendedAction,
      topTargets: writingRecurring.slice(0, 3),
    },
    layoutInputCount: metrics.byType.layout ?? 0,
    practiceProgressions,
  }

  const evidenceVersion = buildFullReportEvidenceVersion(partial)

  return {
    ...partial,
    evidenceVersion,
    generatedAt: now,
    dayKey: utcDayKey(now),
  }
}
