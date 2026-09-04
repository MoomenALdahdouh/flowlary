/** Sentence / pause boundaries for live translation. Never word-by-word. */

const SENTENCE_END = /[.!?…؟。！？]/u
const HARD_BREAK = /\n/

export type Segment = {
  start: number
  end: number
  text: string
  complete: boolean
}

export function lastCompletedSegment(
  text: string,
  caret: number,
  options: { requireBoundary?: boolean; allowPhraseBoundary?: boolean } = {},
): Segment | null {
  const limit = Math.max(0, Math.min(text.length, caret))
  const before = text.slice(0, limit)
  if (!before.trim()) return null

  let end = limit
  while (end > 0 && /\s/u.test(before[end - 1]!)) end -= 1
  if (end <= 0) return null

  const last = before[end - 1]!
  const complete = SENTENCE_END.test(last) || HARD_BREAK.test(last)
  if (options.requireBoundary !== false && !complete) {
    if (!options.allowPhraseBoundary) return null
    // Live translation pause: caret after whitespace → translate pending Arabic since last sentence end.
    if (limit === 0 || !/\s/u.test(text[limit - 1]!)) return null

    let start = 0
    for (let i = end - 1; i >= 0; i -= 1) {
      const char = before[i]!
      if (HARD_BREAK.test(char) || SENTENCE_END.test(char)) {
        start = i + 1
        break
      }
    }
    while (start < end && /\s/u.test(before[start]!)) start += 1
    const segment = before.slice(start, end)
    if (!segment.trim()) return null
    return { start, end, text: segment, complete: false }
  }

  let start = 0
  for (let i = end - 2; i >= 0; i -= 1) {
    const char = before[i]!
    if (HARD_BREAK.test(char) || SENTENCE_END.test(char)) {
      start = i + 1
      break
    }
  }
  while (start < end && /\s/u.test(before[start]!)) start += 1
  const segment = before.slice(start, end)
  if (!segment.trim()) return null
  return { start, end, text: segment, complete }
}

export function currentParagraph(text: string, caret: number): Segment | null {
  if (!text.trim()) return null
  const pos = Math.max(0, Math.min(text.length, caret))
  let start = text.lastIndexOf('\n\n', Math.max(0, pos - 1))
  start = start === -1 ? 0 : start + 2
  let end = text.indexOf('\n\n', pos)
  end = end === -1 ? text.length : end
  const slice = text.slice(start, end)
  if (!slice.trim()) return null
  return { start, end, text: slice, complete: true }
}

export function isLiveBoundaryKey(key: string): boolean {
  return key === 'Enter' || key === '.' || key === '!' || key === '?' || key === '؟'
}

/**
 * After a deliberate pause, translate the current writing unit.
 * Prefer a punctuated sentence; otherwise the current paragraph / field.
 * Never used on each keystroke — only after the live timer.
 */
export function liveSegmentOnPause(text: string, caret: number): Segment | null {
  return (
    lastCompletedSegment(text, caret, { requireBoundary: true }) ??
    currentParagraph(text, caret)
  )
}

/** Skip leading ranges already translated so live mode can continue in the same field. */
export function clipSegmentExcludingRanges(
  text: string,
  segment: Segment,
  excludedRanges: readonly { start: number; end: number }[],
): Segment | null {
  let start = segment.start
  const end = segment.end
  for (const range of excludedRanges) {
    if (range.end <= start) {
      start = Math.max(start, range.end)
      continue
    }
    if (range.start < end && range.end > start && range.start <= start) {
      start = Math.max(start, range.end)
    }
  }
  while (start < end && /\s/u.test(text[start]!)) start += 1
  if (start >= end) return null
  const slice = text.slice(start, end)
  if (!slice.trim()) return null
  return { start, end, text: slice, complete: segment.complete }
}

/**
 * Live translation unit after pause, minus output already tagged translated_en.
 * Returns null when the pending slice has no Arabic left to translate.
 */
export function liveTranslateSegment(
  text: string,
  caret: number,
  excludedRanges: readonly { start: number; end: number }[] = [],
): Segment | null {
  const raw = liveSegmentOnPause(text, caret)
  if (!raw) return null
  const clipped = clipSegmentExcludingRanges(text, raw, excludedRanges)
  if (!clipped || !/[\u0600-\u06FF]/.test(clipped.text)) return null
  return clipped
}

export function isSentenceCompleteSegment(text: string, start: number, end: number): boolean {
  const seg = lastCompletedSegment(text, end, { requireBoundary: true })
  if (seg !== null && seg.start === start && seg.end === end && seg.complete) {
    return true
  }
  const slice = text.slice(start, end).trim()
  return /[.!?…؟]$/u.test(slice)
}
