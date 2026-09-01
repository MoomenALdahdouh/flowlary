import type {
  AdvisorProviderErrorCategory,
  AdvisorProviderFailure,
  AdvisorProviderId,
  AdvisorProviderResult,
  AdvisorTokenUsage,
} from './advisorTypes.ts'

const ALLOWED_FIELDS = new Set(['rankedHypothesisIds', 'ambiguityClass', 'reasonCode'])
const FORBIDDEN_FIELD_PATTERN =
  /(replacement|text|write|html|mutation|command|dom|inputvalue|setrangetext|execcommand)/i
const FORBIDDEN_INSTRUCTION_PATTERN =
  /(setrangetext|execcommand|innerhtml|outerhtml|inserttext|replace(?:ment)?\s*(?:text|value)|dom\s*(?:write|mutation))/i
const SAFE_CODE_PATTERN = /^[a-zA-Z0-9_.:-]{1,64}$/

type ValidationMetadata = {
  provider: AdvisorProviderId
  model: string
  latencyMs: number
  usage?: AdvisorTokenUsage
  finishReason?: string
  providerRequestId?: string
}

function failure(
  category: AdvisorProviderErrorCategory,
  metadata: ValidationMetadata,
): AdvisorProviderFailure {
  return {
    ok: false,
    ...metadata,
    category,
    retryable: false,
    fallbackEligible: category !== 'STALE_REQUEST',
  }
}

export function validateAdvisorProviderContent(
  content: string | null | undefined,
  allowedIds: ReadonlySet<string>,
  metadata: ValidationMetadata,
): AdvisorProviderResult {
  if (!content?.trim()) {
    return failure('CONTRACT_FAILURE', metadata)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return failure('CONTRACT_FAILURE', metadata)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return failure('CONTRACT_FAILURE', metadata)
  }

  const value = parsed as Record<string, unknown>
  const keys = Object.keys(value)
  if (
    keys.some((key) => FORBIDDEN_FIELD_PATTERN.test(key))
    || keys.some((key) => !ALLOWED_FIELDS.has(key))
  ) {
    return failure('CONTRACT_FAILURE', metadata)
  }

  if (
    !Array.isArray(value.rankedHypothesisIds)
    || value.rankedHypothesisIds.length === 0
    || value.rankedHypothesisIds.some((id) => typeof id !== 'string')
    || typeof value.ambiguityClass !== 'string'
    || typeof value.reasonCode !== 'string'
    || !SAFE_CODE_PATTERN.test(value.ambiguityClass)
    || !SAFE_CODE_PATTERN.test(value.reasonCode)
    || FORBIDDEN_INSTRUCTION_PATTERN.test(value.ambiguityClass)
    || FORBIDDEN_INSTRUCTION_PATTERN.test(value.reasonCode)
  ) {
    return failure('CONTRACT_FAILURE', metadata)
  }

  const rankedHypothesisIds = value.rankedHypothesisIds as string[]
  const uniqueIds = new Set(rankedHypothesisIds)
  if (
    uniqueIds.size !== rankedHypothesisIds.length
    || rankedHypothesisIds.some((id) => !allowedIds.has(id))
  ) {
    return failure('CONTRACT_FAILURE', metadata)
  }

  return {
    ok: true,
    ...metadata,
    rankedHypothesisIds,
    ambiguityClass: value.ambiguityClass,
    reasonCode: value.reasonCode,
  }
}
