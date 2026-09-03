import type {
  LearningCoachAction,
  LearningCoachContext,
  LearningCoachMode,
  LearningCoachResponse,
} from '@flowlary/shared'

function defaultActions(context: LearningCoachContext): LearningCoachAction[] {
  const actions: LearningCoachAction[] = []
  const action = context.practiceAction
  const top = context.recurringPatterns[0]

  if (action === 'practice_pattern' && top) {
    actions.push({ kind: 'practice_pattern', targetPatternId: top.targetPatternId })
  } else if (action === 'practice_focus' && context.focusCategory) {
    actions.push({ kind: 'practice_focus', focus: context.focusCategory })
  } else if (context.briefState === 'empty' || context.briefState === 'insufficient') {
    actions.push({ kind: 'keep_writing' })
  } else if (context.focusCategory) {
    actions.push({ kind: 'practice_focus', focus: context.focusCategory })
  }

  actions.push({ kind: 'view_progress' })
  if (context.evidenceQuality === 'ready' || context.evidenceQuality === 'partial') {
    actions.push({ kind: 'open_report' })
  }
  return actions.slice(0, 4)
}

export function buildDeterministicCoachResponse(
  context: LearningCoachContext,
  mode: LearningCoachMode,
): LearningCoachResponse {
  if (context.evidenceQuality === 'no_data' || context.briefState === 'empty') {
    return {
      summary: 'Start writing to build evidence for coaching.',
      observations: ['No writing events yet.'],
      recommendations: ['Use the Writing Lab or extension to write a short paragraph.'],
      explanations: [],
      actions: [{ kind: 'keep_writing' }],
      evidenceReferences: ['evidence:no_data'],
      source: 'deterministic',
    }
  }

  if (context.evidenceQuality === 'insufficient' || context.briefState === 'insufficient') {
    return {
      summary: 'Your profile is still forming. A few more corrections will unlock sharper coaching.',
      observations: ['Not enough writing evidence yet.'],
      recommendations: ['Keep writing naturally and accept or review corrections.'],
      explanations: [],
      actions: [{ kind: 'keep_writing' }, { kind: 'view_progress' }],
      evidenceReferences: ['evidence:insufficient'],
      source: 'deterministic',
    }
  }

  const observations: string[] = []
  const recommendations: string[] = []
  const explanations: string[] = []
  const top = context.recurringPatterns[0]

  if (top) {
    observations.push(
      `You often write "${top.original}" instead of "${top.corrected}" (${top.count} times).`,
    )
    if (top.explanation?.summary) explanations.push(top.explanation.summary)
    recommendations.push('Practice this pattern in a short session.')
  } else if (context.focusCategory) {
    observations.push(`Your writing points to ${context.focusCategory} as a focus area.`)
    recommendations.push(`Start a ${context.focusCategory} practice session.`)
  }

  if (context.trend.direction === 'down' && context.trend.percent != null) {
    observations.push(`Error rate improved about ${context.trend.percent}% recently.`)
  }

  if (mode === 'practice_help') {
    recommendations.push('Use targeted practice for recurring patterns before free writing.')
  }

  return {
    summary:
      observations[0] ??
      'Your writing shows steady progress. Keep practicing your focus areas.',
    observations,
    recommendations: recommendations.length > 0 ? recommendations : ['Keep writing daily.'],
    explanations,
    actions: defaultActions(context),
    evidenceReferences: top ? [`recurring:${top.targetPatternId}`] : ['evidence:general'],
    source: 'deterministic',
  }
}
