import type { CorrectionChange, RuleExplanation } from '@flowlary/shared'

export function areExplanationsAligned(
  changes: CorrectionChange[],
  explanations: RuleExplanation[] | undefined,
): explanations is RuleExplanation[] {
  return Array.isArray(explanations) && explanations.length === changes.length && changes.length > 0
}

export function getAlignedExplanations(
  changes: CorrectionChange[],
  explanations: RuleExplanation[] | undefined,
): RuleExplanation[] | null {
  if (!areExplanationsAligned(changes, explanations)) return null
  return explanations
}

export function shouldShowTrustedRuleTitle(explanation: RuleExplanation): boolean {
  return (
    explanation.source === 'trusted_rule' &&
    explanation.confidence === 'high' &&
    Boolean(explanation.ruleId?.trim()) &&
    Boolean(explanation.ruleTitle?.trim())
  )
}

export function shouldShowPracticeLink(explanation: RuleExplanation): boolean {
  return Boolean(explanation.practiceTargetId?.trim()) && explanation.category !== 'layout'
}
