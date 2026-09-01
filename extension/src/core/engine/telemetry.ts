import { getEngineMode } from './flag.ts'
import { ENGINE_FLAG_KEY, ENGINE_VERSION, type ComparisonClass, type ShadowDecisionEvent } from './types.ts'
import type { CandidateAction, FieldContext, SharedAnalysis, WritingDecision } from './types.ts'

const MAX = 80
const events: ShadowDecisionEvent[] = []

export function classifyComparison(
  decision: WritingDecision,
  analyzed: boolean,
): ComparisonClass {
  if (decision.reasonCodes.includes('policy_shortcuts_only') || decision.reasonCodes.includes('protected_context')) {
    return 'blocked_by_policy'
  }
  if (decision.reasonCodes.includes('unsupported_editor')) return 'unsupported_editor'
  if (decision.reasonCodes.includes('low_confidence') || decision.reasonCodes.includes('ambiguous_short_token')) {
    return 'low_confidence_noop'
  }
  if (!analyzed) return 'blocked_by_policy'
  return 'legacy_not_observable'
}

export function recordShadowDecision(input: {
  context: FieldContext
  analysis: SharedAnalysis | null
  candidates: CandidateAction[]
  decision: WritingDecision
  analyzed: boolean
}): ShadowDecisionEvent {
  const event: ShadowDecisionEvent = {
    shadow_only: true,
    shadowOnly: true,
    engine_version: ENGINE_VERSION,
    engineVersion: ENGINE_VERSION,
    feature_flag_key: ENGINE_FLAG_KEY,
    featureFlagKey: ENGINE_FLAG_KEY,
    feature_flag_variant: getEngineMode(),
    featureFlagVariant: getEngineMode(),
    timestamp: Date.now(),
    cycleId: input.context.cycleId,
    fieldTier: input.context.editorTier,
    fieldKind: input.context.fieldKind,
    scriptMix: input.analysis?.scriptMix ?? null,
    dominantOrigin: input.analysis?.dominantOrigin ?? input.decision.textOrigin,
    candidateTypes: input.candidates.map((item) => item.capability),
    decision: input.decision.action,
    confidenceClass: input.decision.confidence.class,
    reasonCodes: input.decision.reasonCodes,
    comparison: classifyComparison(input.decision, input.analyzed),
    legacyObserved: 'not_observable',
    analyzed: input.analyzed,
  }
  events.push(event)
  if (events.length > MAX) events.splice(0, events.length - MAX)
  return event
}

export function getShadowDecisionSnapshot(): readonly ShadowDecisionEvent[] {
  return events.slice()
}

export function clearShadowDecisions(): void {
  events.length = 0
}
