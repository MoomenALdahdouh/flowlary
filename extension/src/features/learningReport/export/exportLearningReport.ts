import type { FullLearningReport, LearningReportExportFormat } from '@flowlary/shared'
import {
  buildLearningReportExportFilename,
  renderLearningReportMarkdown,
  toExportableLearningReport,
} from '@flowlary/shared'
import type { AccountContextSnapshot } from '../../../storage/activeAccountContext.ts'
import { activeAccountContext } from '../../../storage/activeAccountContext.ts'
import { buildCategoryLabels, buildLearningReportExportLabels } from './buildExportLabels.ts'
import { downloadBlob, downloadText } from './downloadBlob.ts'
import { renderLearningReportDocx } from './renderDocx.ts'
import { renderLearningReportPdf } from './renderPdf.ts'
import type { UiLocale } from '../../../popup/i18n/types.ts'

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

export type ExportLearningReportResult =
  | { ok: true }
  | { ok: false; error: 'signed_out' | 'no_report' | 'account_changed' | 'render_failed' }

export async function exportLearningReport(
  report: FullLearningReport,
  format: LearningReportExportFormat,
  accountGuard: AccountContextSnapshot,
): Promise<ExportLearningReportResult> {
  if (!activeAccountContext.matches(accountGuard)) {
    return { ok: false, error: 'account_changed' }
  }
  if (report.state === 'signed_out' || !report.snapshot || !report.narrative) {
    return { ok: false, error: report.state === 'signed_out' ? 'signed_out' : 'no_report' }
  }

  const locale = report.locale as UiLocale
  const labels = buildLearningReportExportLabels(report, locale)
  const categoryLabels = buildCategoryLabels(locale)
  const model = toExportableLearningReport(report, labels, categoryLabels)
  if (!model) return { ok: false, error: 'no_report' }

  const filename = buildLearningReportExportFilename(model.metadata.reportDate, format)

  try {
    if (format === 'md') {
      const markdown = renderLearningReportMarkdown(model, labels)
      downloadText(filename, markdown, 'text/markdown')
      return { ok: true }
    }

    if (format === 'docx') {
      const bytes = await renderLearningReportDocx(model, labels)
      downloadBlob(filename, new Blob([toArrayBuffer(bytes)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
      return { ok: true }
    }

    const fontUrl =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('fonts/NotoSansArabic-Regular.ttf')
        : undefined
    const bytes = await renderLearningReportPdf(model, labels, { arabicFontUrl: fontUrl })
    downloadBlob(filename, new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' }))
    return { ok: true }
  } catch {
    return { ok: false, error: 'render_failed' }
  }
}
