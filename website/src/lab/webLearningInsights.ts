import {
  learningEventDedupeKey,
  MIN_WRITING_EVENTS_FOR_PERSONALIZATION,
  practiceTargetPatternId,
  PRACTICE_TARGET_MIN_COUNT,
  WRITING_LEARNING_CATEGORIES,
  type CorrectionChange,
  type LearningEvent,
  type LearningEventCategory,
  type LearningFocus,
  type PracticeTargetPattern,
} from '@flowlary/shared'

/** Aligned with extension computeRecurringPatterns — one occurrence per batch/category/original. */
export type WebRecurringPattern = {
  category: LearningEventCategory
  normalizedOriginal: string
  displayOriginal: string
  displayCorrected: string
  count: number
}

export function computeWebRecurringPatterns(events: LearningEvent[], limit = 5): WebRecurringPattern[] {
  const unique = new Map<string, LearningEvent>()
  for (const event of events) {
    if (event.action === 'rejected' || event.category === 'layout') continue
    const key = learningEventDedupeKey(event)
    const existing = unique.get(key)
    if (!existing) {
      unique.set(key, event)
      continue
    }
    if (existing.action === 'detected' && event.action === 'accepted') {
      unique.set(key, event)
    }
  }

  const groups = new Map<
    string,
    {
      category: LearningEventCategory
      normalizedOriginal: string
      original: string
      corrected: string
      count: number
    }
  >()

  for (const event of unique.values()) {
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
    .filter((item) => item.count >= PRACTICE_TARGET_MIN_COUNT)
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

export function findRecurringForChange(
  events: LearningEvent[],
  change: CorrectionChange,
): WebRecurringPattern | null {
  if (change.type === 'layout') return null
  const normalized = change.original.trim().replace(/\s+/g, ' ').toLowerCase()
  const patterns = computeWebRecurringPatterns(events, 50)
  return (
    patterns.find(
      (pattern) => pattern.category === change.type && pattern.normalizedOriginal === normalized,
    ) ?? null
  )
}

export function toPracticeTarget(pattern: WebRecurringPattern): PracticeTargetPattern {
  return {
    category: pattern.category,
    normalizedOriginal: pattern.normalizedOriginal,
    displayOriginal: pattern.displayOriginal,
    displayCorrected: pattern.displayCorrected,
    count: pattern.count,
  }
}

export function practiceTargetIdForPattern(pattern: WebRecurringPattern): string {
  return practiceTargetPatternId(toPracticeTarget(pattern))
}

export type WebLearningSummary = {
  correctionCount: number
  topRecurring: WebRecurringPattern | null
  focusArea: LearningFocus | null
  personalizationReady: boolean
}

export function summarizeWebLearning(
  events: LearningEvent[],
  correctionCount: number,
): WebLearningSummary {
  const writingEvents = events.filter(
    (event) => event.action !== 'rejected' && event.category !== 'layout',
  )
  const recurring = computeWebRecurringPatterns(writingEvents, 1)[0] ?? null

  const categoryCounts: Record<LearningFocus, number> = {
    spelling: 0,
    grammar: 0,
    wording: 0,
  }
  for (const event of writingEvents) {
    if ((WRITING_LEARNING_CATEGORIES as readonly string[]).includes(event.category)) {
      categoryCounts[event.category as LearningFocus] += 1
    }
  }

  const focusArea =
    writingEvents.length >= MIN_WRITING_EVENTS_FOR_PERSONALIZATION
      ? (Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as LearningFocus | undefined) ??
        null
      : null

  return {
    correctionCount,
    topRecurring: recurring,
    focusArea,
    personalizationReady: writingEvents.length >= MIN_WRITING_EVENTS_FOR_PERSONALIZATION,
  }
}
