import { parseWritingReviewContent } from '@flowlary/shared'
import type { AdvisorProviderFailure, AdvisorProviderId, AdvisorTokenUsage } from './advisorTypes.ts'
import type { WritingReviewProviderResult } from './writingReviewTypes.ts'

type ValidationMetadata = {
  provider: AdvisorProviderId
  model: string
  latencyMs: number
  usage?: AdvisorTokenUsage
  finishReason?: string
  providerRequestId?: string
}

function failure(
  metadata: ValidationMetadata,
): AdvisorProviderFailure {
  return {
    ok: false,
    ...metadata,
    category: 'CONTRACT_FAILURE',
    retryable: false,
    fallbackEligible: true,
  }
}

export function validateWritingReviewProviderContent(
  content: string | null | undefined,
  snippet: string,
  metadata: ValidationMetadata,
): WritingReviewProviderResult {
  const parsed = parseWritingReviewContent(content, snippet)
  if (!parsed.ok) return failure(metadata)
  return {
    ok: true,
    ...metadata,
    verdict: parsed.value.verdict,
    ambiguityClass: parsed.value.ambiguityClass,
    reasonCode: parsed.value.reasonCode,
    edits: parsed.value.edits,
  }
}
