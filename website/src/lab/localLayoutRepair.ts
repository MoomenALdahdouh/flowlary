import type { CorrectionChange, CorrectionResponse } from '@flowlary/shared'
import {
  inferLayoutSpans,
  applyLayoutSpansToText,
} from '@flowlary/layout-repair'

export function repairKeyboardLayoutLocally(text: string): {
  text: string
  changes: CorrectionChange[]
} {
  const spans = inferLayoutSpans(text)
  const { text: next, applied } = applyLayoutSpansToText(text, spans)
  const changes: CorrectionChange[] = applied.map((span) => ({
    type: 'layout',
    original: text.slice(span.range.start, span.range.end),
    corrected: span.replacement,
    start: span.range.start,
    end: span.range.end,
  }))
  return { text: next, changes }
}

export function mergeLayoutAndCorrection(
  originalText: string,
  layout: { text: string; changes: CorrectionChange[] },
  remote: CorrectionResponse | null,
): CorrectionResponse {
  if (!remote || remote.correctedText === layout.text) {
    return {
      originalText,
      correctedText: layout.text,
      changes: layout.changes,
    }
  }
  const remoteChanges: CorrectionChange[] = remote.changes
    .filter((change) => change.type !== 'layout')
    .map((change) => ({
      ...change,
      start: Math.max(0, originalText.indexOf(change.original)),
      end: Math.max(0, originalText.indexOf(change.original)) + change.original.length,
    }))
  return {
    originalText,
    correctedText: remote.correctedText,
    changes: [...layout.changes, ...remoteChanges.filter((change) => change.original && change.start >= 0)],
  }
}
