import type { ChangeType, CorrectionChange, CorrectionResponse } from '@flowlary/shared'
import { recordHistory } from '../../storage/history/record.ts'
import { recordCorrectionAccepted } from '../learning/recordCorrectionLearning.ts'
import { extractWritingContext } from './segment.ts'

function inferChangeType(original: string, corrected: string, hint?: ChangeType): ChangeType {
  if (hint) return hint
  const o = original.trim()
  const c = corrected.trim()
  if (!o || !c) return 'grammar'
  if (/^[A-Za-z]+$/.test(o) && /^[A-Za-z]+$/.test(c)) {
    const maxLen = Math.max(o.length, c.length)
    const minLen = Math.min(o.length, c.length)
    if (maxLen <= 12 && minLen >= maxLen - 3) return 'spelling'
    return 'wording'
  }
  if (/^[^\sA-Za-z0-9]+$/.test(c) || /^[^\sA-Za-z0-9]+$/.test(o)) return 'grammar'
  if (o.toLowerCase() === c.toLowerCase()) return 'grammar'
  return 'grammar'
}

function reviewKindToChangeType(kind?: string): ChangeType | undefined {
  if (kind === 'spelling') return 'spelling'
  if (kind === 'grammar' || kind === 'punctuation') return 'grammar'
  if (kind === 'layout_suspect') return 'layout'
  return undefined
}

export function buildSpanCorrectionResponse(options: {
  fullTextBefore: string
  range: { start: number; end: number }
  replacement: string
  changeType?: ChangeType
  reviewKind?: string
}): { segment: string; correctedSegment: string; response: CorrectionResponse } | null {
  const { fullTextBefore, range, replacement } = options
  const segment = extractWritingContext(fullTextBefore)
  if (!segment.trim()) return null

  const segStart = fullTextBefore.length - segment.length
  const originalSpan = fullTextBefore.slice(range.start, range.end)
  const changeType =
    options.changeType
    ?? reviewKindToChangeType(options.reviewKind)
    ?? inferChangeType(originalSpan, replacement)

  if (range.end <= segStart || range.start >= fullTextBefore.length) {
    const response: CorrectionResponse = {
      originalText: originalSpan,
      correctedText: replacement,
      changes: [
        {
          type: changeType,
          original: originalSpan,
          corrected: replacement,
          start: 0,
          end: originalSpan.length,
        },
      ],
    }
    return { segment: originalSpan, correctedSegment: replacement, response }
  }

  const relStart = Math.max(0, range.start - segStart)
  const relEnd = Math.min(segment.length, range.end - segStart)
  const spanOriginal = segment.slice(relStart, relEnd)
  const correctedSegment = segment.slice(0, relStart) + replacement + segment.slice(relEnd)
  const change: CorrectionChange = {
    type: changeType,
    original: spanOriginal,
    corrected: replacement,
    start: relStart,
    end: relEnd,
  }
  return {
    segment,
    correctedSegment,
    response: {
      originalText: segment,
      correctedText: correctedSegment,
      changes: [change],
    },
  }
}

export function recordSpanCorrectionOutcome(options: {
  element: Element
  fullTextBefore: string
  range: { start: number; end: number }
  replacement: string
  batchId?: string
  changeType?: ChangeType
  reviewKind?: string
  replacementSource?: 'instant_spell' | 'contextual_spell' | 'review' | 'enforce'
}): CorrectionResponse | null {
  const built = buildSpanCorrectionResponse(options)
  if (!built) return null

  const batchId =
    options.batchId
    ?? `span-${options.replacementSource ?? 'enforce'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  recordCorrectionAccepted(batchId, built.segment, built.response)
  void recordHistory({
    operation: 'CORRECT',
    element: options.element,
    sourceText: built.segment,
    resultText: built.correctedSegment,
    mode: 'automatic',
  })

  return built.response
}

export function recordInstantSpellOutcome(options: {
  element: Element
  fullTextBefore: string
  fullTextAfter: string
}): void {
  const segmentBefore = extractWritingContext(options.fullTextBefore)
  const segmentAfter = extractWritingContext(options.fullTextAfter)
  if (!segmentBefore.trim() || segmentBefore === segmentAfter) return

  const response: CorrectionResponse = {
    originalText: segmentBefore,
    correctedText: segmentAfter,
    changes: [
      {
        type: 'spelling',
        original: segmentBefore,
        corrected: segmentAfter,
        start: 0,
        end: segmentBefore.length,
      },
    ],
  }

  const batchId = `instant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  recordCorrectionAccepted(batchId, segmentBefore, response)
  void recordHistory({
    operation: 'CORRECT',
    element: options.element,
    sourceText: segmentBefore,
    resultText: segmentAfter,
    mode: 'automatic',
  })
}
