import type { PracticeSessionStoreV1, LearningPersonalization } from '@flowlary/shared'
import {
  countWords,
  INPUT_LEARNING_CATEGORIES,
  learningEventDedupeKey,
  LEARNING_CATEGORIES,
  MIN_ERRORS_FOR_TREND,
  MIN_WORDS_FOR_ERROR_RATE,
  PROGRESS_TREND_PERIOD_MS,
  WRITING_LEARNING_CATEGORIES,
  type LearningEvent,
  type LearningEventCategory,
  type LearningEventStoreV1,
  type WritingSampleRecord,
} from '@flowlary/shared'
import { computePracticeSummary } from './practice/sessions.ts'

export type ProgressState = 'empty' | 'insufficient_words' | 'ready'

export type ProgressTrend = {
  direction: 'down' | 'up' | 'flat' | null
  percent: number | null
  label: string
}

export type RecurringPattern = {
  category: LearningEventCategory
  normalizedOriginal: string
  displayOriginal: string
  displayCorrected: string
  count: number
}

export type ProgressRecentEvent = {
  id: string
  category: LearningEventCategory
  original: string
  corrected: string
  action: LearningEvent['action']
  timestamp: number
  relativeLabel: string
}

export type ProgressDayPoint = {
  key: string
  label: string
  words: number
  errors: number
  rate: number
  spelling: number
  grammar: number
  wording: number
}

export type ProgressWeekBar = {
  key: string
  label: string
  spelling: number
  grammar: number
  wording: number
}

export type ProgressSkillSpark = {
  type: (typeof WRITING_LEARNING_CATEGORIES)[number]
  count: number
  spark: number[]
}

export type ProgressCharts = {
  daily: ProgressDayPoint[]
  weekly: ProgressWeekBar[]
  skills: ProgressSkillSpark[]
}

export type ProgressMetrics = {
  state: ProgressState
  wordsWritten: number
  learningEventCount: number
  errorCount: number
  errorsPer100Words: number | null
  byType: Record<LearningEventCategory, number>
  byTypePercent: Record<LearningEventCategory, number> | null
  /** Percentages within writing categories only (spelling/grammar/wording denominator). */
  byTypePercentWriting: Record<(typeof WRITING_LEARNING_CATEGORIES)[number], number> | null
  /** Percentages within input categories only (layout denominator). */
  byTypePercentInput: Record<(typeof INPUT_LEARNING_CATEGORIES)[number], number> | null
  trend: ProgressTrend
  recentEvents: ProgressRecentEvent[]
  recurringPatterns: RecurringPattern[]
  practiceSummary: {
    sessionsThisWeek: number
    itemsThisWeek: number
    patternsReviewedThisWeek: number
  }
  writingErrorCount: number
  practiceErrorCount: number
  charts: ProgressCharts
  /** Deterministic personalization derived from progress + profile (WL-3). */
  personalization?: LearningPersonalization
}

/**
 * Progress error numerator semantics:
 * - One error per unique (batchId, category, normalizedOriginal).
 * - When both detected and accepted exist for the same key, count once (accepted wins).
 * - Rejected events never count as errors.
 * - Direct-mode corrections emit accepted only; box-mode may emit detected then accepted
 *   without double-counting.
 *
 * Denominator: sum of unique writing-sample word counts (sampleHash dedupe).
 *
 * Formula: errorsPer100Words = (errorCount / wordsWritten) * 100
 *
 * Trend: compares errors-per-100-words between the current and previous 7-day
 * periods (requires MIN_ERRORS_FOR_TREND in each period and MIN_WORDS_FOR_ERROR_RATE
 * words in each period).
 */
export function uniqueLearningErrorEvents(events: LearningEvent[]): LearningEvent[] {
  const byKey = new Map<string, LearningEvent>()
  for (const event of events) {
    if (event.action === 'rejected') continue
    const key = learningEventDedupeKey(event)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, event)
      continue
    }
    if (existing.action === 'detected' && event.action === 'accepted') {
      byKey.set(key, event)
    }
  }
  return [...byKey.values()]
}

export function countUniqueLearningErrors(events: LearningEvent[]): number {
  return uniqueLearningErrorEvents(events).length
}

export function sumUniqueWordsWritten(store: LearningEventStoreV1): number {
  return sumUniqueWordsInPeriod(store.samples, 0, Number.POSITIVE_INFINITY)
}

export function sumUniqueWordsInPeriod(
  samples: WritingSampleRecord[],
  start: number,
  end: number,
): number {
  const seen = new Set<string>()
  let total = 0
  for (const sample of samples) {
    if (sample.timestamp < start || sample.timestamp >= end) continue
    if (seen.has(sample.hash)) continue
    seen.add(sample.hash)
    total += sample.wordCount
  }
  return total
}

function computeGroupTypePercent<T extends LearningEventCategory>(
  byType: Record<LearningEventCategory, number>,
  categories: readonly T[],
): Record<T, number> | null {
  const total = categories.reduce((sum, category) => sum + byType[category], 0)
  if (total === 0) return null
  return Object.fromEntries(
    categories.map((category) => [category, Math.round((byType[category] / total) * 100)]),
  ) as Record<T, number>
}

export function countErrorsByType(events: LearningEvent[]): Record<LearningEventCategory, number> {
  const unique = uniqueLearningErrorEvents(events)

  const counts = Object.fromEntries(
    LEARNING_CATEGORIES.map((category) => [category, 0]),
  ) as Record<LearningEventCategory, number>
  for (const event of unique) {
    counts[event.category] += 1
  }
  return counts
}

export function computeRecurringPatterns(events: LearningEvent[], limit = 5): RecurringPattern[] {
  const unique = uniqueLearningErrorEvents(events)

  const groups = new Map<
    string,
    { category: LearningEventCategory; normalizedOriginal: string; original: string; corrected: string; count: number }
  >()

  for (const event of unique) {
    const key = `${event.category}:${event.normalizedOriginal}`
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        category: event.category,
        normalizedOriginal: event.normalizedOriginal,
        original: event.original,
        corrected: event.corrected,
        count: 1,
      })
      continue
    }
    existing.count += 1
  }

  return [...groups.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => ({
      category: item.category,
      normalizedOriginal: item.normalizedOriginal,
      displayOriginal: item.original,
      displayCorrected: item.corrected,
      count: item.count,
    }))
}

function filterEventsInPeriod(events: LearningEvent[], start: number, end: number): LearningEvent[] {
  return events.filter((event) => event.timestamp >= start && event.timestamp < end)
}

export function computeTrend(
  events: LearningEvent[],
  samples: WritingSampleRecord[],
  wordsWritten: number,
  now = Date.now(),
): ProgressTrend {
  if (wordsWritten < MIN_WORDS_FOR_ERROR_RATE) {
    return { direction: null, percent: null, label: 'not_enough_data' }
  }

  const currentStart = now - PROGRESS_TREND_PERIOD_MS
  const previousStart = now - PROGRESS_TREND_PERIOD_MS * 2

  const currentEvents = filterEventsInPeriod(events, currentStart, now)
  const previousEvents = filterEventsInPeriod(events, previousStart, currentStart)

  const currentErrors = countUniqueLearningErrors(currentEvents)
  const previousErrors = countUniqueLearningErrors(previousEvents)

  const currentWords = sumUniqueWordsInPeriod(samples, currentStart, now)
  const previousWords = sumUniqueWordsInPeriod(samples, previousStart, currentStart)

  if (
    currentErrors < MIN_ERRORS_FOR_TREND ||
    previousErrors < MIN_ERRORS_FOR_TREND ||
    currentWords < MIN_WORDS_FOR_ERROR_RATE ||
    previousWords < MIN_WORDS_FOR_ERROR_RATE
  ) {
    return { direction: null, percent: null, label: 'not_enough_data' }
  }

  const currentRate = (currentErrors / currentWords) * 100
  const previousRate = (previousErrors / previousWords) * 100

  if (previousRate === 0) {
    if (currentRate === 0) {
      return { direction: 'flat', percent: 0, label: 'flat' }
    }
    return { direction: null, percent: null, label: 'not_enough_data' }
  }

  const delta = ((currentRate - previousRate) / previousRate) * 100
  const rounded = Math.round(Math.abs(delta))
  if (Math.abs(delta) < 3) {
    return { direction: 'flat', percent: 0, label: 'flat' }
  }
  if (delta < 0) {
    return { direction: 'down', percent: rounded, label: 'improved' }
  }
  return { direction: 'up', percent: rounded, label: 'increased' }
}

function relativeTimeLabel(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'today'
  if (diff < day * 2) return 'yesterday'
  const days = Math.floor(diff / day)
  return `${days} days ago`
}

const DAY_MS = 24 * 60 * 60 * 1000

function calendarDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function chartErrorRate(eventCount: number, wordCount: number): number {
  if (wordCount <= 0) return 0
  return Math.round((eventCount / wordCount) * 1000) / 10
}

export function computeProgressCharts(
  store: LearningEventStoreV1,
  now = Date.now(),
): ProgressCharts {
  const unique = uniqueLearningErrorEvents(store.events)
  const daily: ProgressDayPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const ts = now - i * DAY_MS
    const key = calendarDayKey(ts)
    const date = new Date(ts)
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const seenHashes = new Set<string>()
    let words = 0
    for (const sample of store.samples) {
      if (calendarDayKey(sample.timestamp) !== key) continue
      if (seenHashes.has(sample.hash)) continue
      seenHashes.add(sample.hash)
      words += sample.wordCount
    }
    const dayEvents = unique.filter((event) => calendarDayKey(event.timestamp) === key)
    const spelling = dayEvents.filter((event) => event.category === 'spelling').length
    const grammar = dayEvents.filter((event) => event.category === 'grammar').length
    const wording = dayEvents.filter((event) => event.category === 'wording').length
    daily.push({
      key,
      label,
      words,
      errors: dayEvents.length,
      rate: chartErrorRate(dayEvents.length, words),
      spelling,
      grammar,
      wording,
    })
  }

  const weekly: ProgressWeekBar[] = []
  for (let i = 5; i >= 0; i--) {
    const end = now - i * 7 * DAY_MS
    const start = end - 7 * DAY_MS
    const slice = unique.filter((event) => event.timestamp >= start && event.timestamp < end)
    const date = new Date(start + 3 * DAY_MS)
    weekly.push({
      key: calendarDayKey(start),
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      spelling: slice.filter((event) => event.category === 'spelling').length,
      grammar: slice.filter((event) => event.category === 'grammar').length,
      wording: slice.filter((event) => event.category === 'wording').length,
    })
  }

  const last7 = daily.slice(-7)
  const skills: ProgressSkillSpark[] = WRITING_LEARNING_CATEGORIES.map((type) => ({
    type,
    count: unique.filter((event) => event.category === type).length,
    spark: last7.map((point) => point[type]),
  }))

  return { daily, weekly, skills }
}

export function computeProgressMetrics(
  store: LearningEventStoreV1,
  sessionStore: PracticeSessionStoreV1 = { version: 1, sessions: [] },
  now = Date.now(),
): ProgressMetrics {
  const events = store.events
  const wordsWritten = sumUniqueWordsWritten(store)
  const errorCount = countUniqueLearningErrors(events)
  const writingErrorCount = countUniqueLearningErrors(events.filter((event) => event.source === 'writing'))
  const practiceErrorCount = countUniqueLearningErrors(events.filter((event) => event.source === 'practice'))
  const byType = countErrorsByType(events)

  let state: ProgressState = 'empty'
  if (errorCount > 0 || wordsWritten > 0) {
    state = wordsWritten >= MIN_WORDS_FOR_ERROR_RATE ? 'ready' : 'insufficient_words'
  }

  let errorsPer100Words: number | null = null
  if (state === 'ready' && wordsWritten > 0) {
    errorsPer100Words = Math.round((errorCount / wordsWritten) * 1000) / 10
  }

  let byTypePercent: Record<LearningEventCategory, number> | null = null
  const byTypePercentWriting = computeGroupTypePercent(byType, WRITING_LEARNING_CATEGORIES)
  const byTypePercentInput = computeGroupTypePercent(byType, INPUT_LEARNING_CATEGORIES)
  if (errorCount > 0) {
    byTypePercent = Object.fromEntries(
      LEARNING_CATEGORIES.map((category) => [
        category,
        Math.round((byType[category] / errorCount) * 100),
      ]),
    ) as Record<LearningEventCategory, number>
  }

  const recentEvents: ProgressRecentEvent[] = events
    .filter((event) => event.action !== 'rejected')
    .slice(0, 8)
    .map((event) => ({
      id: event.id,
      category: event.category,
      original: event.original,
      corrected: event.corrected,
      action: event.action,
      timestamp: event.timestamp,
      relativeLabel: relativeTimeLabel(event.timestamp, now),
    }))

  return {
    state,
    wordsWritten,
    learningEventCount: events.length,
    errorCount,
    errorsPer100Words,
    byType,
    byTypePercent,
    byTypePercentWriting,
    byTypePercentInput,
    trend: computeTrend(events, store.samples, wordsWritten, now),
    recentEvents,
    recurringPatterns: computeRecurringPatterns(events),
    practiceSummary: computePracticeSummary(sessionStore, now),
    writingErrorCount,
    practiceErrorCount,
    charts: computeProgressCharts(store, now),
  }
}

export { countWords, MIN_WORDS_FOR_ERROR_RATE }
