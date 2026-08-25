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
  options: { requireBoundary?: boolean } = {},
): Segment | null {
  const limit = Math.max(0, Math.min(text.length, caret))
  const before = text.slice(0, limit)
  if (!before.trim()) return null

  let end = limit
  while (end > 0 && /\s/u.test(before[end - 1]!)) end -= 1
  if (end <= 0) return null

  const last = before[end - 1]!
  const complete = SENTENCE_END.test(last) || HARD_BREAK.test(last)
  if (options.requireBoundary !== false && !complete) return null

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
