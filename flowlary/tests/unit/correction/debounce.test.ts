import { describe, expect, it, vi } from 'vitest'
import { CORRECTION_DEFAULTS } from '@flowlary/shared'
import {
  endsWithSentenceBoundary,
  endsWithWordBoundary,
  getDebounceDelay,
  IntelligentDebouncer,
} from '../../../extension/src/features/correction/debounce.ts'

describe('correction debounce', () => {
  it('detects sentence boundaries', () => {
    expect(endsWithSentenceBoundary('Hello.')).toBe(true)
    expect(endsWithSentenceBoundary('Hello world')).toBe(false)
  })

  it('detects word boundaries', () => {
    expect(endsWithWordBoundary('I recive ')).toBe(true)
    expect(endsWithWordBoundary('I recive')).toBe(false)
  })

  it('uses faster delay after a word or sentence', () => {
    expect(getDebounceDelay('Done.')).toBe(CORRECTION_DEFAULTS.SENTENCE_BOUNDARY_DEBOUNCE_MS)
    expect(getDebounceDelay('I recive ')).toBe(CORRECTION_DEFAULTS.WORD_BOUNDARY_DEBOUNCE_MS)
    expect(getDebounceDelay('Still typing')).toBe(CORRECTION_DEFAULTS.DEBOUNCE_MS)
  })

  it('cancels stale scheduled work', async () => {
    vi.useFakeTimers()
    const calls: Array<{ text: string; gen: number }> = []
    const d = new IntelligentDebouncer((text, generation) => {
      calls.push({ text, gen: generation })
    })
    d.schedule('one')
    d.schedule('two')
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toEqual([{ text: 'two', gen: 2 }])
    vi.useRealTimers()
  })
})
