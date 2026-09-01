import { ProviderHealthManager } from '../health/providerHealth.ts'
import type { AdvisorProviderErrorCategory, AdvisorProviderFailure, AdvisorProviderId, AdvisorRequestOptions } from './advisorTypes.ts'
import type {
  WritingReviewManagerResult,
  WritingReviewPacket,
  WritingReviewProvider,
  WritingReviewProviderResult,
} from './writingReviewTypes.ts'

const HARD_MAX_PROVIDERS_PER_REQUEST = 3

function unavailable(
  options: AdvisorRequestOptions,
  attempts: WritingReviewManagerResult['attempts'],
  fallbackUsed: boolean,
  fallbackReason?: AdvisorProviderErrorCategory,
  category?: AdvisorProviderErrorCategory,
): WritingReviewManagerResult {
  const failure: AdvisorProviderFailure = {
    ok: false,
    provider: 'none',
    model: 'none',
    category: options.signal?.aborted
      ? 'STALE_REQUEST'
      : category ?? 'PROVIDER_UNAVAILABLE',
    retryable: false,
    fallbackEligible: false,
    latencyMs: 0,
  }
  return {
    ...failure,
    fallbackUsed,
    fallbackReason,
    localDecisionAuthoritative: true,
    attempts,
  }
}

export class WritingReviewProviderManager {
  private readonly providers: readonly WritingReviewProvider[]
  private readonly providerBudgets = new Map<AdvisorProviderId, { windowStart: number; count: number }>()

  constructor(
    providers: readonly WritingReviewProvider[],
    private readonly healthManager: ProviderHealthManager,
    private readonly now: () => number = Date.now,
    private readonly maxTokensByProvider: Readonly<Partial<Record<AdvisorProviderId, number>>> = {},
    private readonly fallbackMinRemainingMs = 1,
    maxProviderAttempts = HARD_MAX_PROVIDERS_PER_REQUEST,
    private readonly requestsPerMinuteByProvider: Readonly<Partial<Record<AdvisorProviderId, number>>> = {},
  ) {
    this.providers = providers.slice(
      0,
      Math.min(HARD_MAX_PROVIDERS_PER_REQUEST, Math.max(1, maxProviderAttempts)),
    )
    for (const provider of this.providers) {
      this.healthManager.register(provider.id, true)
    }
  }

  async reviewWriting(
    packet: WritingReviewPacket,
    options: AdvisorRequestOptions,
  ): Promise<WritingReviewManagerResult> {
    const deadline = Math.min(options.deadlineAt, this.now() + options.timeoutMs)
    const attempts: WritingReviewManagerResult['attempts'] = []
    let fallbackReason: AdvisorProviderErrorCategory | undefined
    let fallbackUsed = false

    for (let index = 0; index < this.providers.length; index += 1) {
      const provider = this.providers[index]!
      if (options.signal?.aborted) {
        return unavailable(options, attempts, fallbackUsed, fallbackReason)
      }
      const remainingMs = deadline - this.now()
      if (remainingMs <= 0 || (index > 0 && remainingMs < this.fallbackMinRemainingMs)) {
        fallbackReason ??= 'TIMEOUT'
        break
      }
      if (
        !this.hasCapabilities(provider, options.requiredCapabilities)
        || !this.withinProviderBudget(provider.id)
        || !this.healthManager.tryAcquire(provider.id)
      ) {
        if (index === 0) fallbackReason = 'PROVIDER_UNAVAILABLE'
        continue
      }

      let result: WritingReviewProviderResult
      try {
        result = await provider.reviewWriting(packet, {
          ...options,
          deadlineAt: deadline,
          timeoutMs: remainingMs,
          maxTokens: this.maxTokensByProvider[provider.id] ?? options.maxTokens,
        })
      } catch {
        result = {
          ok: false,
          provider: provider.id,
          model: provider.model,
          category: 'UNKNOWN',
          retryable: false,
          fallbackEligible: true,
          latencyMs: 0,
        }
      }
      if (index > 0) fallbackUsed = true
      this.healthManager.record(provider.id, result)
      attempts.push({
        provider: provider.id,
        model: result.model,
        result: result.ok ? 'SUCCESS' : result.category,
        latencyMs: result.latencyMs,
        cooldownMs: result.ok ? undefined : result.cooldownMs,
        providerRequestId: result.providerRequestId,
        finishReason: result.finishReason,
        usage: result.usage,
      })

      if (result.ok) {
        return {
          ...result,
          fallbackUsed: index > 0,
          fallbackReason,
          attempts,
        }
      }

      if (index === 0) fallbackReason = result.category
      if (!result.fallbackEligible || result.category === 'STALE_REQUEST') {
        return {
          ...result,
          fallbackUsed: index > 0,
          fallbackReason,
          localDecisionAuthoritative: true,
          attempts,
        }
      }
    }

    return unavailable(
      options,
      attempts,
      fallbackUsed,
      fallbackReason,
      deadline <= this.now() || fallbackReason === 'TIMEOUT' ? 'TIMEOUT' : undefined,
    )
  }

  private hasCapabilities(
    provider: WritingReviewProvider,
    required: readonly string[],
  ): boolean {
    const capabilities = new Set(provider.capabilities)
    return required.every((capability) => capabilities.has(capability))
  }

  private withinProviderBudget(provider: AdvisorProviderId): boolean {
    const limit = this.requestsPerMinuteByProvider[provider]
    if (!limit || limit <= 0) return true
    const now = this.now()
    const budget = this.providerBudgets.get(provider)
    if (!budget || now - budget.windowStart >= 60_000) {
      this.providerBudgets.set(provider, { windowStart: now, count: 1 })
      return true
    }
    if (budget.count >= limit) return false
    budget.count += 1
    return true
  }
}
