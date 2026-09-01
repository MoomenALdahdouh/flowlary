import type {
  LearningEvent,
  LearningFocus,
  LearningPersonalization,
  LearningProfile,
  PersonalizationInsight,
  PracticeRecommendation,
} from '@flowlary/shared'
import {
  isLearningFocus,
  LEARNING_FOCUS_AREAS,
  MIN_WRITING_EVENTS_FOR_PERSONALIZATION,
} from '@flowlary/shared'
import type { ProgressMetrics } from './progress.ts'
import { computePracticeRecommendation } from './practice/recommendation.ts'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const USER_FOCUS_BOOST = 25
const RECURRING_LAYOUT_THRESHOLD = 2

function prioritizeWritingCategories(
  metrics: ProgressMetrics,
  events: LearningEvent[],
  userFocusAreas: LearningFocus[],
  now: number,
): LearningFocus[] {
  const scores = new Map<LearningFocus, number>()

  for (const focus of LEARNING_FOCUS_AREAS) {
    scores.set(focus, (metrics.byType[focus] ?? 0) * 10)
  }

  for (const pattern of metrics.recurringPatterns) {
    if (!isLearningFocus(pattern.category)) continue
    const latest = events
      .filter(
        (event) =>
          event.category === pattern.category &&
          event.normalizedOriginal === pattern.normalizedOriginal,
      )
      .reduce((max, event) => Math.max(max, event.timestamp), 0)
    const recencyBonus = latest > now - WEEK_MS ? USER_FOCUS_BOOST : 0
    scores.set(
      pattern.category,
      (scores.get(pattern.category) ?? 0) + pattern.count * 100 + recencyBonus,
    )
  }

  for (const focus of userFocusAreas) {
    scores.set(focus, (scores.get(focus) ?? 0) + USER_FOCUS_BOOST)
  }

  return [...LEARNING_FOCUS_AREAS].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0))
}

/**
 * Deterministic personalization from existing progress, profile, and recommendation data.
 * Does not call AI. Does not modify the user profile.
 */
export function computeLearningPersonalization(
  metrics: ProgressMetrics,
  profile: LearningProfile,
  events: LearningEvent[],
  recommendation: PracticeRecommendation,
  now = Date.now(),
): LearningPersonalization {
  const userFocusAreas = [...profile.focusAreas]

  if (metrics.state === 'empty') {
    return {
      state: 'no_data',
      userFocusAreas,
      systemRecommendedFocus: null,
      inputFocusCategory: null,
      prioritizedCategories: [],
      insights: [{ id: 'building_profile' }],
    }
  }

  const writingEvents = events.filter(
    (event) =>
      event.source === 'writing' &&
      event.action !== 'rejected' &&
      event.category !== 'layout',
  )

  if (
    metrics.state === 'insufficient_words' ||
    writingEvents.length < MIN_WRITING_EVENTS_FOR_PERSONALIZATION
  ) {
    const insights: PersonalizationInsight[] = [{ id: 'building_profile' }]
    if (userFocusAreas.length > 0) {
      insights.push({
        id: 'user_focus',
        params: { categories: userFocusAreas.map((focus) => focus).join(', ') },
      })
    }
    return {
      state: 'insufficient',
      userFocusAreas,
      systemRecommendedFocus: null,
      inputFocusCategory: null,
      prioritizedCategories: [],
      insights,
    }
  }

  const inputFocusCategory =
    (metrics.byType.layout ?? 0) >= RECURRING_LAYOUT_THRESHOLD ? ('layout' as const) : null

  let systemRecommendedFocus: LearningFocus | null = null
  if (
    recommendation.state === 'ready' &&
    recommendation.focus &&
    isLearningFocus(recommendation.focus)
  ) {
    systemRecommendedFocus = recommendation.focus
  }

  const prioritizedCategories = prioritizeWritingCategories(
    metrics,
    writingEvents,
    userFocusAreas,
    now,
  )

  const insights: PersonalizationInsight[] = []

  if (userFocusAreas.length > 0) {
    insights.push({
      id: 'user_focus',
      params: { categories: userFocusAreas.join(', ') },
    })
  }

  if (systemRecommendedFocus) {
    insights.push({
      id: 'system_focus',
      params: { category: systemRecommendedFocus },
    })
  }

  const topRecurring = metrics.recurringPatterns.find((pattern) => isLearningFocus(pattern.category))
  if (topRecurring) {
    insights.push({
      id: 'recurring_pattern',
      params: {
        category: topRecurring.category,
        original: topRecurring.displayOriginal,
        corrected: topRecurring.displayCorrected,
        count: String(topRecurring.count),
      },
    })
  }

  if (metrics.trend.label === 'improved' && metrics.trend.percent != null) {
    insights.push({
      id: 'trend_improved',
      params: { percent: String(metrics.trend.percent) },
    })
  } else if (metrics.trend.label === 'increased' && metrics.trend.percent != null) {
    insights.push({
      id: 'trend_increased',
      params: { percent: String(metrics.trend.percent) },
    })
  }

  if (inputFocusCategory) {
    insights.push({ id: 'input_layout_focus' })
  }

  return {
    state: 'ready',
    userFocusAreas,
    systemRecommendedFocus,
    inputFocusCategory,
    prioritizedCategories,
    insights,
  }
}

export function attachPersonalizationToProgress(
  metrics: ProgressMetrics,
  profile: LearningProfile,
  events: LearningEvent[],
  now = Date.now(),
): ProgressMetrics {
  const recommendation = computePracticeRecommendation(events, now, profile.focusAreas)
  return {
    ...metrics,
    personalization: computeLearningPersonalization(metrics, profile, events, recommendation, now),
  }
}
