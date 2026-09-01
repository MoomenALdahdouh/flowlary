import type {
  LearningAnalysisSnapshot,
  LearningReportNarrationResponse,
} from './learningReport.ts'
import { WRITING_LEARNING_CATEGORIES } from './learningEvents.ts'

const CEFR_PATTERN = /\b(A1|A2|B1|B2|C1|C2|CEFR)\b/i
const VALID_FOCUS = new Set<string>(WRITING_LEARNING_CATEGORIES)

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function containsCefr(text: string): boolean {
  return CEFR_PATTERN.test(text)
}

function textUsesUnsupportedCategory(text: string, allowed: Set<string>): boolean {
  const lower = text.toLowerCase()
  for (const cat of WRITING_LEARNING_CATEGORIES) {
    if (lower.includes(cat) && !allowed.has(cat)) return true
  }
  return false
}

function patternMentioned(text: string, original: string, corrected: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes(original.toLowerCase()) && lower.includes(corrected.toLowerCase())
}

function collectPatternPairs(snapshot: LearningAnalysisSnapshot): Set<string> {
  return new Set(
    snapshot.recurringPatterns.map(
      (pattern) => `${pattern.displayOriginal.toLowerCase()}→${pattern.displayCorrected.toLowerCase()}`,
    ),
  )
}

/** Lightweight validator: AI narration must not introduce unsupported facts. */
export function validateLearningReportNarration(
  raw: unknown,
  snapshot: LearningAnalysisSnapshot,
): LearningReportNarrationResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>

  const overview = typeof obj.overview === 'string' ? obj.overview.trim() : ''
  if (!overview) return null

  if (
    !isStringArray(obj.strengths) ||
    !isStringArray(obj.focusAreas) ||
    !isStringArray(obj.improvements) ||
    !isStringArray(obj.recommendations) ||
    !isStringArray(obj.nextSteps)
  ) {
    return null
  }

  const allText = [overview, ...obj.strengths, ...obj.focusAreas, ...obj.improvements, ...obj.recommendations, ...obj.nextSteps]
  for (const line of allText) {
    if (containsCefr(line)) return null
    if (textUsesUnsupportedCategory(line, VALID_FOCUS)) return null
  }

  const allowedCategories = new Set<string>()
  if (snapshot.focusCategory) allowedCategories.add(snapshot.focusCategory)
  for (const area of snapshot.areasToImprove) allowedCategories.add(area)
  for (const strength of snapshot.strengths) allowedCategories.add(strength.category)
  for (const pattern of snapshot.recurringPatterns) allowedCategories.add(pattern.category)

  for (const line of allText) {
    if (textUsesUnsupportedCategory(line, allowedCategories)) return null
  }

  const knownPairs = collectPatternPairs(snapshot)
  for (const line of allText) {
    for (const pattern of snapshot.recurringPatterns) {
      const partialOriginal = line.toLowerCase().includes(pattern.displayOriginal.toLowerCase())
      const partialCorrected = line.toLowerCase().includes(pattern.displayCorrected.toLowerCase())
      if (partialOriginal !== partialCorrected && (partialOriginal || partialCorrected)) {
        const key = `${pattern.displayOriginal.toLowerCase()}→${pattern.displayCorrected.toLowerCase()}`
        if (!knownPairs.has(key) && !patternMentioned(line, pattern.displayOriginal, pattern.displayCorrected)) {
          return null
        }
      }
    }
  }

  if (snapshot.trend.label !== 'improved') {
    for (const line of obj.improvements) {
      if (/improv/i.test(line) && snapshot.trend.percent == null) return null
    }
  }

  if (snapshot.evidenceQuality === 'no_data' || snapshot.evidenceQuality === 'insufficient') {
    if (/strong|weak|difficulty|struggle/i.test(overview)) return null
  }

  return {
    overview,
    strengths: obj.strengths.slice(0, 5),
    focusAreas: obj.focusAreas.slice(0, 5),
    improvements: obj.improvements.slice(0, 5),
    recommendations: obj.recommendations.slice(0, 6),
    nextSteps: obj.nextSteps.slice(0, 6),
  }
}

export function buildGroqReportPayload(snapshot: LearningAnalysisSnapshot) {
  return {
    periodDays: snapshot.periodDays,
    evidenceQuality: snapshot.evidenceQuality,
    wordsWritten: snapshot.activity.wordsWritten,
    writingEventCount: snapshot.activity.writingEventCount,
    errorCount: snapshot.activity.writingErrorCount,
    errorsPer100Words: snapshot.activity.errorsPer100Words,
    categories: snapshot.categoryMetrics,
    recurringPatterns: snapshot.recurringPatterns.map((pattern) => ({
      category: pattern.category,
      original: pattern.displayOriginal,
      corrected: pattern.displayCorrected,
      count: pattern.count,
    })),
    trend: snapshot.trend,
    focus: snapshot.focusCategory,
    prioritizedCategories: snapshot.prioritizedCategories,
    practiceAction: snapshot.practicePlan.recommendedAction.kind,
  }
}
