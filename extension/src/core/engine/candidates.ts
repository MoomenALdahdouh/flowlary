/**
 * Candidates derived from span-level hypotheses. Local evidence only.
 */
import { isDirectHelpStyle } from '../policy/writingPolicy.ts'
import type { CandidateAction, FieldContext, Hypothesis, SharedAnalysis } from './types.ts'
import { collectHypotheses } from './hypotheses.ts'

function translationEligibleForAuto(
  context: FieldContext | undefined,
  capability: NonNullable<Hypothesis['candidateAction']>,
): boolean {
  if (capability !== 'translation') {
    return context?.capabilities.autoWrite !== false
  }
  if (context?.capabilities.autoWrite === true) return true
  return context?.editorTier === 2 && context.safetyAllowed === true
}

export function candidatesFromHypotheses(
  hypotheses: Hypothesis[],
  context?: FieldContext,
): CandidateAction[] {
  return hypotheses
    .filter((item) => item.candidateAction)
    .map((item) => {
      const high = item.localScore >= 0.8 && item.risk === 'low' && !item.needsLLM
      const short = item.evidence.some((entry) => entry.kind === 'short_token')
      return {
        id: item.id,
        capability: item.candidateAction!,
        range: item.span,
        sourceChunkIds: item.sourceChunkIds,
        confidence: {
          score: item.localScore,
          class: high ? 'high' : short ? 'ambiguous' : item.localScore >= 0.55 ? 'medium' : 'low',
        },
        evidence: item.evidence,
        eligibleForAuto:
          high
          && Boolean(item.replacement || item.candidateAction === 'translation')
          && (item.candidateAction !== 'english_correction' || isDirectHelpStyle())
          && translationEligibleForAuto(context, item.candidateAction!),
        replacement: item.replacement,
      }
    })
}

export function collectShadowCandidates(
  text: string,
  caret: number,
  context: FieldContext,
  analysis: SharedAnalysis,
): CandidateAction[] {
  return candidatesFromHypotheses(collectHypotheses(text, caret, context, analysis))
}
