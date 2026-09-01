import { normalizeLearningText } from '../../learningEvents.ts'
import type { TrustedRuleDefinition, TrustedRuleLibrary, TrustedRuleMatcherInput, TrustedRulePair } from './types.ts'

function normalizePair(pair: TrustedRulePair): TrustedRulePair {
  return {
    incorrect: normalizeLearningText(pair.incorrect),
    correct: normalizeLearningText(pair.correct),
  }
}

export function createExactPairMatcher(
  definition: Pick<TrustedRuleDefinition, 'category' | 'pairs'>,
): (input: TrustedRuleMatcherInput) => 'match' | 'no_match' {
  const normalizedPairs = definition.pairs.map(normalizePair)

  return (input: TrustedRuleMatcherInput): 'match' | 'no_match' => {
    if (input.change.type !== definition.category) return 'no_match'
    const matched = normalizedPairs.some(
      (pair) =>
        pair.incorrect === input.normalizedOriginal &&
        pair.correct === input.normalizedCorrected,
    )
    return matched ? 'match' : 'no_match'
  }
}

export function assertTrustedRuleDefinition(rule: TrustedRuleDefinition): void {
  if (!rule.ruleId.trim()) throw new Error('invalid_trusted_rule_id')
  if (!rule.version.trim()) throw new Error('invalid_trusted_rule_version')
  if (!rule.title.trim() || !rule.summary.trim() || !rule.why.trim()) {
    throw new Error('invalid_trusted_rule_text')
  }
  if (!rule.pairs.length) throw new Error('invalid_trusted_rule_pairs')
  for (const pair of rule.pairs) {
    if (!pair.incorrect.trim() || !pair.correct.trim()) {
      throw new Error('invalid_trusted_rule_pair')
    }
    if (normalizeLearningText(pair.incorrect) === normalizeLearningText(pair.correct)) {
      throw new Error('invalid_trusted_rule_pair')
    }
  }
}

export function assertTrustedRuleLibrary(library: TrustedRuleLibrary): void {
  const ruleIds = new Set<string>()
  const pairKeys = new Set<string>()

  for (const rule of library) {
    assertTrustedRuleDefinition(rule)
    if (ruleIds.has(rule.ruleId)) throw new Error('duplicate_trusted_rule_id')
    ruleIds.add(rule.ruleId)

    for (const pair of rule.pairs) {
      const key = `${rule.category}:${normalizeLearningText(pair.incorrect)}→${normalizeLearningText(pair.correct)}`
      if (pairKeys.has(key)) throw new Error('duplicate_trusted_rule_pair')
      pairKeys.add(key)
    }
  }
}

export function findMatchingTrustedRules(
  library: TrustedRuleLibrary,
  input: TrustedRuleMatcherInput,
): TrustedRuleDefinition[] {
  return library.filter((rule) => rule.match(input) === 'match')
}
