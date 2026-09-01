import { describe, expect, it } from 'vitest'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import type { AdvisorProviderResult } from '../../../backend/src/providers/advisorTypes.ts'

function success(latencyMs = 100): AdvisorProviderResult {
  return {
    ok: true,
    provider: 'groq',
    model: 'test',
    rankedHypothesisIds: ['h1'],
    ambiguityClass: 'x',
    reasonCode: 'y',
    latencyMs,
  }
}

function failure(
  category: Exclude<AdvisorProviderResult, { ok: true }>['category'],
  cooldownMs?: number,
): AdvisorProviderResult {
  return {
    ok: false,
    provider: 'groq',
    model: 'test',
    category,
    retryable: false,
    fallbackEligible: category !== 'STALE_REQUEST',
    latencyMs: 50,
    cooldownMs,
  }
}

describe('provider health manager', () => {
  it('tracks success counts and latency percentiles', () => {
    const health = new ProviderHealthManager()
    health.register('groq', true)
    for (const latency of [100, 200, 300, 400]) {
      health.record('groq', success(latency))
    }

    expect(health.snapshot('groq')).toMatchObject({
      state: 'HEALTHY',
      successfulRequests: 4,
      recentLatencyMs: 400,
      p50LatencyMs: 200,
      p95LatencyMs: 400,
    })
  })

  it('opens a header-derived rate-limit cooldown and recovers after expiry', () => {
    let now = 1_000
    const health = new ProviderHealthManager(() => now)
    health.register('groq', true)
    health.record('groq', failure('RATE_LIMITED', 5_000))

    expect(health.isAvailable('groq')).toBe(false)
    expect(health.snapshot('groq')).toMatchObject({
      state: 'RATE_LIMITED',
      rateLimitCount: 1,
      cooldownUntil: 6_000,
    })

    now = 6_001
    expect(health.tryAcquire('groq')).toBe(true)
    expect(health.tryAcquire('groq')).toBe(false)
    expect(health.snapshot('groq').state).toBe('RECOVERING')
    health.record('groq', success())
    expect(health.snapshot('groq').state).toBe('HEALTHY')
  })

  it('increases repeated rate-limit cooldowns within a bounded ceiling', () => {
    let now = 0
    const health = new ProviderHealthManager(() => now)
    health.register('groq', true)

    health.record('groq', failure('RATE_LIMITED', 1_000))
    expect(health.snapshot('groq').cooldownUntil).toBe(1_000)
    now = 1_001
    expect(health.tryAcquire('groq')).toBe(true)
    health.record('groq', failure('RATE_LIMITED', 1_000))
    expect(health.snapshot('groq').cooldownUntil).toBe(3_001)

    for (let index = 0; index < 20; index += 1) {
      now = health.snapshot('groq').cooldownUntil! + 1
      expect(health.tryAcquire('groq')).toBe(true)
      health.record('groq', failure('RATE_LIMITED', 24 * 60 * 60 * 1000))
    }
    expect(health.snapshot('groq').cooldownUntil! - now)
      .toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })

  it('disables auth failures without retrying the same credentials', () => {
    const health = new ProviderHealthManager()
    health.register('groq', true)
    health.record('groq', failure('AUTH_FAILED'))

    expect(health.isAvailable('groq')).toBe(false)
    expect(health.snapshot('groq')).toMatchObject({
      state: 'UNAVAILABLE',
      authFailures: 1,
    })
  })

  it('degrades contract failures and ignores stale requests for health', () => {
    const health = new ProviderHealthManager()
    health.register('groq', true)
    health.record('groq', failure('CONTRACT_FAILURE'))
    expect(health.snapshot('groq')).toMatchObject({
      state: 'DEGRADED',
      invalidResponseCount: 1,
      consecutiveFailures: 1,
    })

    health.record('groq', failure('STALE_REQUEST'))
    expect(health.snapshot('groq').consecutiveFailures).toBe(1)
  })

  it('opens a temporary circuit after repeated server failures', () => {
    const health = new ProviderHealthManager(() => 10_000)
    health.register('groq', true)
    health.record('groq', failure('SERVER_ERROR'))
    health.record('groq', failure('SERVER_ERROR'))
    health.record('groq', failure('SERVER_ERROR'))

    expect(health.isAvailable('groq')).toBe(false)
    expect(health.snapshot('groq')).toMatchObject({
      state: 'UNAVAILABLE',
      consecutiveFailures: 3,
    })
  })

  it('bounds concurrent calls to one provider in a process', () => {
    const health = new ProviderHealthManager()
    health.register('groq', true)
    expect([
      health.tryAcquire('groq'),
      health.tryAcquire('groq'),
      health.tryAcquire('groq'),
      health.tryAcquire('groq'),
      health.tryAcquire('groq'),
    ]).toEqual([true, true, true, true, false])
    health.record('groq', success())
    expect(health.tryAcquire('groq')).toBe(true)
  })
})
