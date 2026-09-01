import type {
  AdvisorProviderId,
  ProviderAvailabilityState,
  ProviderHealthSnapshot,
} from '../providers/advisorTypes.ts'

const MAX_LATENCY_SAMPLES = 100
const TEMPORARY_FAILURE_THRESHOLD = 3
const INVALID_RESPONSE_THRESHOLD = 3
const DEFAULT_UNAVAILABLE_COOLDOWN_MS = 30_000
const DEFAULT_INVALID_COOLDOWN_MS = 15_000
const MAX_RATE_LIMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000
const DEFAULT_QUOTA_COOLDOWN_MS = 5 * 60 * 1000
const MAX_CONCURRENT_REQUESTS_PER_PROVIDER = 4

type MutableProviderHealth = {
  provider: AdvisorProviderId
  state: ProviderAvailabilityState
  enabled: boolean
  consecutiveFailures: number
  successfulRequests: number
  rateLimitCount: number
  consecutiveRateLimits: number
  invalidResponseCount: number
  timeoutCount: number
  authFailures: number
  budgetFailures: number
  recoverySuccesses: number
  recoveryProbeInFlight: boolean
  inFlight: number
  latencySamples: number[]
  recentLatencyMs?: number
  lastSuccessAt?: number
  lastFailureAt?: number
  cooldownUntil?: number
  failureReason?: import('../providers/advisorTypes.ts').ProviderErrorCode
}

function percentile(values: readonly number[], p: number): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  )
  return sorted[index]
}

export class ProviderHealthManager {
  private readonly records = new Map<AdvisorProviderId, MutableProviderHealth>()

  constructor(private readonly now: () => number = Date.now) {}

  register(provider: AdvisorProviderId, enabled: boolean): void {
    const existing = this.records.get(provider)
    if (existing) {
      existing.enabled = enabled
      existing.state = enabled ? 'HEALTHY' : 'DISABLED'
      if (!enabled) existing.cooldownUntil = undefined
      return
    }
    this.records.set(provider, {
      provider,
      state: enabled ? 'HEALTHY' : 'DISABLED',
      enabled,
      consecutiveFailures: 0,
      successfulRequests: 0,
      rateLimitCount: 0,
      consecutiveRateLimits: 0,
      invalidResponseCount: 0,
      timeoutCount: 0,
      authFailures: 0,
      budgetFailures: 0,
      recoverySuccesses: 0,
      recoveryProbeInFlight: false,
      inFlight: 0,
      latencySamples: [],
    })
  }

  setEnabled(provider: AdvisorProviderId, enabled: boolean): void {
    this.ensure(provider).enabled = enabled
    const record = this.ensure(provider)
    record.state = enabled ? 'HEALTHY' : 'DISABLED'
    record.consecutiveFailures = 0
    record.recoverySuccesses = 0
    record.cooldownUntil = undefined
    record.recoveryProbeInFlight = false
    record.inFlight = 0
  }

  isAvailable(provider: AdvisorProviderId): boolean {
    const record = this.ensure(provider)
    if (!record.enabled || record.state === 'DISABLED') return false
    if (record.state === 'UNAVAILABLE' && record.authFailures > 0 && !record.cooldownUntil) {
      return false
    }
    if (record.cooldownUntil && record.cooldownUntil > this.now()) return false
    if (
      record.cooldownUntil
      && record.cooldownUntil <= this.now()
      && (record.state === 'RATE_LIMITED' || record.state === 'UNAVAILABLE')
    ) {
      record.state = 'RECOVERING'
      record.recoverySuccesses = 0
      record.cooldownUntil = undefined
    }
    return true
  }

  /**
   * Reserves provider capacity for one call. RECOVERING providers permit exactly
   * one in-flight probe until its result is recorded.
   */
  tryAcquire(provider: AdvisorProviderId): boolean {
    if (!this.isAvailable(provider)) return false
    const record = this.ensure(provider)
    if (record.inFlight >= MAX_CONCURRENT_REQUESTS_PER_PROVIDER) return false
    if (record.state !== 'RECOVERING') {
      record.inFlight += 1
      return true
    }
    if (record.recoveryProbeInFlight) return false
    record.recoveryProbeInFlight = true
    record.inFlight += 1
    return true
  }

  record(provider: AdvisorProviderId, result: {
    ok: boolean
    category?: import('../providers/advisorTypes.ts').ProviderErrorCode
    latencyMs: number
    cooldownMs?: number
  }): void {
    const record = this.ensure(provider)
    record.recoveryProbeInFlight = false
    record.inFlight = Math.max(0, record.inFlight - 1)
    this.recordLatency(record, result.latencyMs)
    const at = this.now()

    if (result.ok) {
      record.successfulRequests += 1
      record.consecutiveFailures = 0
      record.consecutiveRateLimits = 0
      record.lastSuccessAt = at
      record.failureReason = undefined
      record.cooldownUntil = undefined
      if (record.state === 'RECOVERING') {
        record.recoverySuccesses += 1
        record.state = 'HEALTHY'
      } else {
        record.recoverySuccesses = 0
        record.state = 'HEALTHY'
      }
      return
    }

    record.consecutiveFailures += 1
    if (result.category !== 'RATE_LIMITED') record.consecutiveRateLimits = 0
    record.lastFailureAt = at
    record.failureReason = result.category

    switch (result.category) {
      case 'RATE_LIMITED':
        record.rateLimitCount += 1
        record.consecutiveRateLimits += 1
        record.state = 'RATE_LIMITED'
        record.cooldownUntil = at + Math.min(
          MAX_RATE_LIMIT_COOLDOWN_MS,
          Math.max(1, result.cooldownMs ?? DEFAULT_UNAVAILABLE_COOLDOWN_MS)
            * (2 ** Math.min(4, record.consecutiveRateLimits - 1)),
        )
        return
      case 'AUTH_FAILED':
        record.authFailures += 1
        record.state = 'UNAVAILABLE'
        record.cooldownUntil = undefined
        return
      case 'QUOTA_EXHAUSTED':
        record.budgetFailures += 1
        record.state = 'UNAVAILABLE'
        record.cooldownUntil = at + Math.max(1, result.cooldownMs ?? DEFAULT_QUOTA_COOLDOWN_MS)
        return
      case 'TIMEOUT':
        record.timeoutCount += 1
        this.recordTemporaryFailure(record, result.cooldownMs)
        return
      case 'CONTRACT_FAILURE':
      case 'INVALID_REQUEST':
        record.invalidResponseCount += 1
        record.state = 'DEGRADED'
        if (record.consecutiveFailures >= INVALID_RESPONSE_THRESHOLD) {
          record.state = 'UNAVAILABLE'
          record.cooldownUntil = at + (result.cooldownMs ?? DEFAULT_INVALID_COOLDOWN_MS)
        }
        return
      case 'SERVER_ERROR':
      case 'PROVIDER_UNAVAILABLE':
      case 'NETWORK_ERROR':
      case 'UNKNOWN':
        this.recordTemporaryFailure(record, result.cooldownMs)
        return
      case 'STALE_REQUEST':
        record.consecutiveFailures = Math.max(0, record.consecutiveFailures - 1)
        record.failureReason = undefined
        return
    }
  }

  snapshot(provider: AdvisorProviderId): ProviderHealthSnapshot {
    this.isAvailable(provider)
    const record = this.ensure(provider)
    return {
      provider,
      state: record.state,
      enabled: record.enabled,
      consecutiveFailures: record.consecutiveFailures,
      successfulRequests: record.successfulRequests,
      rateLimitCount: record.rateLimitCount,
      invalidResponseCount: record.invalidResponseCount,
      timeoutCount: record.timeoutCount,
      authFailures: record.authFailures,
      budgetFailures: record.budgetFailures,
      recentLatencyMs: record.recentLatencyMs,
      p50LatencyMs: percentile(record.latencySamples, 50),
      p95LatencyMs: percentile(record.latencySamples, 95),
      lastSuccessAt: record.lastSuccessAt,
      lastFailureAt: record.lastFailureAt,
      cooldownUntil: record.cooldownUntil,
      failureReason: record.failureReason,
    }
  }

  reset(): void {
    this.records.clear()
  }

  private ensure(provider: AdvisorProviderId): MutableProviderHealth {
    const record = this.records.get(provider)
    if (record) return record
    this.register(provider, false)
    return this.records.get(provider)!
  }

  private recordLatency(record: MutableProviderHealth, latencyMs: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return
    record.recentLatencyMs = latencyMs
    record.latencySamples.push(latencyMs)
    if (record.latencySamples.length > MAX_LATENCY_SAMPLES) {
      record.latencySamples.splice(0, record.latencySamples.length - MAX_LATENCY_SAMPLES)
    }
  }

  private recordTemporaryFailure(
    record: MutableProviderHealth,
    cooldownMs?: number,
  ): void {
    record.state = 'DEGRADED'
    if (record.consecutiveFailures >= TEMPORARY_FAILURE_THRESHOLD) {
      record.state = 'UNAVAILABLE'
      record.cooldownUntil =
        this.now() + Math.max(1, cooldownMs ?? DEFAULT_UNAVAILABLE_COOLDOWN_MS)
    }
  }
}
