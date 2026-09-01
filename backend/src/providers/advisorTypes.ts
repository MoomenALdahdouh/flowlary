export type AdvisorProviderId = 'groq' | 'gemini' | 'openrouter' | (string & {})
export const ADVISOR_CONTRACT_VERSION = '1'

export type AdvisorProviderCapability =
  | 'hypothesis_ranking'
  | 'writing_review'
  | 'structured_json'
  | 'id_only_output'
  | 'arabic'

export type ProviderErrorCode =
  | 'RATE_LIMITED'
  | 'QUOTA_EXHAUSTED'
  | 'TIMEOUT'
  | 'AUTH_FAILED'
  | 'INVALID_REQUEST'
  | 'CONTRACT_FAILURE'
  | 'NETWORK_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'STALE_REQUEST'
  | 'UNKNOWN'

/** @deprecated Use ProviderErrorCode. */
export type AdvisorProviderErrorCategory = ProviderErrorCode

export type ProviderAvailabilityState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'DISABLED'
  | 'RECOVERING'

export type AdvisorTokenUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  estimatedCostUsd?: number
}

export type AdvisorPacket = {
  cycleId: string
  snippet: string
  allowedIntents: string[]
  hypotheses: Array<{
    id: string
    intent: string
    localScore: number
    risk: string
    needsLLM: boolean
    conflicts: string[]
    evidence: string[]
  }>
}

export type AdvisorRequestOptions = {
  requestId: string
  signal?: AbortSignal
  /** Absolute wall-clock boundary for the complete advisor event. */
  deadlineAt: number
  timeoutMs: number
  maxTokens: number
  contractVersion: string
  requiredCapabilities: readonly AdvisorProviderCapability[]
}

export type AdvisorProviderSuccess = {
  ok: true
  provider: AdvisorProviderId
  model: string
  rankedHypothesisIds: string[]
  ambiguityClass: string
  reasonCode: string
  latencyMs: number
  usage?: AdvisorTokenUsage
  finishReason?: string
  providerRequestId?: string
}

export type AdvisorProviderFailure = {
  ok: false
  provider: AdvisorProviderId
  model: string
  category: AdvisorProviderErrorCategory
  retryable: boolean
  fallbackEligible: boolean
  latencyMs: number
  cooldownMs?: number
  usage?: AdvisorTokenUsage
  finishReason?: string
  providerRequestId?: string
}

export type AdvisorProviderResult = AdvisorProviderSuccess | AdvisorProviderFailure

export type ProviderHealthSnapshot = {
  provider: AdvisorProviderId
  state: ProviderAvailabilityState
  enabled: boolean
  consecutiveFailures: number
  successfulRequests: number
  rateLimitCount: number
  invalidResponseCount: number
  timeoutCount: number
  authFailures: number
  budgetFailures: number
  recentLatencyMs?: number
  p50LatencyMs?: number
  p95LatencyMs?: number
  lastSuccessAt?: number
  lastFailureAt?: number
  cooldownUntil?: number
  failureReason?: ProviderErrorCode
}

export type ProviderAvailability = {
  available: boolean
  state: ProviderAvailabilityState
  cooldownUntil?: number
}

export interface AIAdvisorProvider {
  readonly id: AdvisorProviderId
  readonly model: string
  readonly capabilities: readonly AdvisorProviderCapability[]
  readonly enabled: boolean

  rankHypotheses(
    packet: AdvisorPacket,
    options: AdvisorRequestOptions,
  ): Promise<AdvisorProviderResult>

  health(): ProviderHealthSnapshot
  availability(): ProviderAvailability
}

/** @deprecated Use AIAdvisorProvider. */
export type HypothesisAdvisorProvider = AIAdvisorProvider

type AdvisorManagerMetadata = {
  fallbackUsed: boolean
  fallbackReason?: AdvisorProviderErrorCategory
  localDecisionAuthoritative?: boolean
  attempts: Array<{
    provider: AdvisorProviderId
    model: string
    result: 'SUCCESS' | AdvisorProviderErrorCategory
    latencyMs: number
    cooldownMs?: number
    providerRequestId?: string
    finishReason?: string
    usage?: AdvisorTokenUsage
  }>
}

export type AdvisorManagerResult =
  | (AdvisorProviderSuccess & AdvisorManagerMetadata)
  | (AdvisorProviderFailure & AdvisorManagerMetadata)

export type AdvisorManagerFailure = AdvisorProviderFailure & AdvisorManagerMetadata

export class AdvisorProviderFailureError extends Error {
  constructor(readonly result: AdvisorManagerFailure) {
    super(result.category)
    this.name = 'AdvisorProviderFailureError'
  }
}
