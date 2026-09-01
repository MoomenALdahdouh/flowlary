import type { FullLearningReport, ReportEvidenceQuality } from './learningReport.ts'
import type { LearningFocus } from './learning.ts'
import type { UiLocaleCode } from './uiLocales.ts'
import { uiLocaleDirection } from './uiLocales.ts'

export type LearningReportExportFormat = 'pdf' | 'docx' | 'md'

/** Labels supplied by the UI i18n layer — shared stays free of React/catalog imports. */
export type LearningReportExportLabels = {
  title: string
  period: string
  overviewTitle: string
  activityTitle: string
  wordsWritten: string
  events: string
  corrections: string
  errorsPer100Words: string | null
  practiceSessions: string
  strengthsTitle: string
  improveTitle: string
  patternsTitle: string
  patternTableCategory: string
  patternTablePattern: string
  patternTableSeen: string
  improvingTitle: string
  currentFocusTitle: string
  practicePlanTitle: string
  nextStepsTitle: string
  evidenceQuality: Partial<Record<ReportEvidenceQuality, string>>
}

export type ExportableRecurringPattern = {
  categoryLabel: string
  pair: string
  count: number
  explanation: string | null
}

/** Canonical learner-facing report — no internal IDs. */
export type ExportableLearningReport = {
  metadata: {
    generatedAt: number
    reportDate: string
    periodDays: number
    locale: UiLocaleCode
    direction: 'ltr' | 'rtl'
    evidenceQuality: ReportEvidenceQuality
  }
  overview: string
  activity: {
    wordsWritten: number
    writingEventCount: number
    writingErrorCount: number
    errorsPer100Words: number | null
    practiceSessionsThisWeek: number
  }
  strengths: string[]
  focusAreas: string[]
  recurringPatterns: ExportableRecurringPattern[]
  improvements: string[]
  currentFocus: string | null
  recommendations: string[]
  nextSteps: string[]
}

const INTERNAL_ID_PATTERN =
  /\b(flowlary\.account\.|targetPatternId|evidenceVersion|ruleId|learning\.reportQuota)\b/i

function formatReportDate(generatedAt: number): string {
  return new Date(generatedAt).toISOString().slice(0, 10)
}

function patternPair(original: string, corrected: string): string {
  return `${original} → ${corrected}`
}

export function buildLearningReportExportFilename(reportDate: string, format: LearningReportExportFormat): string {
  return `flowlary-learning-report-${reportDate}.${format === 'md' ? 'md' : format}`
}

export function toExportableLearningReport(
  report: FullLearningReport,
  labels: LearningReportExportLabels,
  categoryLabels: Record<LearningFocus, string>,
): ExportableLearningReport | null {
  if (report.state === 'signed_out' || !report.snapshot || !report.narrative) {
    return null
  }

  const { snapshot, narrative, locale } = report

  return {
    metadata: {
      generatedAt: snapshot.generatedAt,
      reportDate: formatReportDate(snapshot.generatedAt),
      periodDays: snapshot.periodDays,
      locale,
      direction: uiLocaleDirection(locale),
      evidenceQuality: snapshot.evidenceQuality,
    },
    overview: narrative.overview,
    activity: {
      wordsWritten: snapshot.activity.wordsWritten,
      writingEventCount: snapshot.activity.writingEventCount,
      writingErrorCount: snapshot.activity.writingErrorCount,
      errorsPer100Words: snapshot.activity.errorsPer100Words,
      practiceSessionsThisWeek: snapshot.activity.practiceSessionsThisWeek,
    },
    strengths: [...narrative.strengths],
    focusAreas: [...narrative.focusAreas],
    recurringPatterns: snapshot.recurringPatterns.map((pattern) => ({
      categoryLabel: categoryLabels[pattern.category as LearningFocus] ?? pattern.category,
      pair: patternPair(pattern.displayOriginal, pattern.displayCorrected),
      count: pattern.count,
      explanation: pattern.explanation
        ? [pattern.explanation.ruleTitle, pattern.explanation.summary].filter(Boolean).join(': ')
        : null,
    })),
    improvements: [...narrative.improvements],
    currentFocus: snapshot.focusCategory
      ? (categoryLabels[snapshot.focusCategory] ?? snapshot.focusCategory)
      : null,
    recommendations: [...narrative.recommendations],
    nextSteps: [...narrative.nextSteps],
  }
}

function mdEscape(value: string): string {
  return value.replace(/\|/g, '\\|')
}

function bulletLines(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n')
}

/** Deterministic UTF-8 Markdown from canonical export model. */
export function renderLearningReportMarkdown(
  model: ExportableLearningReport,
  labels: LearningReportExportLabels,
): string {
  const lines: string[] = []
  lines.push(`# ${labels.title}`)
  lines.push('')
  lines.push(`*${labels.period}*`)
  lines.push('')
  const qualityNote = labels.evidenceQuality[model.metadata.evidenceQuality]
  if (qualityNote) {
    lines.push(`> ${qualityNote}`)
    lines.push('')
  }
  lines.push(`## ${labels.overviewTitle}`)
  lines.push('')
  lines.push(model.overview)
  lines.push('')
  lines.push(`## ${labels.activityTitle}`)
  lines.push('')
  lines.push(`- ${labels.wordsWritten.replace('{count}', String(model.activity.wordsWritten))}`)
  lines.push(`- ${labels.events.replace('{count}', String(model.activity.writingEventCount))}`)
  lines.push(`- ${labels.corrections.replace('{count}', String(model.activity.writingErrorCount))}`)
  if (model.activity.errorsPer100Words != null && labels.errorsPer100Words) {
    lines.push(
      `- ${labels.errorsPer100Words.replace('{rate}', model.activity.errorsPer100Words.toFixed(2))}`,
    )
  }
  lines.push(
    `- ${labels.practiceSessions.replace('{count}', String(model.activity.practiceSessionsThisWeek))}`,
  )
  lines.push('')

  if (model.strengths.length > 0) {
    lines.push(`## ${labels.strengthsTitle}`)
    lines.push('')
    lines.push(bulletLines(model.strengths))
    lines.push('')
  }

  if (model.focusAreas.length > 0) {
    lines.push(`## ${labels.improveTitle}`)
    lines.push('')
    lines.push(bulletLines(model.focusAreas))
    lines.push('')
  }

  if (model.recurringPatterns.length > 0) {
    lines.push(`## ${labels.patternsTitle}`)
    lines.push('')
    lines.push(
      `| ${labels.patternTableCategory} | ${labels.patternTablePattern} | ${labels.patternTableSeen} |`,
    )
    lines.push('| --- | --- | ---: |')
    for (const pattern of model.recurringPatterns) {
      lines.push(
        `| ${mdEscape(pattern.categoryLabel)} | ${mdEscape(pattern.pair)} | ${pattern.count} |`,
      )
    }
    lines.push('')
    for (const pattern of model.recurringPatterns) {
      if (pattern.explanation) {
        lines.push(`- **${pattern.pair}:** ${pattern.explanation}`)
      }
    }
    if (model.recurringPatterns.some((p) => p.explanation)) lines.push('')
  }

  if (model.improvements.length > 0) {
    lines.push(`## ${labels.improvingTitle}`)
    lines.push('')
    lines.push(bulletLines(model.improvements))
    lines.push('')
  }

  if (model.currentFocus) {
    lines.push(`## ${labels.currentFocusTitle}`)
    lines.push('')
    lines.push(model.currentFocus)
    lines.push('')
  }

  if (model.recommendations.length > 0) {
    lines.push(`## ${labels.practicePlanTitle}`)
    lines.push('')
    model.recommendations.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`)
    })
    lines.push('')
  }

  if (model.nextSteps.length > 0) {
    lines.push(`## ${labels.nextStepsTitle}`)
    lines.push('')
    lines.push(bulletLines(model.nextSteps))
    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

/** Flat semantic fingerprint for cross-format consistency tests. */
export function extractExportSemanticFingerprint(model: ExportableLearningReport): string[] {
  const parts: string[] = [
    model.overview,
    String(model.activity.wordsWritten),
    String(model.activity.writingEventCount),
    String(model.activity.writingErrorCount),
    model.activity.errorsPer100Words?.toFixed(2) ?? '',
    ...model.strengths,
    ...model.focusAreas,
    ...model.recurringPatterns.map((p) => `${p.pair}:${p.count}`),
    ...model.improvements,
    model.currentFocus ?? '',
    ...model.recommendations,
    ...model.nextSteps,
  ]
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function assertExportContainsNoInternalIds(text: string): boolean {
  return !INTERNAL_ID_PATTERN.test(text)
}
