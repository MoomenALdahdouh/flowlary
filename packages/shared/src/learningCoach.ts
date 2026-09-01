import type { DailyBriefAction, DailyBriefState } from './learningBrief.ts'
import type { ReportEvidenceQuality } from './learningReport.ts'
import type { LearningFocus } from './learning.ts'
import type { LearningEventCategory } from './learningEvents.ts'
import { WRITING_LEARNING_CATEGORIES } from './learningEvents.ts'
import { hashString } from './cache.ts'
import type { UiLocaleCode } from './uiLocales.ts'

export const COACH_SCHEMA_VERSION = 1
export const COACH_MAX_AI_INTERACTIONS_PER_DAY = 5
export const COACH_MAX_QUESTION_LENGTH = 500

export type LearningCoachMode =
  | 'focus'
  | 'recurring_error'
  | 'improving'
  | 'practice_help'
  | 'custom'

export type CoachActionKind =
  | 'practice_pattern'
  | 'practice_focus'
  | 'view_progress'
  | 'open_report'
  | 'keep_writing'

export type LearningCoachAction = {
  kind: CoachActionKind
  targetPatternId?: string
  focus?: LearningFocus
}

export type LearningCoachResponse = {
  summary: string
  observations: string[]
  recommendations: string[]
  explanations: string[]
  actions: LearningCoachAction[]
  evidenceReferences: string[]
  source: 'deterministic' | 'ai'
}

export type LearningCoachExplanationRef = {
  source: string
  confidence: string
  ruleId?: string
  ruleTitle?: string
  summary: string
}

export type LearningCoachContext = {
  schemaVersion: number
  evidenceVersion: string
  locale: UiLocaleCode
  evidenceQuality: ReportEvidenceQuality
  briefState: DailyBriefState | 'signed_out'
  periodDays: number
  wordsWritten: number
  writingEventCount: number
  errorsPer100Words: number | null
  trend: { label: string; direction: string | null; percent: number | null }
  focusCategory: LearningFocus | null
  userFocusAreas: LearningFocus[]
  prioritizedCategories: LearningFocus[]
  recurringPatterns: Array<{
    category: LearningEventCategory
    original: string
    corrected: string
    count: number
    targetPatternId: string
    explanation?: LearningCoachExplanationRef
  }>
  areasToImprove: LearningFocus[]
  practiceAction: DailyBriefAction['kind']
  practiceProgressions: Array<{
    targetPatternId: string
    state: string
    cleanAttempts: number
    practiceAttempts: number
    original: string
    corrected: string
  }>
  targetProgression: {
    targetPatternId: string
    state: string
    displayOriginal: string
    displayCorrected: string
    cleanAttempts: number
    practiceAttempts: number
  } | null
  selfReportedLevel: string | null
  mode: LearningCoachMode
  question: string | null
}

export type LearningCoachResult = {
  state: 'signed_out' | 'ready' | 'empty' | 'insufficient'
  response: LearningCoachResponse
  fromCache: boolean
  aiAvailable: boolean
  aiUsed: boolean
  interactionsUsedToday: number
  interactionsRemainingToday: number
  limitReached: boolean
}

export type LearningCoachQuotaV1 = {
  version: 1
  dayKey: string
  aiInteractionsUsed: number
  cachedEntries: Array<{
    cacheKey: string
    response: LearningCoachResponse
  }>
}

const CEFR_PATTERN = /\b(A1|A2|B1|B2|C1|C2|CEFR)\b/i
const HTML_PATTERN = /<[^>]+>/
const VALID_FOCUS = new Set<string>(WRITING_LEARNING_CATEGORIES)
const VALID_ACTIONS = new Set<CoachActionKind>([
  'practice_pattern',
  'practice_focus',
  'view_progress',
  'open_report',
  'keep_writing',
])
const VALID_MODES = new Set<LearningCoachMode>([
  'focus',
  'recurring_error',
  'improving',
  'practice_help',
  'custom',
])

export function createEmptyLearningCoachQuota(dayKey: string): LearningCoachQuotaV1 {
  return {
    version: 1,
    dayKey,
    aiInteractionsUsed: 0,
    cachedEntries: [],
  }
}

export function normalizeCoachQuestion(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, COACH_MAX_QUESTION_LENGTH)
}

export function buildCoachCacheKey(
  evidenceVersion: string,
  locale: UiLocaleCode,
  mode: LearningCoachMode,
  question: string | null,
): string {
  const normalizedQuestion = question ? normalizeCoachQuestion(question).toLowerCase() : ''
  return hashString(`${evidenceVersion}:${locale}:${mode}:${normalizedQuestion}:${COACH_SCHEMA_VERSION}`)
}

export function buildGroqCoachPayload(context: LearningCoachContext) {
  return {
    mode: context.mode,
    question: context.question,
    locale: context.locale,
    evidenceQuality: context.evidenceQuality,
    briefState: context.briefState,
    periodDays: context.periodDays,
    wordsWritten: context.wordsWritten,
    writingEventCount: context.writingEventCount,
    errorsPer100Words: context.errorsPer100Words,
    trend: context.trend,
    focus: context.focusCategory,
    userFocusAreas: context.userFocusAreas,
    prioritizedCategories: context.prioritizedCategories,
    areasToImprove: context.areasToImprove,
    practiceAction: context.practiceAction,
    selfReportedLevel: context.selfReportedLevel,
    recurringPatterns: context.recurringPatterns.map((pattern) => ({
      category: pattern.category,
      original: pattern.original,
      corrected: pattern.corrected,
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
    practiceProgressions: context.practiceProgressions,
    targetProgression: context.targetProgression,
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function containsForbiddenClaims(text: string): boolean {
  if (CEFR_PATTERN.test(text)) return true
  if (HTML_PATTERN.test(text)) return true
  if (/\bmaster(y|ed|ing)\b/i.test(text)) return true
  if (/\bstruggle because\b/i.test(text)) return true
  if (/\bfluency\b/i.test(text)) return true
  return false
}

function textUsesUnsupportedCategory(text: string, allowed: Set<string>): boolean {
  const lower = text.toLowerCase()
  for (const cat of WRITING_LEARNING_CATEGORIES) {
    if (lower.includes(cat) && !allowed.has(cat)) return true
  }
  if (/\blayout\b/i.test(lower) || /\btranslation\b/i.test(lower)) return true
  return false
}

function unknownPairMentioned(text: string, knownPairs: Set<string>): boolean {
  const insteadOf = text.match(/"([^"]+)"\s+instead of\s+"([^"]+)"/i)
  if (insteadOf) {
    const key = `${insteadOf[1]!.toLowerCase()}→${insteadOf[2]!.toLowerCase()}`
    if (!knownPairs.has(key)) return true
  }
  const arrow = text.match(/([^\s→]{2,})\s*→\s*([^\s→.]{2,})/)
  if (arrow) {
    const key = `${arrow[1]!.toLowerCase()}→${arrow[2]!.toLowerCase()}`
    if (!knownPairs.has(key)) return true
  }
  return false
}

function knownPatternKeys(context: LearningCoachContext): Set<string> {
  return new Set(
    context.recurringPatterns.map(
      (pattern) => `${pattern.original.toLowerCase()}→${pattern.corrected.toLowerCase()}`,
    ),
  )
}

function knownRuleIds(context: LearningCoachContext): Set<string> {
  const ids = new Set<string>()
  for (const pattern of context.recurringPatterns) {
    if (pattern.explanation?.ruleId) ids.add(pattern.explanation.ruleId)
  }
  return ids
}

function knownTargetIds(context: LearningCoachContext): Set<string> {
  return new Set(context.recurringPatterns.map((pattern) => pattern.targetPatternId))
}

function validateActions(raw: unknown, context: LearningCoachContext): LearningCoachAction[] | null {
  if (!Array.isArray(raw)) return null
  const actions: LearningCoachAction[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const obj = item as Record<string, unknown>
    const kind = obj.kind
    if (typeof kind !== 'string' || !VALID_ACTIONS.has(kind as CoachActionKind)) return null
    const action: LearningCoachAction = { kind: kind as CoachActionKind }
    if (kind === 'practice_pattern') {
      if (typeof obj.targetPatternId !== 'string') return null
      if (!knownTargetIds(context).has(obj.targetPatternId)) return null
      action.targetPatternId = obj.targetPatternId
    }
    if (kind === 'practice_focus') {
      if (typeof obj.focus !== 'string' || !VALID_FOCUS.has(obj.focus)) return null
      if (!context.prioritizedCategories.includes(obj.focus as LearningFocus)) {
        if (!context.userFocusAreas.includes(obj.focus as LearningFocus)) return null
      }
      action.focus = obj.focus as LearningFocus
    }
    actions.push(action)
  }
  return actions.slice(0, 4)
}

/** Client-authoritative validator: AI coach output must match structured evidence. */
export function validateLearningCoachResponse(
  raw: unknown,
  context: LearningCoachContext,
): LearningCoachResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>

  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  if (!summary || summary.length > 1200) return null

  if (
    !isStringArray(obj.observations) ||
    !isStringArray(obj.recommendations) ||
    !isStringArray(obj.explanations) ||
    !isStringArray(obj.evidenceReferences)
  ) {
    return null
  }

  const actions = validateActions(obj.actions, context)
  if (!actions) return null

  const allText = [
    summary,
    ...obj.observations,
    ...obj.recommendations,
    ...obj.explanations,
    ...obj.evidenceReferences,
  ]

  for (const line of allText) {
    if (containsForbiddenClaims(line)) return null
    if (textUsesUnsupportedCategory(line, VALID_FOCUS)) return null
  }

  const allowedCategories = new Set<string>()
  if (context.focusCategory) allowedCategories.add(context.focusCategory)
  for (const area of context.areasToImprove) allowedCategories.add(area)
  for (const pattern of context.recurringPatterns) allowedCategories.add(pattern.category)
  for (const focus of context.userFocusAreas) allowedCategories.add(focus)

  for (const line of allText) {
    if (textUsesUnsupportedCategory(line, allowedCategories)) return null
  }

  const knownPairs = knownPatternKeys(context)
  for (const line of allText) {
    if (unknownPairMentioned(line, knownPairs)) return null
    for (const pattern of context.recurringPatterns) {
      const mentionsOriginal = line.toLowerCase().includes(pattern.original.toLowerCase())
      const mentionsCorrected = line.toLowerCase().includes(pattern.corrected.toLowerCase())
      if (mentionsOriginal !== mentionsCorrected && (mentionsOriginal || mentionsCorrected)) {
        const key = `${pattern.original.toLowerCase()}→${pattern.corrected.toLowerCase()}`
        if (!knownPairs.has(key)) return null
      }
    }
  }

  for (const line of obj.explanations) {
    for (const ruleId of knownRuleIds(context)) {
      if (line.includes(ruleId)) continue
    }
    if (/rule id/i.test(line) && knownRuleIds(context).size === 0) return null
  }

  if (context.trend.label !== 'improved') {
    for (const line of [...obj.observations, ...obj.recommendations, summary]) {
      if (/improv/i.test(line) && context.trend.percent == null) return null
    }
  }

  if (context.evidenceQuality === 'no_data' || context.evidenceQuality === 'insufficient') {
    if (/strong|weak|difficulty|struggle|master/i.test(summary)) return null
  }

  return {
    summary,
    observations: obj.observations.slice(0, 5),
    recommendations: obj.recommendations.slice(0, 5),
    explanations: obj.explanations.slice(0, 3),
    actions,
    evidenceReferences: obj.evidenceReferences.slice(0, 6),
    source: 'ai',
  }
}

export function isLearningCoachMode(value: unknown): value is LearningCoachMode {
  return typeof value === 'string' && VALID_MODES.has(value as LearningCoachMode)
}
