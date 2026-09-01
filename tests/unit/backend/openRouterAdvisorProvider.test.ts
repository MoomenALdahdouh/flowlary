import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig, type AppConfig } from '../../../backend/src/config/env.ts'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import { OpenRouterAdvisorProvider } from '../../../backend/src/providers/openRouterAdvisorProvider.ts'
import type { AdvisorPacket, AdvisorRequestOptions } from '../../../backend/src/providers/advisorTypes.ts'

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig(),
    openRouterApiKey: 'test-key',
    openRouterAdvisorEnabled: true,
    openRouterAdvisorModel: 'vendor/configured-model',
    ...overrides,
  }
}

const packet: AdvisorPacket = {
  cycleId: 'cycle',
  snippet: 'ambiguous',
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
  requestId: 'request',
  deadlineAt: Number.MAX_SAFE_INTEGER,
  timeoutMs: 1_500,
  maxTokens: 512,
  contractVersion: '1',
  requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
}

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

describe('OpenRouter advisor provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('requires an explicitly configured model and key', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new OpenRouterAdvisorProvider(
      config({ openRouterAdvisorModel: '' }),
      new ProviderHealthManager(),
    )
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'PROVIDER_UNAVAILABLE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the configured model and normalizes a valid ID-only result', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain('openrouter.ai/api/v1/chat/completions')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({
        model: 'vendor/configured-model',
        temperature: 0,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      })
      return response({
        id: 'generation-1',
        model: 'vendor/configured-model',
        choices: [{
          finish_reason: 'stop',
          message: {
            content: '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y"}',
          },
        }],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
          cost: 0.00012,
          completion_tokens_details: { reasoning_tokens: 4 },
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new OpenRouterAdvisorProvider(config(), new ProviderHealthManager())
    expect(await provider.rankHypotheses(packet, options)).toMatchObject({
      ok: true,
      provider: 'openrouter',
      model: 'vendor/configured-model',
      rankedHypothesisIds: ['h1'],
      finishReason: 'stop',
      usage: {
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
        reasoningTokens: 4,
        estimatedCostUsd: 0.00012,
      },
    })
  })

  it.each([
    [400, 'INVALID_REQUEST'],
    [401, 'AUTH_FAILED'],
    [403, 'AUTH_FAILED'],
    [404, 'INVALID_REQUEST'],
    [500, 'SERVER_ERROR'],
  ] as const)('normalizes HTTP %s as %s', async (status, category) => {
    vi.stubGlobal('fetch', vi.fn(async () => response({}, status)))
    const provider = new OpenRouterAdvisorProvider(config(), new ProviderHealthManager())
    expect(await provider.rankHypotheses(packet, options)).toMatchObject({ ok: false, category })
  })

  it('distinguishes rate limits from exhausted credits and honors Retry-After', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new OpenRouterAdvisorProvider(config(), new ProviderHealthManager())
    fetchMock.mockResolvedValueOnce(response({}, 429, { 'retry-after': '2' }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'RATE_LIMITED', cooldownMs: 2_000 })
    fetchMock.mockResolvedValueOnce(response({ error: { message: 'Insufficient credits' } }, 402))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'QUOTA_EXHAUSTED' })
  })

  it('rejects malformed JSON, unknown IDs, and direct-write fields', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new OpenRouterAdvisorProvider(config(), new ProviderHealthManager())
    fetchMock.mockResolvedValueOnce(response({
      choices: [{ message: { content: '{' } }],
    }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
    fetchMock.mockResolvedValueOnce(response({
      choices: [{ message: {
        content: '{"rankedHypothesisIds":["invented"],"ambiguityClass":"x","reasonCode":"y"}',
      } }],
    }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
    fetchMock.mockResolvedValueOnce(response({
      choices: [{ message: {
        content: '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y","replacement":"unsafe"}',
      } }],
    }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it('does not continue after a stale cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new OpenRouterAdvisorProvider(config(), new ProviderHealthManager())
    expect(await provider.rankHypotheses(packet, { ...options, signal: controller.signal }))
      .toMatchObject({ ok: false, category: 'STALE_REQUEST', fallbackEligible: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
