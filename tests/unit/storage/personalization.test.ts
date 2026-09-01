import { describe, expect, it } from 'vitest'
import type { LearningEvent } from '@flowlary/shared'
import {
  createDefaultLearningProfile,
  MIN_WORDS_FOR_ERROR_RATE,
  PROGRESS_TREND_PERIOD_MS,
} from '@flowlary/shared'
import { computeLearningPersonalization } from '../../../extension/src/storage/learning/personalization.ts'
import { computePracticeRecommendation } from '../../../extension/src/storage/learning/practice/recommendation.ts'
import { computeProgressMetrics } from '../../../extension/src/storage/learning/progress.ts'
import { normalizeLearningEventStore } from '../../../extension/src/storage/learning/events/index.ts'

function writingEvent(
  patch: Partial<LearningEvent> & Pick<LearningEvent, 'batchId' | 'timestamp'>,
): LearningEvent {
  return {
    id: patch.id ?? patch.batchId,
    version: 1,
    timestamp: patch.timestamp,
    batchId: patch.batchId,
    source: 'writing',
    category: patch.category ?? 'spelling',
    original: patch.original ?? 'recieved',
    corrected: patch.corrected ?? 'received',
    normalizedOriginal: patch.normalizedOriginal ?? (patch.original ?? 'recieved').toLowerCase(),
    normalizedCorrected: patch.normalizedCorrected ?? (patch.corrected ?? 'received').toLowerCase(),
    action: patch.action ?? 'accepted',
    sampleWordCount: patch.sampleWordCount ?? 20,
    sampleHash: patch.sampleHash ?? `hash-${patch.batchId}`,
  }
}

describe('learning personalization', () => {
  const profile = createDefaultLearningProfile()
  const grammarProfile = {
    ...profile,
    focusAreas: ['grammar'] as const,
  }

  it('returns no_data without false focus for empty metrics', () => {
    const store = normalizeLearningEventStore({ events: [], samples: [] })
    const metrics = computeProgressMetrics(store)
    const personalization = computeLearningPersonalization(
      metrics,
      profile,
      [],
      computePracticeRecommendation([]),
    )
    expect(personalization.state).toBe('no_data')
    expect(personalization.systemRecommendedFocus).toBeNull()
    expect(personalization.prioritizedCategories).toEqual([])
  })

  it('returns insufficient without system focus for one isolated error', () => {
    const store = normalizeLearningEventStore({
      events: [writingEvent({ batchId: 'b1', timestamp: Date.now() })],
      samples: [{ hash: 'hash-b1', batchId: 'b1', wordCount: 10, timestamp: Date.now() }],
    })
    const metrics = computeProgressMetrics(store)
    const personalization = computeLearningPersonalization(
      metrics,
      grammarProfile,
      store.events,
      computePracticeRecommendation(store.events, Date.now(), grammarProfile.focusAreas),
    )
    expect(personalization.state).toBe('insufficient')
    expect(personalization.systemRecommendedFocus).toBeNull()
    expect(personalization.insights.some((insight) => insight.id === 'user_focus')).toBe(true)
  })

  it('prioritizes recurring spelling over raw grammar volume', () => {
    const now = Date.now()
    const events = [
      ...Array.from({ length: 4 }, (_, index) =>
        writingEvent({
          batchId: `s${index}`,
          timestamp: now - index * 1000,
          category: 'spelling',
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        writingEvent({
          batchId: `g${index}`,
          timestamp: now - index * 500,
          category: 'grammar',
          original: 'wanted',
          corrected: 'want',
          normalizedOriginal: `wanted-${index}`,
        }),
      ),
    ]
    const store = normalizeLearningEventStore({
      events,
      samples: [{ hash: 'sample', batchId: 's0', wordCount: MIN_WORDS_FOR_ERROR_RATE, timestamp: now }],
    })
    const metrics = computeProgressMetrics(store, { version: 1, sessions: [] }, now)
    const recommendation = computePracticeRecommendation(events, now, grammarProfile.focusAreas)
    const personalization = computeLearningPersonalization(metrics, grammarProfile, events, recommendation, now)
    expect(personalization.state).toBe('ready')
    expect(personalization.systemRecommendedFocus).toBe('spelling')
    expect(personalization.prioritizedCategories[0]).toBe('spelling')
    expect(personalization.userFocusAreas).toEqual(['grammar'])
  })

  it('preserves user focus areas without overwriting profile', () => {
    const now = Date.now()
    const events = Array.from({ length: 3 }, (_, index) =>
      writingEvent({
        batchId: `w${index}`,
        timestamp: now - index,
        category: 'wording',
        original: 'big',
        corrected: 'large',
        normalizedOriginal: `big-${index}`,
      }),
    )
    const store = normalizeLearningEventStore({
      events,
      samples: [{ hash: 'sample', batchId: 'w0', wordCount: MIN_WORDS_FOR_ERROR_RATE, timestamp: now }],
    })
    const metrics = computeProgressMetrics(store, { version: 1, sessions: [] }, now)
    const recommendation = computePracticeRecommendation(events, now, grammarProfile.focusAreas)
    const personalization = computeLearningPersonalization(metrics, grammarProfile, events, recommendation, now)
    expect(personalization.userFocusAreas).toEqual(['grammar'])
    expect(personalization.insights.some((insight) => insight.id === 'user_focus')).toBe(true)
  })

  it('flags layout as input focus without English practice recommendation', () => {
    const now = Date.now()
    const events = [
      ...Array.from({ length: 2 }, (_, index) =>
        writingEvent({
          batchId: `l${index}`,
          timestamp: now - index,
          category: 'layout',
          original: 'lvpfh',
          corrected: 'hello',
          normalizedOriginal: `lvpfh-${index}`,
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        writingEvent({
          batchId: `s${index}`,
          timestamp: now - index,
          category: 'spelling',
        }),
      ),
    ]
    const store = normalizeLearningEventStore({
      events,
      samples: [{ hash: 'sample', batchId: 's0', wordCount: MIN_WORDS_FOR_ERROR_RATE, timestamp: now }],
    })
    const metrics = computeProgressMetrics(store, { version: 1, sessions: [] }, now)
    const recommendation = computePracticeRecommendation(events, now, profile.focusAreas)
    expect(recommendation.focus).not.toBe('layout')
    const personalization = computeLearningPersonalization(metrics, profile, events, recommendation, now)
    expect(personalization.inputFocusCategory).toBe('layout')
    expect(personalization.insights.some((insight) => insight.id === 'input_layout_focus')).toBe(true)
  })

  it('uses WL-2 trend output for trend insights', () => {
    const now = Date.now()
    const week = PROGRESS_TREND_PERIOD_MS
    const previousStart = now - week * 2
    const currentStart = now - week

    const previousEvents = ['p1', 'p2', 'p3', 'p4', 'p5'].map((batchId, index) =>
      writingEvent({ batchId, timestamp: previousStart + index + 1 }),
    )
    const currentEvents = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'].map(
      (batchId, index) =>
        writingEvent({
          batchId,
          timestamp: currentStart + index + 1,
          original: index % 2 === 0 ? 'recieved' : 'wanted',
          corrected: index % 2 === 0 ? 'received' : 'want',
          category: index % 2 === 0 ? 'spelling' : 'grammar',
          normalizedOriginal: index % 2 === 0 ? 'recieved' : `wanted-${index}`,
        }),
    )

    const store = normalizeLearningEventStore({
      events: [...previousEvents, ...currentEvents],
      samples: [
        { hash: 'prev', batchId: 'p1', wordCount: 100, timestamp: previousStart + 1 },
        { hash: 'curr', batchId: 'c1', wordCount: 500, timestamp: currentStart + 1 },
      ],
    })
    const metrics = computeProgressMetrics(store, { version: 1, sessions: [] }, now)
    const recommendation = computePracticeRecommendation(store.events, now, profile.focusAreas)
    const personalization = computeLearningPersonalization(
      metrics,
      profile,
      store.events,
      recommendation,
      now,
    )
    expect(metrics.trend.label).toBe('improved')
    expect(personalization.insights.some((insight) => insight.id === 'trend_improved')).toBe(true)
  })
})
