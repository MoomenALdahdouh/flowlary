import type { ChangeType, CorrectionChange } from '../correction/index.ts'
import type { ExplanationCategory, RuleExplanation } from './index.ts'
import {
  buildExplanationConfidence,
  createPairExplanation,
  createUncertainExplanation,
  isValidPracticeTargetId,
} from './index.ts'

export type ExplanationBuildOptions = {
  practiceTargetId?: string
}

const VALID_CHANGE_TYPES = new Set<ChangeType>(['spelling', 'grammar', 'wording', 'layout'])

function toExplanationCategory(type: ChangeType): ExplanationCategory {
  return type
}

function assertValidCorrectionChange(change: CorrectionChange): void {
  if (!change || typeof change !== 'object') {
    throw new Error('invalid_correction_change')
  }
  if (!VALID_CHANGE_TYPES.has(change.type)) {
    throw new Error('invalid_correction_category')
  }
  const original = typeof change.original === 'string' ? change.original.trim() : ''
  const corrected = typeof change.corrected === 'string' ? change.corrected.trim() : ''
  if (!original || !corrected || original === corrected) {
    throw new Error('invalid_correction_pair')
  }
}

/**
 * Deterministic adapter: CorrectionChange → RuleExplanation.
 * Produces only pair or fallback explanations — never trusted_rule.
 */
export function buildExplanationFromCorrectionChange(
  change: CorrectionChange,
  options?: ExplanationBuildOptions,
): RuleExplanation {
  assertValidCorrectionChange(change)

  const category = toExplanationCategory(change.type)
  const original = change.original.trim()
  const corrected = change.corrected.trim()
  const practiceTargetId = options?.practiceTargetId

  if (category === 'layout' && practiceTargetId) {
    throw new Error('layout_practice_target_not_allowed')
  }

  if (practiceTargetId && !isValidPracticeTargetId(practiceTargetId, category, original)) {
    throw new Error('invalid_practice_target_id')
  }

  const pairConfidence = buildExplanationConfidence({
    category,
    source: 'pair',
    original,
    corrected,
  })

  if (category === 'grammar' && pairConfidence === 'uncertain') {
    return createUncertainExplanation({
      category,
      original,
      corrected,
      practiceTargetId,
    })
  }

  return createPairExplanation({
    category,
    original,
    corrected,
    practiceTargetId,
  })
}
