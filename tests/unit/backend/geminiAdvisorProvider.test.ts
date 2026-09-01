import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig, type AppConfig } from '../../../backend/src/config/env.ts'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import { GeminiAdvisorProvider } from '../../../backend/src/providers/geminiAdvisorProvider.ts'
import type {
  AdvisorPacket,
  AdvisorRequestOptions,
} from '../../../backend/src/providers/advisorTypes.ts'

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig(),
    advisorFallbackEnabled: true,
    geminiAdvisorEnabled: true,
    geminiApiKey: 'test-gemini-key',
    geminiAdvisorModel: 'gemini-2.5-flash-lite',
    ...overrides,
  }
}

const packet: AdvisorPacket = {
  cycleId: 'cycle',
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

describe('Gemini advisor provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('can be enabled as a primary independently of fallback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValue(response({
        candidates: [{
          content: {
            parts: [{
              text: '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y"}',
            }],
          },
        }],
      }))
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GeminiAdvisorProvider(
      config({ advisorFallbackEnabled: false }),
      new ProviderHealthManager(),
    )

    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: true, provider: 'gemini' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('fails cleanly without credentials when configured on', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GeminiAdvisorProvider(
      config({ geminiApiKey: '' }),
      new ProviderHealthManager(),
    )

    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'PROVIDER_UNAVAILABLE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requests strict structured JSON and normalizes a valid rank', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain('gemini-2.5-flash-lite:generateContent')
      expect(url).toContain('key=test-gemini-key')
      const body = JSON.parse(String(init?.body))
      expect(body.generationConfig).toMatchObject({
        temperature: 0,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      })
      expect(body.generationConfig.responseJsonSchema.additionalProperties).toBe(false)
      return response({
        modelVersion: 'gemini-2.5-flash-lite',
        candidates: [{
          finishReason: 'STOP',
          content: {
            parts: [{
              text: '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y"}',
            }],
          },
        }],
        usageMetadata: {
          promptTokenCount: 80,
          candidatesTokenCount: 20,
          totalTokenCount: 100,
          thoughtsTokenCount: 10,
        },
      }, 200, { 'x-request-id': 'gemini_req_1' })
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GeminiAdvisorProvider(config(), new ProviderHealthManager())

    expect(await provider.rankHypotheses(packet, options)).toMatchObject({
      ok: true,
      provider: 'gemini',
      rankedHypothesisIds: ['h1'],
      providerRequestId: 'gemini_req_1',
      usage: {
        inputTokens: 80,
        outputTokens: 20,
        totalTokens: 100,
        reasoningTokens: 10,
      },
    })
  })

  it('normalizes rate limit, auth, server, and budget exhaustion', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GeminiAdvisorProvider(config(), new ProviderHealthManager())

    fetchMock.mockResolvedValueOnce(response({}, 429, { 'retry-after': '3' }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'RATE_LIMITED', cooldownMs: 3_000 })

    fetchMock.mockResolvedValueOnce(response({}, 403))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'AUTH_FAILED', retryable: false })

    fetchMock.mockResolvedValueOnce(response({}, 500))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'SERVER_ERROR', retryable: true })

    fetchMock.mockResolvedValueOnce(response({
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }],
    }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it('distinguishes invalid model/request errors from billing quota exhaustion', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GeminiAdvisorProvider(config(), new ProviderHealthManager())

    fetchMock.mockResolvedValueOnce(response({}, 400))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'INVALID_REQUEST' })
    fetchMock.mockResolvedValueOnce(response({}, 404))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'INVALID_REQUEST' })
    fetchMock.mockResolvedValueOnce(response(
      { error: { status: 'RESOURCE_EXHAUSTED', message: 'Billing quota exhausted' } },
      429,
    ))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'QUOTA_EXHAUSTED' })
  })

  it('rejects malformed, unknown-ID, and write-injection responses', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GeminiAdvisorProvider(config(), new ProviderHealthManager())

    fetchMock.mockResolvedValueOnce(response({
      candidates: [{ content: { parts: [{ text: '{' }] } }],
    }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })

    fetchMock.mockResolvedValueOnce(response({
      candidates: [{
        content: {
          parts: [{
            text: '{"rankedHypothesisIds":["missing"],"ambiguityClass":"x","reasonCode":"y"}',
          }],
        },
      }],
    }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })

    fetchMock.mockResolvedValueOnce(response({
      candidates: [{
        content: {
          parts: [{
            text: '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y","html":"<b>x</b>"}',
          }],
        },
      }],
    }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it.each([
    [{ rankedHypothesisIds: ['unknown-id'], ambiguityClass: 'x', reasonCode: 'y' }, 'CONTRACT_FAILURE'],
    [{ rankedHypothesisIds: ['h1', 'h1'], ambiguityClass: 'x', reasonCode: 'y' }, 'CONTRACT_FAILURE'],
    [{ rankedHypothesisIds: [], ambiguityClass: 'x', reasonCode: 'y' }, 'CONTRACT_FAILURE'],
    [{ rankedHypothesisIds: ['h1'], ambiguityClass: 'x', reasonCode: 'y', replacement: 'malicious text' }, 'CONTRACT_FAILURE'],
    [{ rankedHypothesisIds: ['h1'], ambiguityClass: 'x', reasonCode: 'y', write: true }, 'CONTRACT_FAILURE'],
    [{ rankedHypothesisIds: ['h1'], ambiguityClass: 'x', reasonCode: 'y', text: '...' }, 'CONTRACT_FAILURE'],
  ] as const)('rejects provider output that violates the shared validator', async (content, category) => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(content) }] },
      }],
    })))
    const provider = new GeminiAdvisorProvider(config(), new ProviderHealthManager())
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category })
  })

  it('distinguishes caller abort from provider timeout', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>(
      (_resolve, reject) => init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      ),
    ))
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GeminiAdvisorProvider(config(), new ProviderHealthManager())

    const caller = new AbortController()
    caller.abort()
    expect(await provider.rankHypotheses(packet, { ...options, signal: caller.signal }))
      .toMatchObject({ ok: false, category: 'STALE_REQUEST', fallbackEligible: false })

    vi.useFakeTimers()
    const pending = provider.rankHypotheses(packet, { ...options, timeoutMs: 10 })
    const expectation = expect(pending).resolves.toMatchObject({
      ok: false,
      category: 'TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(11)
    await expectation
  })
})
