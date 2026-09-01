import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig, type AppConfig } from '../../../backend/src/config/env.ts'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import {
  GroqAdvisorProvider,
  parseRetryAfterMs,
} from '../../../backend/src/providers/groqAdvisorProvider.ts'
import type {
  AdvisorPacket,
  AdvisorRequestOptions,
} from '../../../backend/src/providers/advisorTypes.ts'

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig(),
    groqApiKey: 'test-key',
    groqAdvisorEnabled: true,
    groqAdvisorModel: 'openai/gpt-oss-20b',
    ...overrides,
  }
}

const packet: AdvisorPacket = {
  cycleId: 'c1',
  snippet: 'مرحبا API',
  allowedIntents: ['preserve', 'fix_layout'],
  hypotheses: [
    {
      id: 'h1',
      intent: 'preserve',
      localScore: 0.6,
      risk: 'low',
      needsLLM: true,
      conflicts: ['h2'],
      evidence: ['mixed_script'],
    },
    {
      id: 'h2',
      intent: 'fix_layout',
      localScore: 0.5,
      risk: 'high',
      needsLLM: true,
      conflicts: ['h1'],
      evidence: [],
    },
  ],
}

const options: AdvisorRequestOptions = {
  requestId: 'r1',
  deadlineAt: Number.MAX_SAFE_INTEGER,
  timeoutMs: 1_500,
  maxTokens: 180,
  contractVersion: '1',
  requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
}

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('Groq advisor provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('sends the frozen ID-only contract and captures usage metadata', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({
        model: 'openai/gpt-oss-20b',
        temperature: 0,
        max_tokens: 180,
        include_reasoning: false,
        response_format: { type: 'json_object' },
      })
      expect(body.messages[1].content).not.toContain('replacement')
      return response({
        model: 'openai/gpt-oss-20b',
        choices: [{
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              rankedHypothesisIds: ['h1', 'h2'],
              ambiguityClass: 'mixed',
              reasonCode: 'preserve',
            }),
          },
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 60,
          total_tokens: 160,
          completion_tokens_details: { reasoning_tokens: 40 },
        },
      }, 200, { 'x-request-id': 'groq_req_1' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())
    const result = await provider.rankHypotheses(packet, options)

    expect(result).toMatchObject({
      ok: true,
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      rankedHypothesisIds: ['h1', 'h2'],
      finishReason: 'stop',
      providerRequestId: 'groq_req_1',
      usage: {
        inputTokens: 100,
        outputTokens: 60,
        totalTokens: 160,
        reasoningTokens: 40,
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('normalizes 429, honors Retry-After, and never retries', async () => {
    const fetchMock = vi.fn(async () => response(
      { error: { code: 'rate_limit_exceeded' } },
      429,
      { 'retry-after': '2.5' },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())

    const result = await provider.rankHypotheses(packet, options)
    expect(result).toMatchObject({
      ok: false,
      category: 'RATE_LIMITED',
      cooldownMs: 2_500,
      fallbackEligible: true,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('parses Groq reset durations and HTTP-date Retry-After', () => {
    const durationHeaders = new Headers({
      'x-ratelimit-reset-tokens': '7.5s',
      'x-ratelimit-reset-requests': '1m2s',
    })
    expect(parseRetryAfterMs(durationHeaders, 0)).toBe(62_000)

    const now = Date.parse('2026-08-31T16:00:00Z')
    const dateHeaders = new Headers({
      'retry-after': 'Mon, 31 Aug 2026 16:00:10 GMT',
    })
    expect(parseRetryAfterMs(dateHeaders, now)).toBe(10_000)
  })

  it('classifies structured-output JSON contract failure without text retry', async () => {
    const fetchMock = vi.fn(async () => response(
      { error: { code: 'json_validate_failed' } },
      400,
    ))
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())

    expect(await provider.rankHypotheses(packet, options)).toMatchObject({
      ok: false,
      category: 'CONTRACT_FAILURE',
      retryable: false,
      fallbackEligible: true,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('distinguishes invalid requests from exhausted provider capacity', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())

    fetchMock.mockResolvedValueOnce(response({ error: { code: 'invalid_request' } }, 400))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'INVALID_REQUEST' })
    fetchMock.mockResolvedValueOnce(response(
      { error: { message: 'Developer capacity quota exhausted' } },
      429,
    ))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'QUOTA_EXHAUSTED' })
  })

  it('classifies auth, server, malformed transport JSON, and unknown IDs', async () => {
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockResolvedValueOnce(response({}, 401))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'AUTH_FAILED', retryable: false })

    fetchMock.mockResolvedValueOnce(response({}, 503))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'SERVER_ERROR', retryable: true })

    fetchMock.mockResolvedValueOnce(new Response('{', { status: 200 }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })

    fetchMock.mockResolvedValueOnce(response({
      choices: [{
        message: {
          content: '{"rankedHypothesisIds":["invented"],"ambiguityClass":"x","reasonCode":"y"}',
        },
      }],
    }))
    expect(await provider.rankHypotheses(packet, options))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it('rejects write-field injection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      choices: [{
        message: {
          content: '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y","write":"unsafe"}',
        },
      }],
    })))
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())
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
      choices: [{ message: { content: JSON.stringify(content) } }],
    })))
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())
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
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())

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

  it('reviews writing islands with a separate JSON contract and never ranks hypotheses', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.messages[0].content).toContain('correctness only')
      expect(body.messages[1].content).toContain('hello comming')
      return response({
        choices: [{
          message: {
            content: JSON.stringify({
              verdict: 'edits',
              ambiguityClass: 'english_island',
              reasonCode: 'spelling',
              edits: [{
                start: 6,
                end: 13,
                original: 'comming',
                proposed: 'coming',
                kind: 'spelling',
                confidence: 'high',
              }],
            }),
          },
        }],
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())
    const result = await provider.reviewWriting(
      {
        cycleId: 'c-review',
        snippet: 'hello comming',
        allowedKinds: ['spelling', 'grammar', 'punctuation'],
      },
      {
        ...options,
        requiredCapabilities: ['writing_review', 'structured_json'],
      },
    )
    expect(result).toMatchObject({
      ok: true,
      verdict: 'edits',
      edits: [{ proposed: 'coming', kind: 'spelling' }],
    })
    expect(result).not.toHaveProperty('rankedHypothesisIds')
  })

  it('rejects writing-review payloads that include write keys', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      choices: [{
        message: {
          content: JSON.stringify({
            verdict: 'edits',
            ambiguityClass: 'x',
            reasonCode: 'y',
            edits: [],
            write: true,
          }),
        },
      }],
    })))
    const provider = new GroqAdvisorProvider(config(), new ProviderHealthManager())
    expect(await provider.reviewWriting(
      { cycleId: 'c', snippet: 'hello comming', allowedKinds: ['spelling'] },
      { ...options, requiredCapabilities: ['writing_review', 'structured_json'] },
    )).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })
})
