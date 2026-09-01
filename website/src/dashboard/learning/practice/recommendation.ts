import type { LearningEvent, LearningEventCategory, LearningFocus } from '@flowlary/shared'
import {
  computeRecurringPatterns,
  type RecurringPattern,
} from '../progress.ts'
import type { PracticeDataState, PracticeRecommendation, PracticeTargetPattern } from '@flowlary/shared'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const USER_FOCUS_BOOST = 25

/**
 * Recommendation algorithm (deterministic):
 * 1. Use natural-writing LearningEvents only (source === "writing").
 * 2. Prefer recurring patterns (count >= 2) scored by:
 *    score = count * 100 + recencyBonus (25 if latest occurrence within 7 days)
 *    + userFocusBoost (25 if category is in profile focusAreas)
 * 3. If no recurring pattern qualifies, pick the category whose strongest
 *    single normalized pattern has the highest repeat count (concentration beats raw volume).
 * 4. Emerging state when 1–2 writing events; none when zero.
 */
export function computePracticeRecommendation(
  events: LearningEvent[],
  now = Date.now(),
  userFocusAreas: LearningFocus[] = [],
): PracticeRecommendation {
  const writingEvents = events.filter(
    (event) =>
      event.source === 'writing' &&
      event.action !== 'rejected' &&
      event.category !== 'layout',
  )

  if (writingEvents.length === 0) {
    return { state: 'none' }
  }

  if (writingEvents.length < 3) {
    return { state: 'emerging' }
  }

  const patterns = computeRecurringPatterns(writingEvents)
  const scoredPatterns = patterns
    .map((pattern) => ({
      pattern: toTargetPattern(pattern),
      score:
        scorePattern(pattern, writingEvents, now) +
        (userFocusAreas.includes(pattern.category as LearningFocus) ? USER_FOCUS_BOOST : 0),
    }))
    .sort((a, b) => b.score - a.score)

  if (scoredPatterns.length > 0 && scoredPatterns[0]!.score >= 200) {
    const top = scoredPatterns[0]!
    return {
      state: 'ready',
      focus: top.pattern.category,
      pattern: top.pattern,
    }
  }

  const categoryBest = bestCategoryByConcentration(writingEvents)
  if (categoryBest) {
    return {
      state: 'ready',
      focus: categoryBest.category,
      pattern: categoryBest,
    }
  }

  return { state: 'emerging' }
}

function toTargetPattern(pattern: RecurringPattern): PracticeTargetPattern {
  return {
    category: pattern.category,
    normalizedOriginal: pattern.normalizedOriginal,
    displayOriginal: pattern.displayOriginal,
    displayCorrected: pattern.displayCorrected,
    count: pattern.count,
  }
}

function scorePattern(
  pattern: RecurringPattern,
  events: LearningEvent[],
  now: number,
): number {
  const latest = events
    .filter(
      (event) =>
        event.category === pattern.category &&
        event.normalizedOriginal === pattern.normalizedOriginal,
    )
    .reduce((max, event) => Math.max(max, event.timestamp), 0)
  const recencyBonus = latest > now - WEEK_MS ? 25 : 0
  return pattern.count * 100 + recencyBonus
}

function bestCategoryByConcentration(events: LearningEvent[]): PracticeTargetPattern | null {
  const byCategory = new Map<LearningEventCategory, Map<string, PracticeTargetPattern>>()

  for (const event of events) {
    if (!byCategory.has(event.category)) byCategory.set(event.category, new Map())
    const group = byCategory.get(event.category)!
    const key = event.normalizedOriginal
    const existing = group.get(key)
    if (!existing) {
      group.set(key, {
        category: event.category,
        normalizedOriginal: event.normalizedOriginal,
        displayOriginal: event.original,
        displayCorrected: event.corrected,
        count: 1,
      })
    } else {
      existing.count += 1
    }
  }

  let best: PracticeTargetPattern | null = null
  for (const group of byCategory.values()) {
    for (const pattern of group.values()) {
      if (!best || pattern.count > best.count) best = pattern
    }
  }
  return best && best.count >= 2 ? best : null
}

export function resolvePracticeFocus(
  choice: 'recommended' | LearningEventCategory,
  recommendation: PracticeRecommendation,
): { focus: LearningEventCategory; pattern?: PracticeTargetPattern } {
  if (choice !== 'recommended') {
    return { focus: choice }
  }
  return {
    focus: recommendation.focus ?? 'grammar',
    pattern: recommendation.pattern,
  }
}

export type PracticeDataStateExport = PracticeDataState
