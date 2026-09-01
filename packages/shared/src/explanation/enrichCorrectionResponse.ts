import type { CorrectionChange, CorrectionResponse } from '../correction/index.ts'
import {
  buildExplanationFromCorrectionChange,
  type ExplanationBuildOptions,
} from './fromCorrectionChange.ts'
import type { RuleExplanation } from './index.ts'
import { resolveExplanation } from './trustedRules/resolver.ts'

export type EnrichCorrectionExplanationsOptions = {
  practiceTargetIdForChange?: (change: CorrectionChange, index: number) => string | undefined
}

function buildOptionsForChange(
  change: CorrectionChange,
  index: number,
  options?: EnrichCorrectionExplanationsOptions,
): ExplanationBuildOptions | undefined {
  const practiceTargetId = options?.practiceTargetIdForChange?.(change, index)
  return practiceTargetId ? { practiceTargetId } : undefined
}

/**
 * Fail-safe explanation resolution for one change.
 * Never throws — returns undefined only when both resolver and pair fallback fail.
 */
export function resolveExplanationSafe(
  change: CorrectionChange,
  options?: ExplanationBuildOptions,
): RuleExplanation | undefined {
  try {
    return resolveExplanation(change, options)
  } catch {
    try {
      return buildExplanationFromCorrectionChange(change, options)
    } catch {
      return undefined
    }
  }
}

/**
 * Attach deterministic explanations to a correction response.
 * Does not mutate input. Preserves changes/originalText/correctedText exactly.
 * explanations[] aligns with changes[] when present.
 */
export function enrichCorrectionResponseWithExplanations(
  response: CorrectionResponse,
  options?: EnrichCorrectionExplanationsOptions,
): CorrectionResponse {
  if (!response.changes.length) return response

  const explanations: RuleExplanation[] = []
  for (let i = 0; i < response.changes.length; i++) {
    const change = response.changes[i]!
    const explanation = resolveExplanationSafe(
      change,
      buildOptionsForChange(change, i, options),
    )
    if (!explanation) return response
    explanations.push(explanation)
  }

  return {
    ...response,
    explanations,
  }
}
