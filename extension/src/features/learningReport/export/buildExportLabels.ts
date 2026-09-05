import type { FullLearningReport, LearningFocus } from '@flowlary/shared'
import type { LearningReportExportLabels } from '@flowlary/shared'
import { resolveMessage } from '../../../popup/i18n/resolveMessage.ts'
import type { UiLocale } from '../../../popup/i18n/types.ts'

const FOCUS_CATEGORIES: LearningFocus[] = ['spelling', 'grammar', 'wording']

export function buildLearningReportExportLabels(
  report: FullLearningReport,
  locale: UiLocale,
): LearningReportExportLabels {
  const periodDays = report.snapshot?.periodDays ?? 7
  return {
    title: resolveMessage('learningReport.title', locale),
    period: resolveMessage('learningReport.period', locale, { days: String(periodDays) }),
    overviewTitle: resolveMessage('learningReport.exportOverview', locale),
    activityTitle: resolveMessage('learningReport.activityTitle', locale),
    wordsWritten: resolveMessage('learningReport.wordsWritten', locale, { count: '{count}' }),
    events: resolveMessage('learningReport.events', locale, { count: '{count}' }),
    corrections: resolveMessage('learningReport.corrections', locale, { count: '{count}' }),
    errorsPer100Words: resolveMessage('learningReport.errorsPer100Words', locale, { rate: '{rate}' }),
    practiceSessions: resolveMessage('learningReport.practiceSessions', locale, { count: '{count}' }),
    strengthsTitle: resolveMessage('learningReport.strengthsTitle', locale),
    improveTitle: resolveMessage('learningReport.improveTitle', locale),
    patternsTitle: resolveMessage('learningReport.patternsTitle', locale),
    patternTableCategory: resolveMessage('learningReport.exportPatternCategory', locale),
    patternTablePattern: resolveMessage('learningReport.exportPatternPair', locale),
    patternTableSeen: resolveMessage('learningReport.exportPatternSeen', locale),
    improvingTitle: resolveMessage('learningReport.improvingTitle', locale),
    currentFocusTitle: resolveMessage('learningReport.currentFocusTitle', locale),
    practicePlanTitle: resolveMessage('learningReport.practicePlanTitle', locale),
    nextStepsTitle: resolveMessage('learningReport.nextStepsTitle', locale),
    evidenceQuality: {
      no_data: resolveMessage('learningReport.overview.no_data', locale),
      insufficient: resolveMessage('learningReport.overview.insufficient', locale),
      partial: resolveMessage('learningReport.overview.partial', locale),
      ready: resolveMessage('learningReport.overview.ready', locale),
    },
  }
}

export function buildCategoryLabels(locale: UiLocale): Record<LearningFocus, string> {
  return {
    spelling: resolveMessage('learning.focus.spelling', locale),
    grammar: resolveMessage('learning.focus.grammar', locale),
    wording: resolveMessage('learning.focus.wording', locale),
  }
}

export { FOCUS_CATEGORIES }
