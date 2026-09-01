import { describe, expect, it } from 'vitest'
import type { LearningEvent } from '@flowlary/shared'
import { computePracticeRecommendation } from '../../../extension/src/storage/learning/practice/recommendation.ts'
import { resolvePracticeFocus } from '../../../extension/src/storage/learning/practice/recommendation.ts'

function writingEvent(
  patch: Partial<LearningEvent> & Pick<LearningEvent, 'original' | 'corrected'>,
): LearningEvent {
  return {
    id: patch.id ?? `e-${Math.random()}`,
    version: 1,
    timestamp: patch.timestamp ?? Date.now(),
    batchId: patch.batchId ?? 'batch-1',
    source: 'writing',
    category: patch.category ?? 'spelling',
    original: patch.original,
    corrected: patch.corrected,
    normalizedOriginal: patch.normalizedOriginal ?? patch.original.toLowerCase(),
    normalizedCorrected: patch.normalizedCorrected ?? patch.corrected.toLowerCase(),
    action: patch.action ?? 'accepted',
    sampleWordCount: patch.sampleWordCount ?? 20,
    sampleHash: patch.sampleHash ?? 'hash',
  }
}

describe('practice recommendation', () => {
  it('returns none when there are no writing events', () => {
    expect(computePracticeRecommendation([])).toEqual({ state: 'none' })
  })

  it('returns emerging with 1–2 writing events', () => {
    const events = [writingEvent({ original: 'recieve', corrected: 'receive' })]
    expect(computePracticeRecommendation(events)).toEqual({ state: 'emerging' })
  })

  it('critical: recurring spelling pattern beats higher grammar volume', () => {
    const now = Date.now()
    const events: LearningEvent[] = [
      ...Array.from({ length: 4 }, (_, index) =>
        writingEvent({
          id: `spell-${index}`,
          category: 'spelling',
          original: 'recieve',
          corrected: 'receive',
          normalizedOriginal: 'recieve',
          timestamp: now - index * 1000,
        }),
      ),
      writingEvent({
        id: 'spell-extra',
        category: 'spelling',
        original: 'definately',
        corrected: 'definitely',
        normalizedOriginal: 'definately',
      }),
      ...Array.from({ length: 3 }, (_, index) =>
        writingEvent({
          id: `grammar-${index}`,
          category: 'grammar',
          original: 'go',
          corrected: 'goes',
          normalizedOriginal: `go-${index}`,
          timestamp: now - index * 500,
        }),
      ),
      writingEvent({
        id: 'wording-1',
        category: 'wording',
        original: 'big',
        corrected: 'large',
        normalizedOriginal: 'big',
      }),
    ]

    const recommendation = computePracticeRecommendation(events, now)
    expect(recommendation.state).toBe('ready')
    expect(recommendation.focus).toBe('spelling')
    expect(recommendation.pattern?.normalizedOriginal).toBe('recieve')
    expect(recommendation.pattern?.count).toBe(4)
  })

  it('ignores practice and translation-like non-writing sources', () => {
    const events: LearningEvent[] = [
      writingEvent({ original: 'recieve', corrected: 'receive' }),
      {
        ...writingEvent({ original: 'go', corrected: 'goes', category: 'grammar' }),
        source: 'practice',
      },
    ]
    expect(computePracticeRecommendation(events)).toEqual({ state: 'emerging' })
  })

  it('user focus areas break ties between equal recurring patterns', () => {
    const now = Date.now()
    const events: LearningEvent[] = [
      ...Array.from({ length: 2 }, (_, index) =>
        writingEvent({
          id: `spell-${index}`,
          batchId: `spell-${index}`,
          category: 'spelling',
          original: 'recieved',
          corrected: 'received',
          normalizedOriginal: 'recieved',
          timestamp: now - index * 100,
        }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        writingEvent({
          id: `grammar-${index}`,
          batchId: `grammar-${index}`,
          category: 'grammar',
          original: 'wanted',
          corrected: 'want',
          normalizedOriginal: 'wanted',
          timestamp: now - index * 100,
        }),
      ),
      writingEvent({
        id: 'wording-1',
        batchId: 'wording-1',
        category: 'wording',
        original: 'big',
        corrected: 'large',
        normalizedOriginal: 'big',
      }),
    ]

    const recommendation = computePracticeRecommendation(events, now, ['grammar'])
    expect(recommendation.state).toBe('ready')
    expect(recommendation.focus).toBe('grammar')
  })

  it('resolvePracticeFocus uses recommendation for recommended choice', () => {
    const recommendation = computePracticeRecommendation([
      writingEvent({ original: 'recieve', corrected: 'receive' }),
      writingEvent({
        id: '2',
        original: 'Recieve',
        corrected: 'Receive',
        normalizedOriginal: 'recieve',
      }),
      writingEvent({
        id: '3',
        original: 'recieve',
        corrected: 'receive',
        normalizedOriginal: 'recieve',
      }),
    ])
    const resolved = resolvePracticeFocus('recommended', recommendation)
    expect(resolved.focus).toBe(recommendation.focus ?? 'grammar')
  })
})
