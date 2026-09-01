import {
  COACH_SCHEMA_VERSION,
  hashString,
  type DailyLearningBriefSnapshot,
  type LearningAnalysisSnapshot,
  type LearningCoachContext,
  type LearningCoachMode,
  type LearningProfile,
  type UiLocaleCode,
} from '@flowlary/shared'

export function buildCoachEvidenceVersion(
  snapshot: LearningAnalysisSnapshot,
  brief: DailyLearningBriefSnapshot,
): string {
  return hashString(
    JSON.stringify({
      report: snapshot.evidenceVersion,
      brief: brief.evidenceVersion,
      mode: 'coach-context',
    }),
  )
}

export function buildLearningCoachContext(input: {
  snapshot: LearningAnalysisSnapshot
  brief: DailyLearningBriefSnapshot
  profile: LearningProfile
  locale: UiLocaleCode
  mode: LearningCoachMode
  question: string | null
}): LearningCoachContext {
  const { snapshot, brief, profile, locale, mode, question } = input

  return {
    schemaVersion: COACH_SCHEMA_VERSION,
    evidenceVersion: buildCoachEvidenceVersion(snapshot, brief),
    locale,
    evidenceQuality: snapshot.evidenceQuality,
    briefState: brief.state,
    periodDays: snapshot.periodDays,
    wordsWritten: snapshot.activity.wordsWritten,
    writingEventCount: snapshot.activity.writingEventCount,
    errorsPer100Words: snapshot.activity.errorsPer100Words,
    trend: snapshot.trend,
    focusCategory: snapshot.focusCategory,
    userFocusAreas: snapshot.userFocusAreas,
    prioritizedCategories: snapshot.prioritizedCategories,
    recurringPatterns: snapshot.recurringPatterns.map((pattern) => ({
      category: pattern.category,
      original: pattern.displayOriginal,
      corrected: pattern.displayCorrected,
      count: pattern.count,
      targetPatternId: pattern.targetPatternId,
      explanation: pattern.explanation
        ? {
            source: pattern.explanation.source,
            confidence: pattern.explanation.confidence,
            ruleId: pattern.explanation.ruleId,
            ruleTitle: pattern.explanation.ruleTitle,
            summary: pattern.explanation.summary,
          }
        : undefined,
    })),
    areasToImprove: snapshot.areasToImprove,
    practiceAction: snapshot.practicePlan.recommendedAction.kind,
    practiceProgressions: snapshot.practiceProgressions.map((item) => ({
      targetPatternId: item.targetPatternId,
      state: item.state,
      cleanAttempts: item.cleanAttempts,
      practiceAttempts: item.practiceAttempts,
      original: item.displayOriginal,
      corrected: item.displayCorrected,
    })),
    targetProgression: brief.targetProgression,
    selfReportedLevel: profile.level ?? null,
    mode,
    question,
  }
}
