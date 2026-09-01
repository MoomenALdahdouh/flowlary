import type { ExplanationConfidence, ExplanationSource } from './explanation/index.ts'
import type { LearningFocus } from './learning.ts'
import type { LearningEventCategory } from './learningEvents.ts'
import type { DailyBriefAction } from './learningBrief.ts'
import type { UiLocaleCode } from './uiLocales.ts'

export const FULL_REPORT_SCHEMA_VERSION = 1
export const FULL_REPORT_MAX_GENERATIONS_PER_DAY = 1

export type ReportEvidenceQuality = 'no_data' | 'insufficient' | 'partial' | 'ready'

export type ReportExplanationSummary = {
  source: ExplanationSource
  confidence: ExplanationConfidence
  ruleId?: string
  ruleTitle?: string
  summary: string
  why?: string
}

export type ReportRecurringPattern = {
  category: LearningEventCategory
  displayOriginal: string
  displayCorrected: string
  count: number
  targetPatternId: string
  explanation?: ReportExplanationSummary
}

export type ReportStrength = {
  category: LearningFocus
  reason: 'no_recurring_observed' | 'lowest_category_share'
}

export type LearningAnalysisSnapshot = {
  schemaVersion: number
  evidenceVersion: string
  evidenceQuality: ReportEvidenceQuality
  generatedAt: number
  dayKey: string
  periodDays: number
  activity: {
    wordsWritten: number
    writingEventCount: number
    errorCount: number
    writingErrorCount: number
    errorsPer100Words: number | null
    practiceSessionsThisWeek: number
  }
  categoryMetrics: Record<LearningFocus, number>
  categoryPercentWriting: Partial<Record<LearningFocus, number>>
  recurringPatterns: ReportRecurringPattern[]
  trend: {
    label: string
    direction: 'down' | 'up' | 'flat' | null
    percent: number | null
  }
  focusCategory: LearningFocus | null
  userFocusAreas: LearningFocus[]
  systemRecommendedFocus: LearningFocus | null
  prioritizedCategories: LearningFocus[]
  strengths: ReportStrength[]
  areasToImprove: LearningFocus[]
  practicePlan: {
    recommendedAction: DailyBriefAction
    topTargets: ReportRecurringPattern[]
  }
  layoutInputCount: number
  practiceProgressions: import('./practiceProgression.ts').TargetPracticeProgression[]
}

export type FullLearningReportNarrative = {
  overview: string
  strengths: string[]
  focusAreas: string[]
  improvements: string[]
  recommendations: string[]
  nextSteps: string[]
  source: 'deterministic' | 'ai'
}

export type FullLearningReport = {
  state: 'signed_out' | ReportEvidenceQuality
  snapshot: LearningAnalysisSnapshot | null
  narrative: FullLearningReportNarrative | null
  locale: UiLocaleCode
  fromCache: boolean
  generationsUsedToday: number
  limitReached: boolean
  aiNarrationAvailable: boolean
}

export type FullReportQuotaV1 = {
  version: 1
  dayKey: string
  generationsUsed: number
  lastEvidenceVersion: string | null
  cachedReport: Omit<FullLearningReport, 'fromCache' | 'generationsUsedToday' | 'limitReached'> | null
}

export type LearningReportNarrationRequest = {
  locale: UiLocaleCode
  snapshot: LearningAnalysisSnapshot
}

export type LearningReportNarrationResponse = {
  overview: string
  strengths: string[]
  focusAreas: string[]
  improvements: string[]
  recommendations: string[]
  nextSteps: string[]
}

export function createEmptyFullReportQuota(dayKey: string): FullReportQuotaV1 {
  return {
    version: 1,
    dayKey,
    generationsUsed: 0,
    lastEvidenceVersion: null,
    cachedReport: null,
  }
}
