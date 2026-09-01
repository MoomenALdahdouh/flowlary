import type { CorrectionChange } from '../../correction/index.ts'
import type { ExplanationCategory } from '../index.ts'

export type TrustedRuleMatchResult = 'match' | 'no_match'

export type TrustedRuleMatcherInput = {
  change: CorrectionChange
  normalizedOriginal: string
  normalizedCorrected: string
}

export type TrustedRulePair = {
  incorrect: string
  correct: string
}

export type TrustedRuleDefinition = {
  ruleId: string
  category: ExplanationCategory
  version: string
  title: string
  summary: string
  why: string
  examples: readonly TrustedRulePair[]
  /** Exact normalized pairs this rule may match. */
  pairs: readonly TrustedRulePair[]
  match(input: TrustedRuleMatcherInput): TrustedRuleMatchResult
}

export type TrustedRuleLibrary = readonly TrustedRuleDefinition[]
