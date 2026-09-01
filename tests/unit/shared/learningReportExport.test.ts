import { describe, expect, it } from 'vitest'
import type { FullLearningReport, LearningFocus } from '@flowlary/shared'
import {
  assertExportContainsNoInternalIds,
  buildLearningReportExportFilename,
  extractExportSemanticFingerprint,
  renderLearningReportMarkdown,
  toExportableLearningReport,
  type LearningReportExportLabels,
} from '@flowlary/shared'

const labels: LearningReportExportLabels = {
  title: 'Your English Learning Report',
  period: 'Based on your recent 7-day writing history.',
  overviewTitle: 'Overview',
  activityTitle: 'Writing activity',
  wordsWritten: '{count} words written',
  events: '{count} learning events',
  corrections: '{count} writing corrections',
  errorsPer100Words: '{rate} errors per 100 words',
  practiceSessions: '{count} practice sessions this week',
  strengthsTitle: 'Your strengths',
  improveTitle: 'Areas to improve',
  patternsTitle: 'Recurring patterns',
  patternTableCategory: 'Category',
  patternTablePattern: 'Pattern',
  patternTableSeen: 'Seen',
  improvingTitle: 'What is improving',
  currentFocusTitle: 'Your current focus',
  practicePlanTitle: 'Your practice plan',
  nextStepsTitle: 'Next steps',
  evidenceQuality: {
    ready: 'Ready evidence note.',
  },
}

const categoryLabels: Record<LearningFocus, string> = {
  spelling: 'Spelling',
  grammar: 'Grammar',
  wording: 'Wording',
}

function sampleReport(locale: 'en' | 'ar' = 'en'): FullLearningReport {
  const now = Date.UTC(2026, 7, 27, 12, 0, 0)
  return {
    state: 'ready',
    locale,
    fromCache: true,
    generationsUsedToday: 1,
    limitReached: false,
    aiNarrationAvailable: false,
    snapshot: {
      schemaVersion: 1,
      evidenceVersion: 'hidden-evidence-version',
      evidenceQuality: 'ready',
      generatedAt: now,
      dayKey: '2026-08-27',
      periodDays: 7,
      activity: {
        wordsWritten: 120,
        writingEventCount: 6,
        errorCount: 8,
        writingErrorCount: 8,
        errorsPer100Words: 1.5,
        practiceSessionsThisWeek: 2,
      },
      categoryMetrics: { spelling: 2, grammar: 4, wording: 2 },
      categoryPercentWriting: { spelling: 25, grammar: 50, wording: 25 },
      recurringPatterns: [
        {
          category: 'grammar',
          displayOriginal: 'he go',
          displayCorrected: 'he goes',
          count: 3,
          targetPatternId: 'grammar:he-go',
          explanation: { source: 'pair', confidence: 'medium', summary: 'Use goes with he.' },
        },
      ],
      trend: { label: 'improved', direction: 'down', percent: 12 },
      focusCategory: 'grammar',
      userFocusAreas: ['grammar'],
      systemRecommendedFocus: 'grammar',
      prioritizedCategories: ['grammar', 'spelling'],
      strengths: [{ category: 'wording', reason: 'no_recurring_observed' }],
      areasToImprove: ['grammar', 'spelling'],
      practicePlan: { recommendedAction: { kind: 'keep_writing' }, topTargets: [] },
      layoutInputCount: 0,
    },
    narrative: {
      overview: 'Grammar patterns are recurring in your writing.',
      strengths: ['No recurring wording pattern has been observed yet.'],
      focusAreas: ['Grammar appears among your priority areas.'],
      improvements: ['Your overall writing error rate improved about 12%.'],
      recommendations: ['Practice the recurring pattern he go → he goes.'],
      nextSteps: ['Keep writing naturally.'],
      source: 'deterministic',
    },
  }
}

describe('learningReportExport — shared', () => {
  it('builds export filename without account identifiers', () => {
    expect(buildLearningReportExportFilename('2026-08-27', 'pdf')).toBe('flowlary-learning-report-2026-08-27.pdf')
    expect(buildLearningReportExportFilename('2026-08-27', 'md')).toBe('flowlary-learning-report-2026-08-27.md')
  })

  it('strips internal ids from export model', () => {
    const model = toExportableLearningReport(sampleReport(), labels, categoryLabels)
    expect(model).not.toBeNull()
    expect(JSON.stringify(model)).not.toContain('targetPatternId')
    expect(JSON.stringify(model)).not.toContain('evidenceVersion')
    expect(JSON.stringify(model)).not.toContain('ruleId')
  })

  it('renders valid markdown with headings and pattern table', () => {
    const model = toExportableLearningReport(sampleReport(), labels, categoryLabels)!
    const md = renderLearningReportMarkdown(model, labels)
    expect(md.startsWith('# Your English Learning Report')).toBe(true)
    expect(md).toContain('## Writing activity')
    expect(md).toContain('| Grammar | he go → he goes | 3 |')
    expect(md).toContain('120')
    expect(assertExportContainsNoInternalIds(md)).toBe(true)
  })

  it('preserves English examples in markdown', () => {
    const model = toExportableLearningReport(sampleReport('ar'), labels, categoryLabels)!
    const md = renderLearningReportMarkdown(model, labels)
    expect(md).toContain('he go → he goes')
  })

  it('returns null for signed-out report', () => {
    expect(
      toExportableLearningReport(
        { state: 'signed_out', snapshot: null, narrative: null, locale: 'en', fromCache: false, generationsUsedToday: 0, limitReached: false, aiNarrationAvailable: false },
        labels,
        categoryLabels,
      ),
    ).toBeNull()
  })

  it('extracts semantic fingerprint for consistency checks', () => {
    const model = toExportableLearningReport(sampleReport(), labels, categoryLabels)!
    const fingerprint = extractExportSemanticFingerprint(model)
    expect(fingerprint).toContain('Grammar patterns are recurring in your writing.')
    expect(fingerprint).toContain('he go → he goes:3')
    expect(fingerprint).toContain('120')
  })
})
