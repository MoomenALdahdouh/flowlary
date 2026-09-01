export type {
  TrustedRuleDefinition,
  TrustedRuleLibrary,
  TrustedRuleMatchResult,
  TrustedRuleMatcherInput,
  TrustedRulePair,
} from './types.ts'
export {
  assertTrustedRuleDefinition,
  assertTrustedRuleLibrary,
  createExactPairMatcher,
  findMatchingTrustedRules,
} from './matcher.ts'
export { TRUSTED_RULE_LIBRARY, getTrustedRuleById } from './rules.ts'
export { resolveExplanation, resolveTrustedRuleExplanation, resolveExplanationWithLibrary } from './resolver.ts'
