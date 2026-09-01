import type { CorrectionChange } from '../../correction/index.ts'
import { normalizeLearningText } from '../../learningEvents.ts'
import {
  createTrustedRuleExplanation,
  type RuleExplanation,
} from '../index.ts'
import {
  buildExplanationFromCorrectionChange,
  type ExplanationBuildOptions,
} from '../fromCorrectionChange.ts'
import { assertTrustedRuleLibrary, findMatchingTrustedRules } from './matcher.ts'
import { TRUSTED_RULE_LIBRARY } from './rules.ts'
import type { TrustedRuleMatcherInput } from './types.ts'

assertTrustedRuleLibrary(TRUSTED_RULE_LIBRARY)

function toMatcherInput(change: CorrectionChange): TrustedRuleMatcherInput {
  return {
    change,
    normalizedOriginal: normalizeLearningText(change.original),
    normalizedCorrected: normalizeLearningText(change.corrected),
  }
}

/**
 * Deterministic resolver: trusted rule match → createTrustedRuleExplanation(),
 * otherwise → buildExplanationFromCorrectionChange() (WL-4C-B fallback).
 *
 * Never guesses. Multiple matches → fallback. Layout → always fallback.
 */
export function resolveExplanation(
  change: CorrectionChange,
  options?: ExplanationBuildOptions,
): RuleExplanation {
  if (change.type === 'layout') {
    return buildExplanationFromCorrectionChange(change, options)
  }

  const matches = findMatchingTrustedRules(TRUSTED_RULE_LIBRARY, toMatcherInput(change))

  if (matches.length !== 1) {
    return buildExplanationFromCorrectionChange(change, options)
  }

  const rule = matches[0]!
  return createTrustedRuleExplanation({
    rule: {
      ruleId: rule.ruleId,
      category: rule.category,
      ruleVersion: rule.version,
    },
    ruleTitle: rule.title,
    summary: rule.summary,
    why: rule.why,
    original: change.original.trim(),
    corrected: change.corrected.trim(),
    practiceTargetId: options?.practiceTargetId,
  })
}

/** @deprecated Prefer resolveExplanation — kept for spec naming parity. */
export const resolveTrustedRuleExplanation = resolveExplanation

export function resolveExplanationWithLibrary(
  change: CorrectionChange,
  library: typeof TRUSTED_RULE_LIBRARY,
  options?: ExplanationBuildOptions,
): RuleExplanation {
  if (change.type === 'layout') {
    return buildExplanationFromCorrectionChange(change, options)
  }

  const matches = findMatchingTrustedRules(library, toMatcherInput(change))
  if (matches.length !== 1) {
    return buildExplanationFromCorrectionChange(change, options)
  }

  const rule = matches[0]!
  return createTrustedRuleExplanation({
    rule: {
      ruleId: rule.ruleId,
      category: rule.category,
      ruleVersion: rule.version,
    },
    ruleTitle: rule.title,
    summary: rule.summary,
    why: rule.why,
    original: change.original.trim(),
    corrected: change.corrected.trim(),
    practiceTargetId: options?.practiceTargetId,
  })
}
