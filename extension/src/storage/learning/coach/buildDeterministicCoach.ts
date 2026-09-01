import type {
  LearningCoachAction,
  LearningCoachContext,
  LearningCoachMode,
  LearningCoachResponse,
} from '@flowlary/shared'
import { resolveMessage } from '../../../popup/i18n/resolveMessage.ts'
import type { UiLocale } from '../../../popup/i18n/types.ts'

function categoryLabel(locale: UiLocale, category: string): string {
  return resolveMessage(`learning.focus.${category}`, locale)
}

function defaultActions(context: LearningCoachContext): LearningCoachAction[] {
  const actions: LearningCoachAction[] = []
  const action = context.practiceAction
  const top = context.recurringPatterns[0]

  if (action === 'practice_pattern' && top) {
    actions.push({ kind: 'practice_pattern', targetPatternId: top.targetPatternId })
  } else if (action === 'practice_focus' && context.focusCategory) {
    actions.push({ kind: 'practice_focus', focus: context.focusCategory })
  } else if (context.briefState === 'empty' || context.briefState === 'insufficient') {
    actions.push({ kind: 'keep_writing' })
  } else if (context.focusCategory) {
    actions.push({ kind: 'practice_focus', focus: context.focusCategory })
  }

  actions.push({ kind: 'view_progress' })
  if (context.evidenceQuality === 'ready' || context.evidenceQuality === 'partial') {
    actions.push({ kind: 'open_report' })
  }
  return actions.slice(0, 4)
}

export function buildDeterministicCoachResponse(
  context: LearningCoachContext,
  mode: LearningCoachMode,
  locale: UiLocale = 'en',
): LearningCoachResponse {
  const observations: string[] = []
  const recommendations: string[] = []
  const explanations: string[] = []
  const evidenceReferences: string[] = []

  if (context.evidenceQuality === 'no_data' || context.briefState === 'empty') {
    return {
      summary: resolveMessage('learningCoach.emptySummary', locale),
      observations: [resolveMessage('learningCoach.emptyObservation', locale)],
      recommendations: [resolveMessage('learningCoach.emptyRecommendation', locale)],
      explanations: [],
      actions: [{ kind: 'keep_writing' }],
      evidenceReferences: ['evidence:no_data'],
      source: 'deterministic',
    }
  }

  if (context.evidenceQuality === 'insufficient' || context.briefState === 'insufficient') {
    return {
      summary: resolveMessage('learningCoach.insufficientSummary', locale),
      observations: [resolveMessage('learningCoach.insufficientObservation', locale)],
      recommendations: [resolveMessage('learningCoach.insufficientRecommendation', locale)],
      explanations: [],
      actions: [{ kind: 'keep_writing' }, { kind: 'view_progress' }],
      evidenceReferences: ['evidence:insufficient'],
      source: 'deterministic',
    }
  }

  const top = context.recurringPatterns[0]
  if (top) {
    observations.push(
      resolveMessage('learningCoach.obsRecurring', locale, {
        original: top.original,
        corrected: top.corrected,
        count: String(top.count),
      }),
    )
    evidenceReferences.push(`recurring:${top.targetPatternId}:${top.count}`)
    if (top.explanation?.summary) {
      explanations.push(top.explanation.summary)
      if (top.explanation.ruleId) {
        evidenceReferences.push(`rule:${top.explanation.ruleId}`)
      }
    }
  }

  if (context.focusCategory) {
    observations.push(
      resolveMessage('learningCoach.obsFocus', locale, {
        category: categoryLabel(locale, context.focusCategory),
      }),
    )
    evidenceReferences.push(`focus:${context.focusCategory}`)
  }

  if (context.trend.label === 'improved' && context.trend.percent != null) {
    observations.push(
      resolveMessage('learningCoach.obsImproved', locale, {
        percent: String(context.trend.percent),
      }),
    )
    evidenceReferences.push(`trend:improved:${context.trend.percent}`)
  }

  if (context.targetProgression) {
    observations.push(
      resolveMessage('learningCoach.obsProgression', locale, {
        original: context.targetProgression.displayOriginal,
        corrected: context.targetProgression.displayCorrected,
        state: context.targetProgression.state,
      }),
    )
    evidenceReferences.push(`progression:${context.targetProgression.targetPatternId}:${context.targetProgression.state}`)
  }

  let summary = resolveMessage('learningCoach.readySummary', locale)
  if (mode === 'focus' && context.focusCategory) {
    summary = resolveMessage('learningCoach.focusSummary', locale, {
      category: categoryLabel(locale, context.focusCategory),
    })
  } else if (mode === 'recurring_error' && top) {
    summary = resolveMessage('learningCoach.recurringSummary', locale, {
      original: top.original,
      corrected: top.corrected,
      count: String(top.count),
    })
  } else if (mode === 'improving') {
    summary =
      context.trend.label === 'improved' && context.trend.percent != null
        ? resolveMessage('learningCoach.improvingSummary', locale, { percent: String(context.trend.percent) })
        : resolveMessage('learningCoach.improvingInsufficient', locale)
  } else if (mode === 'practice_help') {
    summary = top
      ? resolveMessage('learningCoach.practiceSummary', locale, {
          original: top.original,
          corrected: top.corrected,
        })
      : resolveMessage('learningCoach.practiceCategorySummary', locale, {
          category: context.focusCategory
            ? categoryLabel(locale, context.focusCategory)
            : resolveMessage('learning.focus.grammar', locale),
        })
  } else if (mode === 'custom' && context.question) {
    summary = resolveMessage('learningCoach.customSummary', locale)
  }

  if (top) {
    recommendations.push(
      resolveMessage('learningCoach.recPracticePattern', locale, {
        original: top.original,
        corrected: top.corrected,
      }),
    )
  } else if (context.focusCategory) {
    recommendations.push(
      resolveMessage('learningCoach.recPracticeFocus', locale, {
        category: categoryLabel(locale, context.focusCategory),
      }),
    )
  } else {
    recommendations.push(resolveMessage('learningCoach.recKeepWriting', locale))
  }

  if (context.userFocusAreas.length > 0) {
    recommendations.push(
      resolveMessage('learningCoach.recUserFocus', locale, {
        category: categoryLabel(locale, context.userFocusAreas[0]!),
      }),
    )
  }

  return {
    summary,
    observations: observations.slice(0, 5),
    recommendations: recommendations.slice(0, 4),
    explanations: explanations.slice(0, 3),
    actions: defaultActions(context),
    evidenceReferences: evidenceReferences.slice(0, 6),
    source: 'deterministic',
  }
}
