import type {
  FullLearningReportNarrative,
  LearningAnalysisSnapshot,
  LearningFocus,
} from '@flowlary/shared'
import { WRITING_LEARNING_CATEGORIES } from '@flowlary/shared'

function categoryLabel(category: LearningFocus): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

export function buildWebDeterministicReportNarrative(
  snapshot: LearningAnalysisSnapshot,
): FullLearningReportNarrative {
  const { activity, trend, focusCategory, recurringPatterns, areasToImprove, strengths } = snapshot

  const overviewByQuality: Record<string, string> = {
    no_data: 'Start writing to build your learning report.',
    insufficient: 'Keep writing — your report needs a bit more evidence.',
    partial: 'Your learning report is taking shape from recent writing.',
    ready: 'Here is your learning report based on your recent writing.',
  }

  let overview = overviewByQuality[snapshot.evidenceQuality] ?? overviewByQuality.ready
  const parts: string[] = []
  if (recurringPatterns.length > 0) {
    const top = recurringPatterns[0]!
    parts.push(
      `A recurring pattern is "${top.displayOriginal}" → "${top.displayCorrected}" (${top.count} times).`,
    )
  }
  if (trend.label === 'improved' && trend.percent != null) {
    parts.push(`Your error rate improved by about ${trend.percent}% recently.`)
  } else if (focusCategory) {
    parts.push(`Your main focus area is ${categoryLabel(focusCategory)}.`)
  }
  if (parts.length > 0) overview = parts.join(' ')

  const strengthLines = strengths.map((item) => {
    if (item.reason === 'no_recurring_observed') {
      return `No recurring issues in ${categoryLabel(item.category)}.`
    }
    return `${categoryLabel(item.category)} makes up a smaller share of your errors.`
  })

  const focusLines = areasToImprove.map(
    (category) => `Practice ${categoryLabel(category)} — it shows up often in your writing.`,
  )

  const improvements: string[] = []
  if (trend.label === 'improved' && trend.percent != null) {
    improvements.push(`Error rate down about ${trend.percent}% over the last two weeks.`)
  }
  if (activity.practiceSessionsThisWeek > 0) {
    improvements.push(`You completed ${activity.practiceSessionsThisWeek} practice session(s) this week.`)
  }

  const recommendations: string[] = []
  if (recurringPatterns.length > 0) {
    recommendations.push('Practice your top recurring patterns in short sessions.')
  }
  if (focusCategory) {
    recommendations.push(`Focus your next practice on ${categoryLabel(focusCategory)}.`)
  }
  recommendations.push('Keep writing in the Writing Lab to strengthen your profile.')

  const nextSteps: string[] = []
  if (snapshot.practicePlan.recommendedAction.kind === 'practice_pattern') {
    nextSteps.push('Start a targeted practice session for your top pattern.')
  } else if (snapshot.practicePlan.recommendedAction.kind === 'practice_focus') {
    nextSteps.push('Open Practice and choose your recommended focus.')
  } else {
    nextSteps.push('Write a short paragraph in the Writing Lab today.')
  }
  nextSteps.push('Check Progress weekly to see your trend.')

  return {
    overview,
    strengths: strengthLines.length > 0 ? strengthLines : [`Writing activity across ${WRITING_LEARNING_CATEGORIES.length} skill areas.`],
    focusAreas: focusLines.length > 0 ? focusLines : ['Keep writing to reveal focus areas.'],
    improvements,
    recommendations,
    nextSteps,
    source: 'deterministic',
  }
}
