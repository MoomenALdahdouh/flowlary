import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import type { FullLearningReport, LearningFocus } from '@flowlary/shared'
import {
  extractExportSemanticFingerprint,
  renderLearningReportMarkdown,
  toExportableLearningReport,
  MIN_WORDS_FOR_ERROR_RATE,
  STORAGE_KEYS,
  utcDayKey,
  type LearningReportExportLabels,
} from '@flowlary/shared'
import { buildDeterministicFullReportNarrative } from '../../extension/src/storage/learning/report/buildDeterministicReport.ts'
import { computeLearningAnalysisSnapshot } from '../../extension/src/storage/learning/report/computeLearningAnalysisSnapshot.ts'
import { buildCategoryLabels, buildLearningReportExportLabels } from '../../extension/src/features/learningReport/export/buildExportLabels.ts'
import { renderLearningReportDocx } from '../../extension/src/features/learningReport/export/renderDocx.ts'
import { renderLearningReportPdf, resetPdfExportForTests } from '../../extension/src/features/learningReport/export/renderPdf.ts'
import { exportLearningReport } from '../../extension/src/features/learningReport/export/exportLearningReport.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  activateTestAccount,
  clearTestAccountContext,
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
} from '../helpers/accountIsolation.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import {
  clearFullReportQuotaForTests,
  readFullReportQuotaForTests,
} from '../../extension/src/storage/learning/report/resolveFullLearningReport.ts'
import { activeAccountContext } from '../../extension/src/storage/activeAccountContext.ts'

async function docxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const xml = await zip.file('word/document.xml')?.async('string')
  return xml ?? ''
}

function pdfContainsText(bytes: Uint8Array, needle: string): boolean {
  const raw = new TextDecoder('latin1').decode(bytes)
  return raw.includes(needle)
}

async function seedHistory(): Promise<void> {
  const batches = []
  for (let i = 0; i < 6; i++) {
    batches.push({
      batchId: `w-${i}`,
      sampleText: `Sample ${i}: recieved in context.`,
      sampleWordCount: MIN_WORDS_FOR_ERROR_RATE + 5,
      category: i % 2 === 0 ? 'spelling' : 'grammar',
      original: 'recieved',
      corrected: 'received',
      action: 'accepted' as const,
      source: 'writing' as const,
    })
  }
  await recordLearningEvents(flowlaryStorage, batches)
}

function buildResolvedReport(locale: 'en' | 'ar' | 'tr'): {
  report: FullLearningReport
  labels: LearningReportExportLabels
  categoryLabels: Record<LearningFocus, string>
} {
  const now = Date.UTC(2026, 7, 27, 12, 0, 0)
  const store = { version: 1 as const, events: [], samples: [] }
  const profile = {
    version: 1 as const,
    learningLanguage: 'en' as const,
    focusAreas: ['grammar' as const],
    level: 'intermediate' as const,
    onboardingCompleted: true,
    onboardingStep: null,
    dismissedSetupPrompt: false,
  }
  const snapshot = computeLearningAnalysisSnapshot(store, { version: 1, sessions: [] }, profile, now)
  const narrative = buildDeterministicFullReportNarrative(snapshot, locale)
  const report: FullLearningReport = {
    state: snapshot.evidenceQuality,
    snapshot,
    narrative,
    locale,
    fromCache: false,
    generationsUsedToday: 0,
    limitReached: false,
    aiNarrationAvailable: false,
  }
  const labels = buildLearningReportExportLabels(report, locale)
  const categoryLabels = buildCategoryLabels(locale)
  return { report, labels, categoryLabels }
}

describe('Report Export', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    resetPdfExportForTests()
    await clearTestAccountContext()
    await activateTestAccount(TEST_ACCOUNT_A)
    seedFlowlaryAccountAuth(store)
    await clearFullReportQuotaForTests(flowlaryStorage)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('markdown/docx/pdf contain equivalent semantic content', async () => {
    await seedHistory()
    const resolved = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    const labels = buildLearningReportExportLabels(resolved, resolved.locale as 'en')
    const categoryLabels = buildCategoryLabels(resolved.locale as 'en')
    const model = toExportableLearningReport(resolved, labels, categoryLabels)!
    const fingerprint = extractExportSemanticFingerprint(model)

    const md = renderLearningReportMarkdown(model, labels)
    const docx = await renderLearningReportDocx(model, labels)
    const pdf = await renderLearningReportPdf(model, labels)
    const docxXml = await docxText(docx)

    expect(md.startsWith('#')).toBe(true)
    expect(docx[0]).toBe(0x50)
    expect(docx[1]).toBe(0x4b)
    expect(pdfContainsText(pdf, '%PDF')).toBe(true)

    for (const part of fingerprint.slice(0, 4)) {
      expect(md).toContain(part)
      expect(docxXml).toContain(part.length > 30 ? part.slice(0, 30) : part)
    }
  }, 15000)

  it('docx and pdf include Arabic text for ar locale', async () => {
    const { report, labels, categoryLabels } = buildResolvedReport('ar')
    const model = toExportableLearningReport(report, labels, categoryLabels)!
    const docx = await renderLearningReportDocx(model, labels)
    const pdf = await renderLearningReportPdf(model, labels)
    const docxXml = await docxText(docx)

    expect(docxXml).toMatch(/[\u0600-\u06FF]/)
    expect(docxXml).toContain('تقرير')
    expect(pdf.byteLength).toBeGreaterThan(500)
    expect(pdfContainsText(pdf, '%PDF')).toBe(true)
  }, 15000)

  it('export does not increment full report quota', async () => {
    await seedHistory()
    const dayKey = utcDayKey()
    const before = await readFullReportQuotaForTests(flowlaryStorage, dayKey)
    const report = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    const labels = buildLearningReportExportLabels(report, report.locale as 'en')
    const categoryLabels = buildCategoryLabels(report.locale as 'en')
    const model = toExportableLearningReport(report, labels, categoryLabels)!
    await renderLearningReportPdf(model, labels)
    await renderLearningReportDocx(model, labels)
    renderLearningReportMarkdown(model, labels)

    const afterReport = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    const afterQuota = await readFullReportQuotaForTests(flowlaryStorage, dayKey)

    expect(afterQuota.generationsUsed).toBe(before.generationsUsed + 1)
    expect(afterReport.fromCache).toBe(true)
  })

  it('blocks export when account context changed', async () => {
    await seedHistory()
    const report = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    const guard = activeAccountContext.snapshot()
    await activateTestAccount(TEST_ACCOUNT_B)
    store.local[STORAGE_KEYS.authAccountId] = { value: TEST_ACCOUNT_B, _v: 1 }

    const result = await exportLearningReport(report, 'md', guard)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('account_changed')
  })

  it('blocks export for signed-out report', async () => {
    const result = await exportLearningReport(
      {
        state: 'signed_out',
        snapshot: null,
        narrative: null,
        locale: 'en',
        fromCache: false,
        generationsUsedToday: 0,
        limitReached: false,
        aiNarrationAvailable: false,
      },
      'md',
      activeAccountContext.snapshot(),
    )
    expect(result.ok).toBe(false)
  })

  it('markdown export excludes internal ids', async () => {
    await seedHistory()
    const report = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    const labels = buildLearningReportExportLabels(report, report.locale as 'en')
    const model = toExportableLearningReport(report, labels, buildCategoryLabels('en'))!
    const md = renderLearningReportMarkdown(model, labels)
    expect(md).not.toMatch(/targetPatternId|evidenceVersion|flowlary\.account/)
  })

  it('does not call Groq during export-only render path', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    await seedHistory()
    const report = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    const labels = buildLearningReportExportLabels(report, 'en')
    const model = toExportableLearningReport(report, labels, buildCategoryLabels('en'))!
    renderLearningReportMarkdown(model, labels)
    const groqCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('learning-report-narrate'))
    expect(groqCalls.length).toBe(0)
  }, 15000)
})

describe('Report Export — evidence states', () => {
  it('represents no_data honestly in markdown', () => {
    const { report, labels, categoryLabels } = buildResolvedReport('en')
    if (report.snapshot) report.snapshot.evidenceQuality = 'no_data'
    const model = toExportableLearningReport(report, labels, categoryLabels)!
    const md = renderLearningReportMarkdown(model, labels)
    expect(md).toContain(labels.evidenceQuality.no_data)
    expect(md).not.toMatch(/CEFR|mastery|XP/)
  })
})

describe('Report Export — Turkish fallback', () => {
  it('uses English fallback strings for tr locale labels', () => {
    const { labels } = buildResolvedReport('tr')
    expect(labels.title).toBe('Learning report')
  })
})
