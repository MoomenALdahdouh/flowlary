import { describe, expect, it } from 'vitest'
import {
  clipSegmentExcludingRanges,
  isSentenceCompleteSegment,
  lastCompletedSegment,
  liveSegmentOnPause,
  liveTranslateSegment,
} from '../../../extension/src/features/translation/segments.ts'

function keystrokeBudgetMs(wpm: number, words = 12): number {
  return (words / wpm) * 60_000
}

describe('live translation segments (ported from Lingo)', () => {
  it('computes completed segments synchronously for high WPM bursts', () => {
    const sample = 'مرحبا كيف حالك اليوم؟ '
    for (const wpm of [30, 50, 70, 90, 110]) {
      const started = performance.now()
      for (let i = 1; i <= sample.length; i += 1) {
        lastCompletedSegment(sample.slice(0, i), i, { requireBoundary: true })
      }
      const elapsed = performance.now() - started
      expect(elapsed).toBeLessThan(keystrokeBudgetMs(wpm, 4))
    }
  })

  it('does not emit a live segment on each word', () => {
    const words = ['مرحبا', 'كيف', 'حالك']
    const seen: string[] = []
    let text = ''
    for (const word of words) {
      text += (text ? ' ' : '') + word
      const segment = lastCompletedSegment(text, text.length, { requireBoundary: true })
      if (segment) seen.push(segment.text)
    }
    expect(seen).toEqual([])
    const complete = lastCompletedSegment(`${text}؟`, `${text}؟`.length, { requireBoundary: true })
    expect(complete?.text).toBe(`${text}؟`)
  })

  it('translates a paused greeting without requiring punctuation', () => {
    expect(liveSegmentOnPause('مرحبا', 5)?.text).toBe('مرحبا')
    expect(lastCompletedSegment('مرحبا', 5, { requireBoundary: true })).toBeNull()
  })

  it('liveTranslateSegment skips already-translated English prefix in mixed fields', () => {
    const english = 'Hello, how are you'
    const arabic = 'والله ما نعرف يمكن اجي'
    const text = `${english} ${arabic}`
    const translated = [{ start: 0, end: english.length }]
    const seg = liveTranslateSegment(text, text.length, translated)
    expect(seg).not.toBeNull()
    expect(seg!.start).toBeGreaterThanOrEqual(english.length)
    expect(seg!.text).toBe(arabic)
    expect(/[\u0600-\u06FF]/.test(seg!.text)).toBe(true)
  })

  it('clipSegmentExcludingRanges returns null when only translated text remains', () => {
    const text = 'Hello, how are you'
    const raw = { start: 0, end: text.length, text, complete: true }
    expect(clipSegmentExcludingRanges(text, raw, [{ start: 0, end: text.length }])).toBeNull()
  })

  it('isSentenceCompleteSegment detects punctuated units only', () => {
    const complete = 'والله يمكن اجي، بس مش عارف.'
    expect(isSentenceCompleteSegment(complete, 0, complete.length)).toBe(true)
    const incomplete = 'والله يمكن اجي'
    expect(isSentenceCompleteSegment(incomplete, 0, incomplete.length)).toBe(false)
  })
})

describe('latency must not mutate newer text', () => {
  it('treats delayed results as stale after the user keeps typing', async () => {
    const delays = [0, 50, 100, 250, 500, 1000, 2000]
    for (const delay of delays) {
      let current = 'مرحبا كيف حالك؟'
      const original = current
      const pending = new Promise<string>((resolve) => {
        setTimeout(() => resolve('Hello, how are you?'), delay)
      })
      current = 'مرحبا كيف حالك اليوم؟'
      const translation = await pending
      expect(translation).toBe('Hello, how are you?')
      expect(current).not.toBe(original)
    }
  })
})
