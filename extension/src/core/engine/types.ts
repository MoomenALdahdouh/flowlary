/**
 * Phase 2 observe-only contracts (spec §6, subset).
 * These types MUST NOT be treated as a write or UI API.
 */

export const ENGINE_VERSION = '2.0.0-shadow'
export const ENGINE_FLAG_KEY = 'flowlary.debug.engineMode'
export type EngineMode = 'off' | 'internal_shadow' | 'enforce'

export type DecisionAction =
  | 'layout_fix'
  | 'translation'
  | 'english_correction'
  | 'suggestion'
  | 'noop'

export type DecisionTrigger = 'auto' | 'shortcut'

export type TextOrigin =
  | 'original_en'
  | 'original_ar'
  | 'original_mixed'
  | 'translated_en'
  | 'corrected_en'
  | 'layout_mismatch_suspected'
  | 'arabizi_suspected'
  | 'unknown'

export type ConfidenceClass = 'high' | 'medium' | 'low' | 'ambiguous'
export type EditorTier = 1 | 2 | 3 | 4

export type TextRange = { start: number; end: number }

export type DecisionReasonCode =
  | 'policy_assistant_off'
  | 'policy_shortcuts_only'
  | 'policy_capability_off'
  | 'protected_context'
  | 'unsupported_editor'
  | 'composing'
  | 'mutex_held'
  | 'low_confidence'
  | 'ambiguous_short_token'
  | 'ambiguous_mixed'
  | 'arabizi'
  | 'suspected_layout_blocks_grammar'
  | 'single_winner_layout'
  | 'single_winner_translation'
  | 'single_winner_correction'
  | 'downgraded_to_suggestion'
  | 'no_candidates'
  | 'shadow_observe_only'
  | 'session_missing'
  | 'legacy_live_behavior'
  | 'help_style_requires_suggestion'
  | 'engine_disabled'
  | 'legacy_not_observable'
  | 'cooldown'
  | 'stale_generation'
  | 'translated_output_blocks_grammar'
  | 'hypothesis_conflict'
  | 'hypothesis_preserve'
  | 'paste_conservative'
  | 'advisor_invalid'
  | 'advisor_unavailable'
  | 'advisor_abstain'
  | 'user_override'
  | 'mixed_spans_no_blob_translate'
  | 'mixed_intent_blocks_auto_layout'
  | 'no_unambiguous_winner'
  | 'hypothesis_winner'
  | 'unfinished_token'
  | 'review_candidate'
  | 'review_dropped'
  | 'review_stale'

export type WritingIntent =
  | 'write_as_is'
  | 'fix_layout'
  | 'fix_english'
  | 'translate'
  | 'preserve'
  | 'unknown'
  | 'user_override'

export type SpanRole =
  | 'arabic_prose'
  | 'english_prose'
  | 'intentional_foreign_token'
  | 'technical_token'
  | 'identifier'
  | 'url'
  | 'email'
  | 'code'
  | 'number'
  | 'punctuation'
  | 'arabizi'
  | 'possible_layout_error'
  | 'possible_spelling_error'
  | 'unknown'
  | 'protected'
  | 'translated_output'
  | 'user_override'

export type HypothesisRisk = 'low' | 'medium' | 'high'
export type InputSource = 'typing' | 'paste' | 'drop' | 'programmatic' | 'unknown'
export type ReplacementSource = 'map_layout' | 'instant_spell' | 'contextual_spell' | 'none'
export type LlmAdvisorResult = 'unused' | 'ranked' | 'invalid' | 'unavailable' | 'abstain' | 'stale'

export type HypothesisCapability = 'layout_fix' | 'translation' | 'english_correction'

export type Hypothesis = {
  id: string
  span: TextRange
  intent: WritingIntent
  candidateAction: HypothesisCapability | null
  replacementSource: ReplacementSource
  replacement?: string
  localScore: number
  evidence: Evidence[]
  conflicts: string[]
  risk: HypothesisRisk
  needsLLM: boolean
  sourceChunkIds: string[]
  reviewKind?: import('@flowlary/shared').WritingReviewEditKind
  reviewConfidence?: import('@flowlary/shared').WritingReviewConfidence
}

export type AdvisorVote = {
  rankedHypothesisIds: string[]
  reasonCode: string
  ambiguityClass: string
}

export type Confidence = { score: number; class: ConfidenceClass }

export type EvidenceKind =
  | 'lexicon_ar'
  | 'lexicon_en'
  | 'physical_key_map'
  | 'script_mix'
  | 'short_token'
  | 'protected_span'
  | 'policy_disabled'
  | 'legacy_live_behavior'
  | 'sentence_stable'
  | 'paragraph_fallback'
  | 'layout_suspicion'
  | 'uncertainty'
  | 'technical_shape'
  | 'neighbor_context'
  | 'edit_distance'
  | 'user_override'
  | 'paste'
  | 'selection'
  | 'personal_vocab'
  | 'sequence_agreement'
  | 'language_plausibility'
  | 'mapping_coverage'
  | 'punctuation_compat'

export type Evidence = { kind: EvidenceKind; weight?: number }

export type LayoutSpanInference = {
  direction: 'en_on_ar' | 'ar_on_en'
  range: TextRange
  replacement: string
  sourceLayout: string
  targetLayout: string
  consecutiveCount: number
  mappingCoverage: number
  languagePlausibility: number
  lexiconBonus: number
  neighborAgreement: number
  heuristicScore: number
  risk: HypothesisRisk
  sourceChunkIds: string[]
}

export type FieldContext = {
  fieldId: string
  generation: number
  cycleId: string
  editorTier: EditorTier
  capabilities: { autoWrite: boolean; suggestion: boolean; manualShortcut: boolean }
  safetyAllowed: boolean
  safetyReason?: string
  composing: boolean
  mutexHeld: boolean
  translationSessionId: string | null
  hostname: string
  fieldKind: 'text' | 'textarea' | 'contenteditable' | 'unknown'
  helpStyle: 'auto' | 'suggestions' | 'shortcuts_only'
  assistantEnabled: boolean
  layoutAuto: boolean
  correctionEnabled: boolean
  aiAdvisorEnabled: boolean
  aiWritingReviewEnabled: boolean
  liveTranslation: boolean
  arabicToEnglishMode: boolean
  polishAfterTranslate: boolean
  cooldownActive: boolean
  textLength: number
  inputSource: InputSource
  selection: TextRange | null
}

export type WritingChunk = {
  id: string
  range: TextRange
  textHash: string
  scripts: { arabic: number; latin: number; other: number }
  origin: TextOrigin
  protectedKind: string | null
  layoutSuspicion: 'none' | 'en_on_ar' | 'ar_on_en' | 'shift_symbol_break'
  letterCount: number
  inExceptionList: boolean
  role: SpanRole
  inPersonalVocabulary: boolean
}

export type PendingLayoutRun = {
  direction: 'en_on_ar' | 'ar_on_en'
  consecutiveCount: number
}

export type AnalyzeOptions = {
  exceptions?: readonly string[]
  vocabularyHashes?: readonly string[]
  overrideRanges?: TextRange[]
  translatedRanges?: TextRange[]
  correctedRanges?: TextRange[]
  /** Live caret. When omitted, every token is treated as complete (snapshot mode). */
  caret?: number
  /** Blur / Enter commit: allow the token under the caret to finalize. */
  commitOpenToken?: boolean
  /** Prior cycle layout direction still in force for the next token. */
  pendingLayoutRun?: PendingLayoutRun | null
}

export type SharedAnalysis = {
  chunks: WritingChunk[]
  dominantOrigin: TextOrigin
  hasProtected: boolean
  hasArabizi: boolean
  hasLayoutSuspicion: boolean
  hasAmbiguousMixed: boolean
  scriptMix: { arabic: number; latin: number; other: number }
  layoutSpans: LayoutSpanInference[]
  /** Token the user is still editing. Null in snapshot mode or after commit. */
  openToken: TextRange | null
}

export type CandidateAction = {
  id: string
  capability: 'layout_fix' | 'translation' | 'english_correction'
  range: TextRange
  sourceChunkIds: string[]
  confidence: Confidence
  evidence: Evidence[]
  eligibleForAuto: boolean
  replacement?: string
}

export type WritingDecision = {
  decisionId: string
  cycleId: string
  fieldId: string
  generation: number
  action: DecisionAction
  trigger: DecisionTrigger
  winnerCandidateId: string | null
  range: TextRange | null
  confidence: Confidence
  reasonCodes: DecisionReasonCode[]
  textOrigin: TextOrigin
  blockedCandidateCapabilities: CandidateAction['capability'][]
  selectedIntent: WritingIntent | null
  winnerHypothesisId: string | null
  risk: HypothesisRisk
  llmUsed: boolean
  llmResult: LlmAdvisorResult
}

export type ComparisonClass =
  | 'same_decision'
  | 'legacy_write_new_noop'
  | 'legacy_noop_new_candidate'
  | 'different_action_type'
  | 'same_action_different_range'
  | 'blocked_by_policy'
  | 'unsupported_editor'
  | 'low_confidence_noop'
  | 'legacy_not_observable'

export type ShadowDecisionEvent = {
  shadow_only: true
  shadowOnly: true
  engine_version: typeof ENGINE_VERSION
  engineVersion: typeof ENGINE_VERSION
  feature_flag_key: typeof ENGINE_FLAG_KEY
  featureFlagKey: typeof ENGINE_FLAG_KEY
  feature_flag_variant: EngineMode
  featureFlagVariant: EngineMode
  timestamp: number
  cycleId: string
  fieldTier: EditorTier
  fieldKind: FieldContext['fieldKind']
  scriptMix: SharedAnalysis['scriptMix'] | null
  dominantOrigin: TextOrigin | null
  candidateTypes: CandidateAction['capability'][]
  decision: DecisionAction
  confidenceClass: ConfidenceClass
  reasonCodes: DecisionReasonCode[]
  comparison: ComparisonClass
  legacyObserved: 'not_observable'
  analyzed: boolean
}
