import { describe, expect, it, vi } from 'vitest'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import { AdvisorProviderManager } from '../../../backend/src/providers/advisorProviderManager.ts'
import type {
  AdvisorPacket,
  AdvisorProviderResult,
  AdvisorRequestOptions,
  HypothesisAdvisorProvider,
} from '../../../backend/src/providers/advisorTypes.ts'

const packet: AdvisorPacket = {
  cycleId: 'cycle-1',
  snippet: 'test',
  allowedIntents: ['preserve'],
  hypotheses: [{
    id: 'h1',
    intent: 'preserve',
    localScore: 0.5,
    risk: 'low',
    needsLLM: true,
    conflicts: [],
    evidence: [],
  }],
}

const options: AdvisorRequestOptions = {
  requestId: 'request-1',
  deadlineAt: Number.MAX_SAFE_INTEGER,
  timeoutMs: 1_500,
  maxTokens: 180,
  contractVersion: '1',
  requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
}

function success(provider: string): AdvisorProviderResult {
  return {
    ok: true,
    provider,
    model: `${provider}-model`,
    rankedHypothesisIds: ['h1'],
    ambiguityClass: 'test',
    reasonCode: 'test',
    latencyMs: 10,
  }
}

function failure(
  provider: string,
  category: Exclude<AdvisorProviderResult, { ok: true }>['category'],
  fallbackEligible = true,
): AdvisorProviderResult {
  return {
    ok: false,
    provider,
    model: `${provider}-model`,
    category,
    retryable: false,
    fallbackEligible,
    latencyMs: 10,
  }
}

function provider(
  id: string,
  implementation: (options: AdvisorRequestOptions) => Promise<AdvisorProviderResult>,
  enabled = true,
): HypothesisAdvisorProvider {
  return {
    id,
    model: `${id}-model`,
    enabled,
    capabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output', 'arabic'],
    rankHypotheses: vi.fn((_packet, requestOptions) => implementation(requestOptions)),
    health: () => ({
      provider: id,
      state: enabled ? 'HEALTHY' : 'DISABLED',
      enabled,
      consecutiveFailures: 0,
      successfulRequests: 0,
      rateLimitCount: 0,
      invalidResponseCount: 0,
      timeoutCount: 0,
      authFailures: 0,
      budgetFailures: 0,
    }),
    availability: () => ({
      available: enabled,
      state: enabled ? 'HEALTHY' : 'DISABLED',
    }),
  }
}

describe('advisor provider manager', () => {
  it('stops after primary success', async () => {
    const primary = provider('groq', async () => success('groq'))
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )

    const result = await manager.rankHypotheses(packet, options)
    expect(result).toMatchObject({
      ok: true,
      provider: 'groq',
      fallbackUsed: false,
    })
    expect(primary.rankHypotheses).toHaveBeenCalledOnce()
    expect(fallback.rankHypotheses).not.toHaveBeenCalled()
  })

  it('does not fallback from any valid answer for quality or confirmation', async () => {
    const primary = provider('groq', async () => ({
      ...success('groq'),
      ambiguityClass: 'low_confidence',
      reasonCode: 'preserve',
    }))
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )

    expect(await manager.rankHypotheses(packet, options))
      .toMatchObject({ ok: true, provider: 'groq', reasonCode: 'preserve' })
    expect(fallback.rankHypotheses).not.toHaveBeenCalled()
  })

  it.each([
    'RATE_LIMITED',
    'QUOTA_EXHAUSTED',
    'TIMEOUT',
    'SERVER_ERROR',
    'PROVIDER_UNAVAILABLE',
    'NETWORK_ERROR',
    'CONTRACT_FAILURE',
    'INVALID_REQUEST',
  ] as const)('uses one fallback after primary %s', async (category) => {
    const primary = provider('groq', async () => failure('groq', category))
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )

    const result = await manager.rankHypotheses(packet, options)
    expect(result).toMatchObject({
      ok: true,
      provider: 'gemini',
      fallbackUsed: true,
      fallbackReason: category,
    })
    expect(result.attempts).toHaveLength(2)
  })

  it('does not fallback after caller abort', async () => {
    const controller = new AbortController()
    const primary = provider('groq', async () => {
      controller.abort()
      return failure('groq', 'STALE_REQUEST', false)
    })
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )

    const result = await manager.rankHypotheses(packet, {
      ...options,
      signal: controller.signal,
    })
    expect(result).toMatchObject({ ok: false, category: 'STALE_REQUEST' })
    expect(fallback.rankHypotheses).not.toHaveBeenCalled()
  })

  it('does not fallback when the request becomes stale during the primary call', async () => {
    const controller = new AbortController()
    const primary = provider('groq', async () => {
      controller.abort()
      return failure('groq', 'SERVER_ERROR')
    })
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )

    const result = await manager.rankHypotheses(packet, {
      ...options,
      signal: controller.signal,
    })
    expect(result).toMatchObject({ ok: false, category: 'STALE_REQUEST' })
    expect(fallback.rankHypotheses).not.toHaveBeenCalled()
  })

  it('skips a primary in cooldown and calls only the fallback', async () => {
    let now = 1_000
    const health = new ProviderHealthManager(() => now)
    const primary = provider('groq', async () => success('groq'))
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager([primary, fallback], health, () => now)
    health.record('groq', {
      ...failure('groq', 'RATE_LIMITED'),
      cooldownMs: 10_000,
    })

    const result = await manager.rankHypotheses(packet, options)
    expect(result).toMatchObject({
      ok: true,
      provider: 'gemini',
      fallbackUsed: true,
      fallbackReason: 'PROVIDER_UNAVAILABLE',
    })
    expect(primary.rankHypotheses).not.toHaveBeenCalled()
  })

  it('never registers or calls more than three providers', async () => {
    const first = provider('one', async () => failure('one', 'SERVER_ERROR'))
    const second = provider('two', async () => failure('two', 'SERVER_ERROR'))
    const third = provider('three', async () => failure('three', 'SERVER_ERROR'))
    const fourth = provider('four', async () => success('four'))
    const manager = new AdvisorProviderManager(
      [first, second, third, fourth],
      new ProviderHealthManager(),
    )

    const result = await manager.rankHypotheses(packet, options)
    expect(result.ok).toBe(false)
    expect(result.attempts).toHaveLength(3)
    expect(third.rankHypotheses).toHaveBeenCalledOnce()
    expect(fourth.rankHypotheses).not.toHaveBeenCalled()
  })

  it('calls providers sequentially and never retries either provider', async () => {
    let activeCalls = 0
    let overlapDetected = false
    const primary = provider('groq', async () => {
      activeCalls += 1
      await Promise.resolve()
      activeCalls -= 1
      return failure('groq', 'SERVER_ERROR')
    })
    const fallback = provider('gemini', async () => {
      if (activeCalls > 0) overlapDetected = true
      activeCalls += 1
      await Promise.resolve()
      activeCalls -= 1
      return failure('gemini', 'SERVER_ERROR')
    })
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )

    const result = await manager.rankHypotheses(packet, options)
    expect(result.attempts).toHaveLength(2)
    expect(overlapDetected).toBe(false)
    expect(primary.rankHypotheses).toHaveBeenCalledOnce()
    expect(fallback.rankHypotheses).toHaveBeenCalledOnce()
  })

  it('does not start fallback when the absolute deadline lacks safe time', async () => {
    let now = 0
    const primary = provider('groq', async () => {
      now = 1_450
      return failure('groq', 'TIMEOUT')
    })
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(() => now),
      () => now,
      {},
      100,
    )

    const result = await manager.rankHypotheses(packet, {
      ...options,
      deadlineAt: 1_500,
    })
    expect(result).toMatchObject({ ok: false, category: 'TIMEOUT' })
    expect(primary.rankHypotheses).toHaveBeenCalledOnce()
    expect(fallback.rankHypotheses).not.toHaveBeenCalled()
  })

  it('normalizes an adapter crash and uses at most one fallback', async () => {
    const primary = provider('groq', async () => {
      throw new Error('provider internals')
    })
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )

    const result = await manager.rankHypotheses(packet, options)
    expect(result).toMatchObject({
      ok: true,
      provider: 'gemini',
      fallbackReason: 'UNKNOWN',
    })
    expect(result.attempts).toHaveLength(2)
  })

  it('enforces a provider-specific RPM budget without looping back', async () => {
    let now = 1_000
    const primary = provider('groq', async () => success('groq'))
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new AdvisorProviderManager(
      [primary, fallback],
      new ProviderHealthManager(() => now),
      () => now,
      {},
      1,
      3,
      { groq: 1, gemini: 2 },
    )

    expect(await manager.rankHypotheses(packet, options))
      .toMatchObject({ ok: true, provider: 'groq' })
    expect(await manager.rankHypotheses(packet, options))
      .toMatchObject({ ok: true, provider: 'gemini', fallbackUsed: true })
    expect(primary.rankHypotheses).toHaveBeenCalledOnce()
    expect(fallback.rankHypotheses).toHaveBeenCalledOnce()
    now += 60_001
    expect(await manager.rankHypotheses(packet, options))
      .toMatchObject({ ok: true, provider: 'groq' })
  })
})
