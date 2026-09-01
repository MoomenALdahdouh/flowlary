import type {
  FullLearningReportNarrative,
  LearningAnalysisSnapshot,
  LearningFocus,
} from '@flowlary/shared'
import { WRITING_LEARNING_CATEGORIES } from '@flowlary/shared'
import { resolveMessage } from '../../../popup/i18n/resolveMessage.ts'
import type { UiLocale } from '../../../popup/i18n/types.ts'

function categoryLabel(locale: UiLocale, category: LearningFocus): string {
  return resolveMessage(`learning.focus.${category}`, locale)
}

function formatRate(snapshot: LearningAnalysisSnapshot, locale: UiLocale): string | null {
  const rate = snapshot.activity.errorsPer100Words
  if (rate == null) return null
  return resolveMessage('learningReport.errorsPer100Words', locale, {
    rate: rate.toFixed(2),
  })
}

export function buildDeterministicFullReportNarrative(
  snapshot: LearningAnalysisSnapshot,
  locale: UiLocale = 'en',
): FullLearningReportNarrative {
  const { activity, trend, focusCategory, recurringPatterns, areasToImprove, strengths } = snapshot

  let overview = resolveMessage(`learningReport.overview.${snapshot.evidenceQuality}`, locale)
  if (snapshot.evidenceQuality === 'ready' || snapshot.evidenceQuality === 'partial') {
    const parts: string[] = []
    if (recurringPatterns.length > 0) {
      const top = recurringPatterns[0]!
      parts.push(
        resolveMessage('learningReport.overviewRecurring', locale, {
          original: top.displayOriginal,
          corrected: top.displayCorrected,
          count: String(top.count),
        }),
      )
    }
    if (trend.label === 'improved' && trend.percent != null) {
      parts.push(
        resolveMessage('learningReport.overviewImproved', locale, {
          percent: String(trend.percent),
        }),
      )
    } else if (focusCategory) {
      parts.push(
        resolveMessage('learningReport.overviewFocus', locale, {
          category: categoryLabel(locale, focusCategory),
        }),
      )
    }
    if (parts.length > 0) overview = parts.join(' ')
  }

  const strengthLines = strengths.map((item) => {
    if (item.reason === 'no_recurring_observed') {
      return resolveMessage('learningReport.strengthNoRecurring', locale, {
        category: categoryLabel(locale, item.category),
      })
    }
    return resolveMessage('learningReport.strengthLowShare', locale, {
      category: categoryLabel(locale, item.category),
    })
  })

  const focusLines = areasToImprove.map((category) =>
    resolveMessage('learningReport.focusArea', locale, {
      category: categoryLabel(locale, category),
    }),
  )

  const improvements: string[] = []
  if (trend.label === 'improved' && trend.percent != null) {
    improvements.push(
      resolveMessage('learningReport.improvementTrend', locale, {
        percent: String(trend.percent),
      }),
    )
  } else if (trend.label === 'increased' && trend.percent != null) {
    improvements.push(
      resolveMessage('learningReport.needsWorkTrend', locale, {
        percent: String(trend.percent),
      }),
    )
  }

  const recommendations: string[] = []
  const action = snapshot.practicePlan.recommendedAction
  if (action.kind === 'practice_pattern') {
    const target = snapshot.practicePlan.topTargets.find(
      (pattern) => pattern.targetPatternId === action.targetPatternId,
    )
    if (target) {
      recommendations.push(
        resolveMessage('learningReport.recPracticePattern', locale, {
          original: target.displayOriginal,
          corrected: target.displayCorrected,
        }),
      )
    }
  } else if (action.kind === 'practice_focus' && action.focus) {
    recommendations.push(
      resolveMessage('learningReport.recPracticeFocus', locale, {
        category: categoryLabel(locale, action.focus),
      }),
    )
  } else {
    recommendations.push(resolveMessage('learningReport.recKeepWriting', locale))
  }

  for (const pattern of recurringPatterns.slice(0, 2)) {
    recommendations.push(
      resolveMessage('learningReport.recReviewPattern', locale, {
        original: pattern.displayOriginal,
        corrected: pattern.displayCorrected,
        count: String(pattern.count),
      }),
    )
  }

  for (const progression of snapshot.practiceProgressions.slice(0, 2)) {
    if (progression.evidenceQuality === 'insufficient') continue
    if (progression.state === 'improving') {
      recommendations.push(
        resolveMessage('learningReport.progressionImproving', locale, {
          original: progression.displayOriginal,
          corrected: progression.displayCorrected,
          clean: String(progression.cleanAttempts),
          attempts: String(progression.practiceAttempts),
        }),
      )
    } else if (progression.state === 'stable') {
      recommendations.push(
        resolveMessage('learningReport.progressionStable', locale, {
          original: progression.displayOriginal,
          corrected: progression.displayCorrected,
          clean: String(progression.cleanAttempts),
          attempts: String(progression.practiceAttempts),
        }),
      )
    } else if (progression.state === 'needs_attention') {
      recommendations.push(
        resolveMessage('learningReport.progressionNeedsAttention', locale, {
          original: progression.displayOriginal,
          corrected: progression.displayCorrected,
        }),
      )
    }
  }

  const nextSteps: string[] = []
  if (snapshot.evidenceQuality === 'no_data' || snapshot.evidenceQuality === 'insufficient') {
    nextSteps.push(resolveMessage('learningReport.nextKeepWriting', locale))
  } else {
    if (focusCategory) {
      nextSteps.push(
        resolveMessage('learningReport.nextFocus', locale, {
          category: categoryLabel(locale, focusCategory),
        }),
      )
    }
    nextSteps.push(resolveMessage('learningReport.nextWriteNaturally', locale))
    if (recurringPatterns.length > 0) {
      nextSteps.push(resolveMessage('learningReport.nextReviewPatterns', locale))
    }
  }

  const rateLine = formatRate(snapshot, locale)
  if (rateLine && (snapshot.evidenceQuality === 'ready' || snapshot.evidenceQuality === 'partial')) {
    overview = `${overview} ${rateLine}`.trim()
  }

  if (strengthLines.length === 0 && snapshot.evidenceQuality !== 'no_data') {
    for (const category of WRITING_LEARNING_CATEGORIES) {
      if (!areasToImprove.includes(category)) {
        strengthLines.push(
          resolveMessage('learningReport.strengthNoRecurring', locale, {
            category: categoryLabel(locale, category),
          }),
        )
      }
    }
  }

  return {
    overview,
    strengths: strengthLines.slice(0, 3),
    focusAreas: focusLines.length > 0 ? focusLines : areasToImprove.map((c) => categoryLabel(locale, c)),
    improvements,
    recommendations: recommendations.slice(0, 4),
    nextSteps: nextSteps.slice(0, 4),
    source: 'deterministic',
  }
}
