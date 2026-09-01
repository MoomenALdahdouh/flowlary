import { normalizeLearningText } from '../learningEvents.ts'

export type ExplanationConfidence = 'high' | 'medium' | 'low' | 'uncertain'

export type ExplanationSource = 'pair' | 'trusted_rule' | 'fallback'

export type ExplanationCategory = 'spelling' | 'grammar' | 'wording' | 'layout'

export type RuleExplanation = {
  confidence: ExplanationConfidence
  source: ExplanationSource
  category: ExplanationCategory
  ruleId?: string
  ruleTitle?: string
  summary: string
  why?: string
  incorrectExample: string
  correctExample: string
  practiceTargetId?: string
}

/** Declarative reference for future WL-4C-C trusted rule library entries. */
export type TrustedRuleReference = {
  ruleId: string
  category: ExplanationCategory
  ruleVersion: string
}

export type ExplanationConfidenceInput = {
  category: ExplanationCategory
  source: ExplanationSource
  original: string
  corrected: string
}

const EXPLANATION_CATEGORIES = new Set<ExplanationCategory>(['spelling', 'grammar', 'wording', 'layout'])
const EXPLANATION_CONFIDENCES = new Set<ExplanationConfidence>(['high', 'medium', 'low', 'uncertain'])
const EXPLANATION_SOURCES = new Set<ExplanationSource>(['pair', 'trusted_rule', 'fallback'])

/** Tokens too ambiguous for confident grammar pair labeling. */
const AMBIGUOUS_GRAMMAR_TOKENS = new Set([
  'a',
  'an',
  'the',
  'to',
  'be',
  'is',
  'are',
  'was',
  'were',
  'do',
  'does',
  'go',
  'goes',
  'get',
  'got',
])

function trimExample(value: string): string {
  return value.trim()
}

function nonEmpty(value: string): boolean {
  return trimExample(value).length > 0
}

function isExplanationCategory(value: unknown): value is ExplanationCategory {
  return typeof value === 'string' && EXPLANATION_CATEGORIES.has(value as ExplanationCategory)
}

export function isValidPracticeTargetId(
  practiceTargetId: string,
  category: ExplanationCategory,
  original: string,
): boolean {
  if (!practiceTargetId.includes(':')) return false
  const expected = `${category}:${normalizeLearningText(original)}`
  return practiceTargetId === expected
}

/**
 * Deterministic confidence representation — not a grammar rule resolver.
 * HIGH is reserved for future trusted_rule matches only.
 */
export function buildExplanationConfidence(input: ExplanationConfidenceInput): ExplanationConfidence {
  if (input.source === 'trusted_rule') {
    return 'high'
  }
  if (input.source === 'fallback') {
    return 'uncertain'
  }

  const original = trimExample(input.original)
  const normalized = normalizeLearningText(original)

  if (input.category === 'spelling' || input.category === 'wording') {
    return 'medium'
  }

  if (input.category === 'layout') {
    return 'medium'
  }

  if (input.category === 'grammar') {
    if (normalized.length < 3 || AMBIGUOUS_GRAMMAR_TOKENS.has(normalized)) {
      return 'uncertain'
    }
    return 'low'
  }

  return 'uncertain'
}

function pairSummary(category: ExplanationCategory, original: string, corrected: string): string {
  switch (category) {
    case 'spelling':
      return `The spelling '${original}' was corrected to '${corrected}'.`
    case 'wording':
      return `The wording '${original}' was changed to the more natural '${corrected}'.`
    case 'grammar':
      return `A grammar correction changed '${original}' to '${corrected}'.`
    case 'layout':
      return `The keyboard input '${original}' was corrected to '${corrected}'.`
    default:
      return `This was corrected from '${original}' to '${corrected}'.`
  }
}

function uncertainSummary(category: ExplanationCategory, original: string, corrected: string): string {
  if (category === 'layout') {
    return `The keyboard input '${original}' was corrected to '${corrected}', but the exact input pattern could not be identified confidently.`
  }
  return `This ${category} correction changed '${original}' to '${corrected}', but the exact rule could not be identified confidently.`
}

export type CreatePairExplanationInput = {
  category: ExplanationCategory
  original: string
  corrected: string
  practiceTargetId?: string
  why?: string
}

export function createPairExplanation(input: CreatePairExplanationInput): RuleExplanation {
  const original = trimExample(input.original)
  const corrected = trimExample(input.corrected)
  if (!nonEmpty(original) || !nonEmpty(corrected) || original === corrected) {
    throw new Error('invalid_pair_examples')
  }
  if (
    input.practiceTargetId &&
    !isValidPracticeTargetId(input.practiceTargetId, input.category, original)
  ) {
    throw new Error('invalid_practice_target_id')
  }

  const explanation: RuleExplanation = {
    confidence: buildExplanationConfidence({
      category: input.category,
      source: 'pair',
      original,
      corrected,
    }),
    source: 'pair',
    category: input.category,
    summary: pairSummary(input.category, original, corrected),
    why: input.why?.trim() || undefined,
    incorrectExample: original,
    correctExample: corrected,
    practiceTargetId: input.practiceTargetId,
  }

  assertRuleExplanationInvariants(explanation)
  return explanation
}

export type CreateUncertainExplanationInput = {
  category: ExplanationCategory
  original: string
  corrected: string
  practiceTargetId?: string
  why?: string
}

export function createUncertainExplanation(input: CreateUncertainExplanationInput): RuleExplanation {
  const original = trimExample(input.original)
  const corrected = trimExample(input.corrected)
  if (!nonEmpty(original) || !nonEmpty(corrected) || original === corrected) {
    throw new Error('invalid_pair_examples')
  }
  if (
    input.practiceTargetId &&
    !isValidPracticeTargetId(input.practiceTargetId, input.category, original)
  ) {
    throw new Error('invalid_practice_target_id')
  }

  const explanation: RuleExplanation = {
    confidence: 'uncertain',
    source: 'fallback',
    category: input.category,
    summary: uncertainSummary(input.category, original, corrected),
    why: input.why?.trim() || undefined,
    incorrectExample: original,
    correctExample: corrected,
    practiceTargetId: input.practiceTargetId,
  }

  assertRuleExplanationInvariants(explanation)
  return explanation
}

export type CreateTrustedRuleExplanationInput = {
  rule: TrustedRuleReference
  ruleTitle: string
  summary: string
  original: string
  corrected: string
  why?: string
  practiceTargetId?: string
}

export function createTrustedRuleExplanation(input: CreateTrustedRuleExplanationInput): RuleExplanation {
  const original = trimExample(input.original)
  const corrected = trimExample(input.corrected)
  const ruleTitle = trimExample(input.ruleTitle)
  const summary = trimExample(input.summary)

  if (!nonEmpty(original) || !nonEmpty(corrected) || original === corrected) {
    throw new Error('invalid_pair_examples')
  }
  if (!nonEmpty(input.rule.ruleId) || !nonEmpty(input.rule.ruleVersion)) {
    throw new Error('invalid_trusted_rule_reference')
  }
  if (!isExplanationCategory(input.rule.category)) {
    throw new Error('invalid_trusted_rule_category')
  }
  if (!nonEmpty(ruleTitle) || !nonEmpty(summary)) {
    throw new Error('invalid_trusted_rule_text')
  }
  if (
    input.practiceTargetId &&
    !isValidPracticeTargetId(input.practiceTargetId, input.rule.category, original)
  ) {
    throw new Error('invalid_practice_target_id')
  }

  const explanation: RuleExplanation = {
    confidence: 'high',
    source: 'trusted_rule',
    category: input.rule.category,
    ruleId: input.rule.ruleId,
    ruleTitle,
    summary,
    why: input.why?.trim() || undefined,
    incorrectExample: original,
    correctExample: corrected,
    practiceTargetId: input.practiceTargetId,
  }

  assertRuleExplanationInvariants(explanation)
  return explanation
}

export function assertRuleExplanationInvariants(explanation: RuleExplanation): void {
  if (!EXPLANATION_CONFIDENCES.has(explanation.confidence)) {
    throw new Error('invalid_confidence')
  }
  if (!EXPLANATION_SOURCES.has(explanation.source)) {
    throw new Error('invalid_source')
  }
  if (!isExplanationCategory(explanation.category)) {
    throw new Error('invalid_category')
  }
  if (!nonEmpty(explanation.summary)) {
    throw new Error('invalid_summary')
  }
  if (!nonEmpty(explanation.incorrectExample) || !nonEmpty(explanation.correctExample)) {
    throw new Error('invalid_examples')
  }
  if (explanation.incorrectExample === explanation.correctExample) {
    throw new Error('invalid_examples')
  }

  if (explanation.ruleTitle && !explanation.ruleId) {
    throw new Error('rule_title_without_rule_id')
  }

  if (explanation.source === 'trusted_rule') {
    if (!explanation.ruleId || !explanation.ruleTitle) {
      throw new Error('trusted_rule_missing_identity')
    }
    if (explanation.confidence !== 'high') {
      throw new Error('trusted_rule_confidence_mismatch')
    }
  } else if (explanation.ruleId || explanation.ruleTitle) {
    throw new Error('rule_identity_without_trusted_source')
  }

  if (explanation.source === 'pair' && explanation.confidence === 'high') {
    throw new Error('pair_confidence_too_high')
  }

  if (
    explanation.practiceTargetId &&
    !isValidPracticeTargetId(
      explanation.practiceTargetId,
      explanation.category,
      explanation.incorrectExample,
    )
  ) {
    throw new Error('invalid_practice_target_id')
  }
}

export function validateRuleExplanation(value: unknown): value is RuleExplanation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  try {
    assertRuleExplanationInvariants(value as RuleExplanation)
    return true
  } catch {
    return false
  }
}

export {
  buildExplanationFromCorrectionChange,
  type ExplanationBuildOptions,
} from './fromCorrectionChange.ts'

export {
  resolveExplanation,
  resolveTrustedRuleExplanation,
  resolveExplanationWithLibrary,
  TRUSTED_RULE_LIBRARY,
  getTrustedRuleById,
  assertTrustedRuleDefinition,
  assertTrustedRuleLibrary,
  createExactPairMatcher,
  findMatchingTrustedRules,
  type TrustedRuleDefinition,
  type TrustedRuleLibrary,
  type TrustedRuleMatchResult,
  type TrustedRuleMatcherInput,
  type TrustedRulePair,
} from './trustedRules/index.ts'

export {
  enrichCorrectionResponseWithExplanations,
  resolveExplanationSafe,
  type EnrichCorrectionExplanationsOptions,
} from './enrichCorrectionResponse.ts'

export {
  applyLocalizedPresentation,
  buildExplanationLocalizeCacheKey,
  canRequestAiExplanationLocalization,
  validateExplanationLocalizeRequest,
  validateExplanationLocalizeResponse,
  type ExplanationLocalizeRequest,
  type ExplanationLocalizeResponse,
  type LocalizedPresentationFields,
} from './localizePresentation.ts'

export {
  STATIC_TRUSTED_RULE_LOCALES,
  getStaticTrustedRulePresentation,
  resolveLocalizedPresentation,
} from './staticRuleLocales.ts'
