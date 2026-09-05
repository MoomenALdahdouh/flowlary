import { describe, expect, it } from 'vitest'
import {
  MIN_WORDS_FOR_ERROR_RATE,
  normalizeLearningText,
  isValidLearningChange,
  hashWritingSample,
  PROGRESS_TREND_PERIOD_MS,
  type LearningEvent,
} from '@flowlary/shared'
import {
  countUniqueLearningErrors,
  computeProgressMetrics,
  computeRecurringPatterns,
  computeMistakeFeed,
  computeTrend,
  sumUniqueWordsInPeriod,
} from '../../../extension/src/storage/learning/progress.ts'
import { sanitizeLearningEvent, normalizeLearningEventStore } from '../../../extension/src/storage/learning/events/index.ts'

describe('learning event normalization', () => {
  it('normalizes whitespace and casing', () => {
    expect(normalizeLearningText('  Recieved  ')).toBe('recieved')
    expect(normalizeLearningText('He   goes')).toBe('he goes')
  })

  it('keeps their and there distinct', () => {
    expect(normalizeLearningText('their')).not.toBe(normalizeLearningText('there'))
  })

  it('rejects unchanged pairs', () => {
    expect(isValidLearningChange('hello', 'hello')).toBe(false)
    expect(isValidLearningChange('recieve', 'receive')).toBe(true)
  })
})

describe('learning event storage validation', () => {
  it('rejects invalid events', () => {
    expect(sanitizeLearningEvent(null)).toBeNull()
    expect(sanitizeLearningEvent({ original: 'a', corrected: 'a' })).toBeNull()
  })

  it('recovers malformed store safely', () => {
    const store = normalizeLearningEventStore({ events: [{ foo: 'bar' }], samples: 'bad' })
    expect(store.events).toEqual([])
    expect(store.samples).toEqual([])
  })
})

describe('progress metrics', () => {
  const baseEvent = (patch: Partial<LearningEvent>): LearningEvent => ({
    id: patch.id ?? '1',
    version: 1,
    timestamp: patch.timestamp ?? Date.now(),
    batchId: patch.batchId ?? 'batch-1',
    source: 'writing',
    category: patch.category ?? 'spelling',
    original: patch.original ?? 'recieve',
    corrected: patch.corrected ?? 'receive',
    normalizedOriginal: patch.normalizedOriginal ?? 'recieve',
    normalizedCorrected: patch.normalizedCorrected ?? 'receive',
    action: patch.action ?? 'accepted',
    sampleWordCount: patch.sampleWordCount ?? 100,
    sampleHash: patch.sampleHash ?? 'abc',
  })

  it('does not double-count detected then accepted in same batch', () => {
    const events = [
      baseEvent({ id: '1', action: 'detected', batchId: 'b1' }),
      baseEvent({ id: '2', action: 'accepted', batchId: 'b1' }),
    ]
    expect(countUniqueLearningErrors(events)).toBe(1)
  })

  it('computes errors per 100 words', () => {
    const store = normalizeLearningEventStore({
      events: [baseEvent({ id: '1' }), baseEvent({ id: '2', original: 'go', corrected: 'goes', category: 'grammar' })],
      samples: [{ hash: 'abc', batchId: 'batch-1', wordCount: 1000, timestamp: Date.now() }],
    })
    const metrics = computeProgressMetrics(store)
    expect(metrics.state).toBe('ready')
    expect(metrics.errorCount).toBe(2)
    expect(metrics.errorsPer100Words).toBe(0.2)
  })

  it('shows insufficient words state honestly', () => {
    const store = normalizeLearningEventStore({
      events: [baseEvent({ id: '1' })],
      samples: [{ hash: 'abc', batchId: 'batch-1', wordCount: 10, timestamp: Date.now() }],
    })
    const metrics = computeProgressMetrics(store)
    expect(metrics.state).toBe('insufficient_words')
    expect(metrics.errorsPer100Words).toBeNull()
  })

  it('finds recurring patterns with same normalized original', () => {
    const now = Date.now()
    const events = [
      baseEvent({ id: '1', batchId: 'b1', original: 'recieve', timestamp: now }),
      baseEvent({ id: '2', batchId: 'b2', original: 'Recieve', normalizedOriginal: 'recieve', timestamp: now - 1000 }),
    ]
    const patterns = computeRecurringPatterns(events)
    expect(patterns).toHaveLength(1)
    expect(patterns[0]?.count).toBe(2)
  })

  it('does not treat detected+accepted in one batch as recurring', () => {
    const now = Date.now()
    const events = [
      baseEvent({ id: '1', batchId: 'same', action: 'detected', original: 'recieve', timestamp: now }),
      baseEvent({ id: '2', batchId: 'same', action: 'accepted', original: 'recieve', timestamp: now + 1 }),
    ]
    expect(computeRecurringPatterns(events)).toHaveLength(0)
  })

  it('dedupes writing samples by hash', () => {
    const hash = hashWritingSample('I recieved your email.')
    const store = normalizeLearningEventStore({
      events: [
        baseEvent({ id: '1', sampleHash: hash, sampleWordCount: 5 }),
        baseEvent({ id: '2', sampleHash: hash, sampleWordCount: 5, original: 'go', corrected: 'goes', category: 'grammar' }),
      ],
      samples: [
        { hash, batchId: 'b1', wordCount: 5, timestamp: Date.now() },
        { hash, batchId: 'b2', wordCount: 5, timestamp: Date.now() },
      ],
    })
    const metrics = computeProgressMetrics(store)
    expect(metrics.wordsWritten).toBe(5)
  })

  it('excludes rejected errors from error count', () => {
    const events = [
      baseEvent({ id: '1', action: 'accepted', batchId: 'b1' }),
      baseEvent({ id: '2', action: 'rejected', batchId: 'b2', original: 'teh', corrected: 'the' }),
    ]
    expect(countUniqueLearningErrors(events)).toBe(1)
  })

  it('shows empty state with zero words and zero errors', () => {
    const store = normalizeLearningEventStore({ events: [], samples: [] })
    const metrics = computeProgressMetrics(store)
    expect(metrics.state).toBe('empty')
    expect(metrics.errorsPer100Words).toBeNull()
    expect(metrics.trend.label).toBe('not_enough_data')
  })

  it('shows zero errors per 100 words when ready with no errors', () => {
    const store = normalizeLearningEventStore({
      events: [],
      samples: [{ hash: 'abc', batchId: 'b1', wordCount: MIN_WORDS_FOR_ERROR_RATE, timestamp: Date.now() }],
    })
    const metrics = computeProgressMetrics(store)
    expect(metrics.state).toBe('ready')
    expect(metrics.errorCount).toBe(0)
    expect(metrics.errorsPer100Words).toBe(0)
  })

  it('uses writing-only denominator for writing category percentages', () => {
    const store = normalizeLearningEventStore({
      events: [
        baseEvent({ id: '1', category: 'spelling' }),
        baseEvent({ id: '2', category: 'grammar', original: 'go', corrected: 'goes' }),
        baseEvent({ id: '3', category: 'layout', original: 'abc', corrected: 'xyz' }),
      ],
      samples: [{ hash: 'abc', batchId: 'b1', wordCount: 100, timestamp: Date.now() }],
    })
    const metrics = computeProgressMetrics(store)
    expect(metrics.byTypePercentWriting).toEqual({ spelling: 50, grammar: 50, wording: 0 })
    expect(metrics.byTypePercentInput).toEqual({ layout: 100 })
  })

  it('computes rate-based trend when volume changes but quality improves', () => {
    const now = Date.now()
    const week = PROGRESS_TREND_PERIOD_MS
    const previousStart = now - week * 2
    const currentStart = now - week

    const previousEvents = [
      baseEvent({ id: 'p1', batchId: 'p1', timestamp: previousStart + 1 }),
      baseEvent({ id: 'p2', batchId: 'p2', timestamp: previousStart + 2 }),
      baseEvent({ id: 'p3', batchId: 'p3', timestamp: previousStart + 3 }),
      baseEvent({ id: 'p4', batchId: 'p4', timestamp: previousStart + 4 }),
      baseEvent({ id: 'p5', batchId: 'p5', timestamp: previousStart + 5 }),
    ]
    const currentEvents = [
      baseEvent({ id: 'c1', batchId: 'c1', timestamp: currentStart + 1 }),
      baseEvent({ id: 'c2', batchId: 'c2', timestamp: currentStart + 2, original: 'go', corrected: 'goes', category: 'grammar' }),
      baseEvent({ id: 'c3', batchId: 'c3', timestamp: currentStart + 3, original: 'teh', corrected: 'the', category: 'spelling' }),
      baseEvent({ id: 'c4', batchId: 'c4', timestamp: currentStart + 4, original: 'alot', corrected: 'a lot', category: 'wording' }),
      baseEvent({ id: 'c5', batchId: 'c5', timestamp: currentStart + 5, original: 'dont', corrected: "don't", category: 'grammar' }),
      baseEvent({ id: 'c6', batchId: 'c6', timestamp: currentStart + 6, original: 'wich', corrected: 'which', category: 'spelling' }),
      baseEvent({ id: 'c7', batchId: 'c7', timestamp: currentStart + 7, original: 'realyl', corrected: 'really', category: 'spelling' }),
      baseEvent({ id: 'c8', batchId: 'c8', timestamp: currentStart + 8, original: 'becuase', corrected: 'because', category: 'spelling' }),
      baseEvent({ id: 'c9', batchId: 'c9', timestamp: currentStart + 9, original: 'occured', corrected: 'occurred', category: 'spelling' }),
      baseEvent({ id: 'c10', batchId: 'c10', timestamp: currentStart + 10, original: 'seperate', corrected: 'separate', category: 'spelling' }),
    ]

    const samples = [
      { hash: 'prev', batchId: 'p1', wordCount: 100, timestamp: previousStart + 1 },
      { hash: 'curr', batchId: 'c1', wordCount: 500, timestamp: currentStart + 1 },
    ]

    const trend = computeTrend([...previousEvents, ...currentEvents], samples, 600, now)
    expect(trend.direction).toBe('down')
    expect(trend.label).toBe('improved')
  })

  it('returns insufficient trend when previous period has zero words', () => {
    const now = Date.now()
    const week = PROGRESS_TREND_PERIOD_MS
    const samples = [{ hash: 'curr', batchId: 'c1', wordCount: 100, timestamp: now - 1000 }]
    const events = [
      baseEvent({ id: '1', batchId: 'c1', timestamp: now - 1000 }),
      baseEvent({ id: '2', batchId: 'c2', timestamp: now - 900, original: 'go', corrected: 'goes', category: 'grammar' }),
      baseEvent({ id: '3', batchId: 'c3', timestamp: now - 800, original: 'teh', corrected: 'the', category: 'spelling' }),
    ]
    const trend = computeTrend(events, samples, 100, now)
    expect(trend.label).toBe('not_enough_data')
  })

  it('sums words only inside requested period', () => {
    const now = Date.now()
    const week = PROGRESS_TREND_PERIOD_MS
    const samples = [
      { hash: 'old', batchId: 'o1', wordCount: 40, timestamp: now - week * 2 },
      { hash: 'new', batchId: 'n1', wordCount: 60, timestamp: now - 1000 },
    ]
    expect(sumUniqueWordsInPeriod(samples, now - week, now)).toBe(60)
    expect(sumUniqueWordsInPeriod(samples, now - week * 2, now - week)).toBe(40)
  })

  it('builds daily chart series from unique errors without changing error counts', () => {
    const now = Date.now()
    const store = normalizeLearningEventStore({
      events: [
        baseEvent({ id: '1', batchId: 'b1', timestamp: now, category: 'spelling' }),
        baseEvent({
          id: '2',
          batchId: 'b1',
          timestamp: now,
          action: 'detected',
          category: 'spelling',
        }),
        baseEvent({
          id: '3',
          batchId: 'b2',
          timestamp: now,
          original: 'go',
          corrected: 'goes',
          category: 'grammar',
        }),
      ],
      samples: [{ hash: 'abc', batchId: 'b1', wordCount: 100, timestamp: now }],
    })
    const metrics = computeProgressMetrics(store, { version: 1, sessions: [] }, now)
    expect(metrics.errorCount).toBe(2)
    expect(metrics.charts.daily).toHaveLength(30)
    const today = metrics.charts.daily[29]
    expect(today?.errors).toBe(2)
    expect(today?.spelling).toBe(1)
    expect(today?.grammar).toBe(1)
    expect(metrics.charts.skills.find((skill) => skill.type === 'spelling')?.count).toBe(1)
  })

  it('groups repeating mistakes with applied weight', () => {
    const now = Date.now()
    const events = [
      baseEvent({
        id: '1',
        batchId: 'b1',
        original: 'hwo',
        corrected: 'how',
        normalizedOriginal: 'hwo',
        normalizedCorrected: 'how',
        timestamp: now,
      }),
      baseEvent({
        id: '2',
        batchId: 'b2',
        original: 'hwo',
        corrected: 'how',
        normalizedOriginal: 'hwo',
        normalizedCorrected: 'how',
        timestamp: now - 1000,
        action: 'detected',
      }),
      baseEvent({
        id: '3',
        batchId: 'b3',
        original: 'add',
        corrected: 'to add',
        category: 'grammar',
        normalizedOriginal: 'add',
        normalizedCorrected: 'to add',
        timestamp: now - 2000,
        action: 'detected',
      }),
    ]
    const items = computeMistakeFeed(events, now)
    expect(items).toHaveLength(2)
    const spelling = items.find((item) => item.normalizedOriginal === 'hwo')
    expect(spelling?.count).toBe(2)
    expect(spelling?.appliedCount).toBe(1)
    expect(spelling?.historyWord).toBe('hwo')
    expect(spelling?.relativeLabel).toBe('today')
  })

  it('displays the misspelled word when a whole sentence was stored', () => {
    const now = Date.now()
    const original = 'hell how are you are you okay if you nee help I can hel yuo'
    const corrected = 'hell how are you are you okay if you nee help I can hel you'
    const events = [
      baseEvent({
        id: 'long',
        batchId: 'b9',
        original,
        corrected,
        normalizedOriginal: original.toLowerCase(),
        normalizedCorrected: corrected.toLowerCase(),
        timestamp: now,
      }),
    ]
    const items = computeMistakeFeed(events, now)
    expect(items[0]?.original).toBe('yuo')
    expect(items[0]?.corrected).toBe('you')
  })

  it('includes keyboard-layout fixes in the mistake feed', () => {
    const now = Date.now()
    const events = [
      baseEvent({
        id: 'layout-1',
        batchId: 'layout-auto-1',
        category: 'layout',
        original: 'hgfdj',
        corrected: 'البيت',
        normalizedOriginal: 'hgfdj',
        normalizedCorrected: 'البيت',
        timestamp: now,
        action: 'accepted',
      }),
    ]
    const items = computeMistakeFeed(events, now)
    expect(items).toHaveLength(1)
    expect(items[0]?.category).toBe('layout')
    expect(items[0]?.original).toBe('hgfdj')
  })
})
