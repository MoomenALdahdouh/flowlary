import { describe, expect, it, vi } from 'vitest'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import { WritingReviewProviderManager } from '../../../backend/src/providers/writingReviewProviderManager.ts'
import type {
  WritingReviewPacket,
  WritingReviewProvider,
  WritingReviewProviderResult,
} from '../../../backend/src/providers/writingReviewTypes.ts'
import type { AdvisorRequestOptions } from '../../../backend/src/providers/advisorTypes.ts'

const packet: WritingReviewPacket = {
  cycleId: 'cycle-1',
  snippet: 'hello comming',
  allowedKinds: ['spelling', 'grammar', 'punctuation'],
}

const options: AdvisorRequestOptions = {
  requestId: 'request-1',
  deadlineAt: Number.MAX_SAFE_INTEGER,
  timeoutMs: 1_500,
  maxTokens: 256,
  contractVersion: '1',
  requiredCapabilities: ['writing_review', 'structured_json'],
}

function success(provider: string): WritingReviewProviderResult {
  return {
    ok: true,
    provider,
    model: `${provider}-model`,
    verdict: 'no_change',
    ambiguityClass: 'ok',
    reasonCode: 'no_change',
    edits: [],
    latencyMs: 10,
  }
}

function failure(
  provider: string,
  category: Exclude<WritingReviewProviderResult, { ok: true }>['category'],
): WritingReviewProviderResult {
  return {
    ok: false,
    provider,
    model: `${provider}-model`,
    category,
    retryable: false,
    fallbackEligible: category !== 'STALE_REQUEST',
    latencyMs: 10,
  }
}

function provider(
  id: string,
  implementation: (options: AdvisorRequestOptions) => Promise<WritingReviewProviderResult>,
): WritingReviewProvider {
  return {
    id,
    model: `${id}-model`,
    enabled: true,
    capabilities: ['writing_review', 'structured_json', 'arabic'],
    reviewWriting: vi.fn((_packet, requestOptions) => implementation(requestOptions)),
    health: () => ({
      provider: id,
      state: 'HEALTHY',
      enabled: true,
      consecutiveFailures: 0,
      successfulRequests: 0,
      rateLimitCount: 0,
      invalidResponseCount: 0,
      timeoutCount: 0,
      authFailures: 0,
      budgetFailures: 0,
    }),
    availability: () => ({ available: true, state: 'HEALTHY' }),
  }
}

describe('writing review provider manager', () => {
  it('stops after primary success including no_change', async () => {
    const primary = provider('groq', async () => success('groq'))
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new WritingReviewProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )
    const result = await manager.reviewWriting(packet, options)
    expect(result).toMatchObject({ ok: true, provider: 'groq', fallbackUsed: false, verdict: 'no_change' })
    expect(fallback.reviewWriting).not.toHaveBeenCalled()
  })

  it('falls back once after contract failure', async () => {
    const primary = provider('groq', async () => failure('groq', 'CONTRACT_FAILURE'))
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new WritingReviewProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )
    const result = await manager.reviewWriting(packet, options)
    expect(result).toMatchObject({ ok: true, provider: 'gemini', fallbackUsed: true })
  })

  it('does not fallback after abort', async () => {
    const controller = new AbortController()
    const primary = provider('groq', async () => {
      controller.abort()
      return failure('groq', 'STALE_REQUEST')
    })
    const fallback = provider('gemini', async () => success('gemini'))
    const manager = new WritingReviewProviderManager(
      [primary, fallback],
      new ProviderHealthManager(),
    )
    const result = await manager.reviewWriting(packet, { ...options, signal: controller.signal })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.category).toBe('STALE_REQUEST')
    expect(fallback.reviewWriting).not.toHaveBeenCalled()
  })

  it('falls back after Groq 429 and stays local-authoritative when every provider fails', async () => {
    const primary = provider('groq', async () => failure('groq', 'RATE_LIMITED'))
    const secondary = provider('gemini', async () => failure('gemini', 'TIMEOUT'))
    const tertiary = provider('openrouter', async () => failure('openrouter', 'CONTRACT_FAILURE'))
    const manager = new WritingReviewProviderManager(
      [primary, secondary, tertiary],
      new ProviderHealthManager(),
    )
    const result = await manager.reviewWriting(packet, options)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.localDecisionAuthoritative).toBe(true)
      expect(result.fallbackUsed).toBe(true)
    }
    expect(primary.reviewWriting).toHaveBeenCalledOnce()
    expect(secondary.reviewWriting).toHaveBeenCalledOnce()
    expect(tertiary.reviewWriting).toHaveBeenCalledOnce()
  })
})
