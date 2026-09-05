import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { ExportableLearningReport, LearningReportExportLabels } from '@flowlary/shared'

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel], rtl: boolean): Paragraph {
  return new Paragraph({
    bidirectional: rtl,
    heading: level,
    children: [new TextRun({ text, rightToLeft: rtl })],
  })
}

function bodyParagraph(text: string, rtl: boolean): Paragraph {
  return new Paragraph({
    bidirectional: rtl,
    alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    children: [new TextRun({ text, rightToLeft: rtl })],
  })
}

function bulletParagraph(text: string, rtl: boolean): Paragraph {
  return new Paragraph({
    bidirectional: rtl,
    alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    children: [new TextRun({ text, rightToLeft: rtl })],
    bullet: { level: 0 },
  })
}

function numberedParagraph(text: string, index: number, rtl: boolean): Paragraph {
  return new Paragraph({
    bidirectional: rtl,
    alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    children: [new TextRun({ text: `${index}. ${text}`, rightToLeft: rtl })],
  })
}

function cell(text: string, rtl: boolean): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        bidirectional: rtl,
        alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text, rightToLeft: rtl })],
      }),
    ],
  })
}

function buildDocxChildren(
  model: ExportableLearningReport,
  labels: LearningReportExportLabels,
  rtl: boolean,
): Array<Paragraph | Table> {
  const nodes: Array<Paragraph | Table> = []

  nodes.push(
    new Paragraph({
      bidirectional: rtl,
      heading: HeadingLevel.TITLE,
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text: labels.title, rightToLeft: rtl, bold: true, size: 32 })],
    }),
  )
  nodes.push(bodyParagraph(labels.period.replace('{days}', String(model.metadata.periodDays)), rtl))
  const qualityNote = labels.evidenceQuality[model.metadata.evidenceQuality]
  if (qualityNote) nodes.push(bodyParagraph(qualityNote, rtl))

  nodes.push(heading(labels.overviewTitle, HeadingLevel.HEADING_1, rtl))
  nodes.push(bodyParagraph(model.overview, rtl))

  nodes.push(heading(labels.activityTitle, HeadingLevel.HEADING_1, rtl))
  nodes.push(bulletParagraph(labels.wordsWritten.replace('{count}', String(model.activity.wordsWritten)), rtl))
  nodes.push(bulletParagraph(labels.events.replace('{count}', String(model.activity.writingEventCount)), rtl))
  nodes.push(bulletParagraph(labels.corrections.replace('{count}', String(model.activity.writingErrorCount)), rtl))
  if (model.activity.errorsPer100Words != null && labels.errorsPer100Words) {
    nodes.push(
      bulletParagraph(
        labels.errorsPer100Words.replace('{rate}', model.activity.errorsPer100Words.toFixed(2)),
        rtl,
      ),
    )
  }
  nodes.push(
    bulletParagraph(
      labels.practiceSessions.replace('{count}', String(model.activity.practiceSessionsThisWeek)),
      rtl,
    ),
  )

  if (model.strengths.length > 0) {
    nodes.push(heading(labels.strengthsTitle, HeadingLevel.HEADING_1, rtl))
    for (const line of model.strengths) nodes.push(bulletParagraph(line, rtl))
  }

  if (model.focusAreas.length > 0) {
    nodes.push(heading(labels.improveTitle, HeadingLevel.HEADING_1, rtl))
    for (const line of model.focusAreas) nodes.push(bulletParagraph(line, rtl))
  }

  if (model.recurringPatterns.length > 0) {
    nodes.push(heading(labels.patternsTitle, HeadingLevel.HEADING_1, rtl))
    nodes.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              cell(labels.patternTableCategory, rtl),
              cell(labels.patternTablePattern, rtl),
              cell(labels.patternTableSeen, rtl),
            ],
          }),
          ...model.recurringPatterns.map(
            (pattern) =>
              new TableRow({
                children: [
                  cell(pattern.categoryLabel, rtl),
                  cell(pattern.pair, rtl),
                  cell(String(pattern.count), rtl),
                ],
              }),
          ),
        ],
      }),
    )
    for (const pattern of model.recurringPatterns) {
      if (pattern.explanation) nodes.push(bodyParagraph(`${pattern.pair}: ${pattern.explanation}`, rtl))
    }
  }

  if (model.improvements.length > 0) {
    nodes.push(heading(labels.improvingTitle, HeadingLevel.HEADING_1, rtl))
    for (const line of model.improvements) nodes.push(bulletParagraph(line, rtl))
  }

  if (model.currentFocus) {
    nodes.push(heading(labels.currentFocusTitle, HeadingLevel.HEADING_1, rtl))
    nodes.push(bodyParagraph(model.currentFocus, rtl))
  }

  if (model.recommendations.length > 0) {
    nodes.push(heading(labels.practicePlanTitle, HeadingLevel.HEADING_1, rtl))
    model.recommendations.forEach((line, index) => {
      nodes.push(numberedParagraph(line, index + 1, rtl))
    })
  }

  if (model.nextSteps.length > 0) {
    nodes.push(heading(labels.nextStepsTitle, HeadingLevel.HEADING_1, rtl))
    for (const line of model.nextSteps) nodes.push(bulletParagraph(line, rtl))
  }

  return nodes
}

export async function renderLearningReportDocx(
  model: ExportableLearningReport,
  labels: LearningReportExportLabels,
): Promise<Uint8Array> {
  const rtl = model.metadata.direction === 'rtl'
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: buildDocxChildren(model, labels, rtl),
      },
    ],
  })
  return Packer.toBuffer(doc)
}
