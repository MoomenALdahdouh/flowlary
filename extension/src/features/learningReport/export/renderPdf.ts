import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { ExportableLearningReport, LearningReportExportLabels } from '@flowlary/shared'

type PdfMakeInstance = {
  vfs: Record<string, string>
  fonts: Record<string, Record<string, string>>
  createPdf: (doc: TDocumentDefinitions) => { getBuffer: (cb: (buffer: Uint8Array) => void) => void }
}

let pdfMakeInstance: PdfMakeInstance | null = null
let arabicFontLoaded = false

async function loadPdfMake(): Promise<PdfMakeInstance> {
  if (pdfMakeInstance) return pdfMakeInstance
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
  const pdfMake = (pdfMakeModule as { default?: PdfMakeInstance }).default ?? (pdfMakeModule as PdfMakeInstance)
  const vfs =
    (pdfFontsModule as { default?: Record<string, string> }).default ??
    (pdfFontsModule as { pdfMake?: { vfs: Record<string, string> } }).pdfMake?.vfs ??
    (pdfFontsModule as Record<string, string>)
  pdfMake.vfs = { ...pdfMake.vfs, ...vfs }
  pdfMake.fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
    NotoArabic: {
      normal: 'NotoSansArabic-Regular.ttf',
      bold: 'NotoSansArabic-Regular.ttf',
      italics: 'NotoSansArabic-Regular.ttf',
      bolditalics: 'NotoSansArabic-Regular.ttf',
    },
  }
  pdfMakeInstance = pdfMake
  return pdfMake
}

async function ensureArabicFont(pdfMake: PdfMakeInstance, fontUrl?: string): Promise<void> {
  if (arabicFontLoaded) return
  let buffer: ArrayBuffer
  if (fontUrl) {
    buffer = await fetch(fontUrl).then((r) => r.arrayBuffer())
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../public/fonts/NotoSansArabic-Regular.ttf')
    buffer = readFileSync(root).buffer
  } else {
    throw new Error('arabic_font_unavailable')
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  pdfMake.vfs['NotoSansArabic-Regular.ttf'] = btoa(binary)
  arabicFontLoaded = true
}

function textBlock(text: string, rtl: boolean, font: string): Content {
  return { text, style: rtl ? 'rtlBody' : 'body', font, alignment: rtl ? 'right' : 'left' }
}

function sectionTitle(text: string, rtl: boolean, font: string): Content {
  return { text, style: 'section', font, alignment: rtl ? 'right' : 'left', margin: [0, 12, 0, 6] }
}

export async function renderLearningReportPdf(
  model: ExportableLearningReport,
  labels: LearningReportExportLabels,
  options?: { arabicFontUrl?: string },
): Promise<Uint8Array> {
  const rtl = model.metadata.direction === 'rtl'
  const pdfMake = await loadPdfMake()
  if (rtl) await ensureArabicFont(pdfMake, options?.arabicFontUrl)
  const font = rtl ? 'NotoArabic' : 'Roboto'

  const content: Content[] = [
    { text: labels.title, style: 'title', font, alignment: rtl ? 'right' : 'left' },
    textBlock(labels.period.replace('{days}', String(model.metadata.periodDays)), rtl, font),
  ]

  const qualityNote = labels.evidenceQuality[model.metadata.evidenceQuality]
  if (qualityNote) content.push(textBlock(qualityNote, rtl, font))

  content.push(sectionTitle(labels.overviewTitle, rtl, font), textBlock(model.overview, rtl, font))
  content.push(sectionTitle(labels.activityTitle, rtl, font))
  content.push({
    ul: [
      labels.wordsWritten.replace('{count}', String(model.activity.wordsWritten)),
      labels.events.replace('{count}', String(model.activity.writingEventCount)),
      labels.corrections.replace('{count}', String(model.activity.writingErrorCount)),
      ...(model.activity.errorsPer100Words != null && labels.errorsPer100Words
        ? [labels.errorsPer100Words.replace('{rate}', model.activity.errorsPer100Words.toFixed(2))]
        : []),
      labels.practiceSessions.replace('{count}', String(model.activity.practiceSessionsThisWeek)),
    ],
    font,
    alignment: rtl ? 'right' : 'left',
  })

  if (model.strengths.length > 0) {
    content.push(sectionTitle(labels.strengthsTitle, rtl, font), { ul: model.strengths, font, alignment: rtl ? 'right' : 'left' })
  }

  if (model.focusAreas.length > 0) {
    content.push(sectionTitle(labels.improveTitle, rtl, font), { ul: model.focusAreas, font, alignment: rtl ? 'right' : 'left' })
  }

  if (model.recurringPatterns.length > 0) {
    content.push(
      sectionTitle(labels.patternsTitle, rtl, font),
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', 40],
          body: [
            [labels.patternTableCategory, labels.patternTablePattern, labels.patternTableSeen],
            ...model.recurringPatterns.map((p) => [p.categoryLabel, p.pair, String(p.count)]),
          ],
        },
        font,
        layout: 'lightHorizontalLines',
      },
    )
    for (const pattern of model.recurringPatterns) {
      if (pattern.explanation) content.push(textBlock(`${pattern.pair}: ${pattern.explanation}`, rtl, font))
    }
  }

  if (model.improvements.length > 0) {
    content.push(sectionTitle(labels.improvingTitle, rtl, font), { ul: model.improvements, font, alignment: rtl ? 'right' : 'left' })
  }

  if (model.currentFocus) {
    content.push(sectionTitle(labels.currentFocusTitle, rtl, font), textBlock(model.currentFocus, rtl, font))
  }

  if (model.recommendations.length > 0) {
    content.push(sectionTitle(labels.practicePlanTitle, rtl, font), {
      ol: model.recommendations,
      font,
      alignment: rtl ? 'right' : 'left',
    })
  }

  if (model.nextSteps.length > 0) {
    content.push(sectionTitle(labels.nextStepsTitle, rtl, font), { ul: model.nextSteps, font, alignment: rtl ? 'right' : 'left' })
  }

  const docDefinition: TDocumentDefinitions = {
    content,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
      section: { fontSize: 14, bold: true },
      body: { margin: [0, 0, 0, 6] },
      rtlBody: { margin: [0, 0, 0, 6] },
    },
    pageMargins: [48, 48, 48, 48],
  }

  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).getBuffer((buffer) => resolve(new Uint8Array(buffer)))
    } catch (err) {
      reject(err)
    }
  })
}

/** Test helper — reset cached pdfmake state between tests. */
export function resetPdfExportForTests(): void {
  pdfMakeInstance = null
  arabicFontLoaded = false
}
