import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { configureStorePath } from '../../backend/src/db/store.ts'
import { authenticateRequest, createInstallToken } from '../../backend/src/middleware/auth.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import { resetUsageForTests } from '../../backend/src/services/usage.ts'
import { clearTranslationCacheForTests } from '../../backend/src/providers/translationCache.ts'
import { resetAdvisorProviderRuntimeForTests } from '../../backend/src/providers/hypothesisAdvisorProvider.ts'
import { resetWritingReviewProviderRuntimeForTests } from '../../backend/src/providers/writingReviewProvider.ts'
import { handleHttpRequest } from '../../backend/src/routes/http.ts'
import { AI_MODELS } from '@flowlary/shared'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'development',
    authDisabled: true,
    authSecret: 'phase16-test-secret',
    groqApiKey: 'test-groq-key-not-real',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    ...overrides,
  }
}

describe('Phase 16 — AI Gateway', () => {
  beforeEach(() => {
    resetRateLimitsForTests()
    resetUsageForTests()
    clearTranslationCacheForTests()
    resetAdvisorProviderRuntimeForTests()
    resetWritingReviewProviderRuntimeForTests()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes health endpoint', async () => {
    const config = createTestConfig()
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = { method: 'GET', url: '/health', headers: { host: 'localhost' } } as IncomingMessage
    await handleHttpRequest(config, req, res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(payload)).toMatchObject({ ok: true })
  })

  it('registers install tokens when auth enabled', async () => {
    const installId = '11111111-1111-1111-1111-111111111111'
    const config = createTestConfig({ authDisabled: false })
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/auth/register',
      headers: { host: '127.0.0.1:8787' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ install_id: installId }))
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    const body = JSON.parse(payload)
    expect(body).toMatchObject({
      ok: true,
      install_id: installId,
      token: createInstallToken(installId, config),
    })
  })

  it('rejects unauthenticated AI requests when auth enabled', async () => {
    const config = createTestConfig({ authDisabled: false })
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/ai/translation',
      headers: { host: '127.0.0.1:8787' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ text: 'hello', source_language: 'en', target_language: 'ar' }))
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(payload)).toMatchObject({ ok: false, error: { code: 'AI_AUTH_FAILED' } })
  })

  it('authenticates bearer install tokens but denies AI until account sign-in', () => {
    const config = createTestConfig({ authDisabled: false })
    const installId = '55555555-5555-5555-5555-555555555555'
    const token = createInstallToken(installId, config)
    const auth = authenticateRequest(config, {
      authorization: `Bearer ${token}`,
      'x-flowlary-install-id': installId,
      'x-flowlary-entitlement': 'free',
    })
    expect(auth.installId).toBe(installId)
    expect(auth.rateLimitTier).toBe('anonymous')
    expect(auth.allowed).toBe(false)
    expect(auth.denyReason).toBe('account_required')
    expect(auth.clientClaim).toBe('free')
  })

  it('does not trust client pro claim for server entitlement', () => {
    const config = createTestConfig({ authDisabled: false })
    const installId = '77777777-7777-7777-7777-777777777777'
    const token = createInstallToken(installId, config)
    const auth = authenticateRequest(config, {
      authorization: `Bearer ${token}`,
      'x-flowlary-install-id': installId,
      'x-flowlary-entitlement': 'pro',
    })
    expect(auth.entitlement).toBeUndefined()
    expect(auth.rateLimitTier).toBe('anonymous')
    expect(auth.allowed).toBe(false)
    expect(auth.clientClaim).toBe('pro')
  })

  it('routes translation through gateway with mocked Groq', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          model: AI_MODELS.TRANSLATION,
          choices: [{ message: { content: 'مرحبا' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      })),
    )

    const config = createTestConfig({ authDisabled: true })
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/ai/translation',
      headers: { host: '127.0.0.1:8787', 'x-flowlary-entitlement': 'free' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(
          JSON.stringify({ text: 'hello', source_language: 'en', target_language: 'ar' }),
        )
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    const body = JSON.parse(payload)
    expect(res.statusCode).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.translation).toBe('مرحبا')
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('routes hypothesis advising through the provider manager without exposing writes', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const providerBody = JSON.parse(String(init?.body))
      expect(providerBody.max_tokens).toBe(180)
      expect(providerBody.messages[1].content).not.toContain('replacement')
      return new Response(JSON.stringify({
        model: AI_MODELS.HYPOTHESIS_ADVISOR,
        choices: [{
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              rankedHypothesisIds: ['h1'],
              ambiguityClass: 'preserve',
              reasonCode: 'context',
            }),
          },
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          completion_tokens_details: { reasoning_tokens: 2 },
        },
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const config = createTestConfig({
      groqAdvisorEnabled: true,
      advisorFallbackEnabled: false,
      advisorMaxTokens: 180,
      groqAdvisorMaxTokens: 180,
    })
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/ai/hypothesis-advisor',
      headers: { host: '127.0.0.1:8787', 'x-flowlary-entitlement': 'free' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({
          cycleId: 'cycle',
          snippet: 'ambiguous',
          allowedIntents: ['preserve'],
          hypotheses: [{
            id: 'h1',
            intent: 'preserve',
            localScore: 0.6,
            risk: 'low',
            needsLLM: true,
            conflicts: [],
            evidence: [],
          }],
        }))
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(payload)).toMatchObject({
      ok: true,
      rankedHypothesisIds: ['h1'],
      ambiguityClass: 'preserve',
      reasonCode: 'context',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('returns 429 when the advisor per-user rate limit is exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y"}',
        },
      }],
    }), { status: 200 })))
    const config = createTestConfig({
      groqAdvisorEnabled: true,
      advisorFallbackEnabled: false,
      advisorUserRequestsPerMinute: 1,
    })
    const body = {
      cycleId: 'cycle-rate-limit',
      snippet: 'ambiguous',
      allowedIntents: ['preserve'],
      hypotheses: [{
        id: 'h1',
        intent: 'preserve',
        localScore: 0.6,
        risk: 'low',
        needsLLM: true,
        conflicts: [],
        evidence: [],
      }],
    }
    async function postAdvisor(): Promise<{ status: number; body: Record<string, unknown> }> {
      let payload = ''
      const res = {
        statusCode: 200,
        setHeader: vi.fn(),
        end: (chunk: string) => {
          payload = chunk
        },
      } as unknown as ServerResponse
      const req = {
        method: 'POST',
        url: '/api/ai/hypothesis-advisor',
        headers: { host: '127.0.0.1:8787', 'x-flowlary-entitlement': 'free' },
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(body))
        },
      } as unknown as IncomingMessage
      await handleHttpRequest(config, req, res)
      return { status: res.statusCode, body: JSON.parse(payload) as Record<string, unknown> }
    }

    expect(await postAdvisor()).toMatchObject({ status: 200, body: { ok: true } })
    const limited = await postAdvisor()
    expect(limited.status).toBe(429)
    expect(limited.body).toMatchObject({ ok: false, error: { code: 'AI_RATE_LIMITED' } })
  })

  it('denies anonymous entitlement when auth enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })),
    )

    const installId = '66666666-6666-6666-6666-666666666666'
    const config = createTestConfig({ authDisabled: false })
    const token = createInstallToken(installId, config)
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/ai/translation',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${token}`,
        'x-flowlary-install-id': installId,
        'x-flowlary-entitlement': 'anonymous',
      },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(
          JSON.stringify({ text: 'hello', source_language: 'en', target_language: 'ar' }),
        )
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    const body = JSON.parse(payload)
    expect(res.statusCode).toBe(403)
    expect(body.error.code).toBe('AI_ENTITLEMENT_DENIED')
  })

  it('classifies layout via allam without include_reasoning in Groq request', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe(AI_MODELS.LAYOUT_CLASSIFIER)
      expect(body).not.toHaveProperty('include_reasoning')
      return {
        ok: true,
        json: async () => ({
          model: AI_MODELS.LAYOUT_CLASSIFIER,
          choices: [{ message: { content: '{"kind":"VALID"}' } }],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const config = createTestConfig({ authDisabled: true })
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/ai/layout-classification',
      headers: { host: '127.0.0.1:8787', 'x-flowlary-entitlement': 'trial' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(
          JSON.stringify({
            word: 'zzzzunknown',
            source_layout: 'en-US-qwerty',
            candidate_layouts: ['ar-101'],
          }),
        )
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    const body = JSON.parse(payload)
    expect(res.statusCode).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.result?.kind).toBe('VALID')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('denies layout classification for install-only auth when auth enabled', async () => {
    const installId = '77777777-7777-7777-7777-777777777777'
    const config = createTestConfig({ authDisabled: false })
    const token = createInstallToken(installId, config)
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/ai/layout-classification',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${token}`,
        'x-flowlary-install-id': installId,
        'x-flowlary-entitlement': 'anonymous',
      },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(
          JSON.stringify({
            word: 'test',
            source_layout: 'en-US-qwerty',
            candidate_layouts: ['ar-101'],
          }),
        )
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    const body = JSON.parse(payload)
    expect(res.statusCode).toBe(403)
    expect(body.error.code).toBe('AI_ENTITLEMENT_DENIED')
  })

  it('preserves legacy /api/translate response shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'translated' } }],
        }),
      })),
    )

    const config = createTestConfig({ authDisabled: true })
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/translate',
      headers: { host: '127.0.0.1:8787', 'x-flowlary-entitlement': 'free' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(
          JSON.stringify({ text: 'hello', source_language: 'en', target_language: 'ar' }),
        )
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    expect(JSON.parse(payload)).toEqual({ translation: 'translated' })
  })

  it('reviews writing islands without ranking hypothesis IDs', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.messages[1].content).toContain('hello comming')
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              verdict: 'no_change',
              ambiguityClass: 'ok',
              reasonCode: 'no_change',
              edits: [],
            }),
          },
        }],
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const config = createTestConfig({
      groqAdvisorEnabled: true,
      advisorFallbackEnabled: false,
    })
    let payload = ''
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (chunk: string) => {
        payload = chunk
      },
    } as unknown as ServerResponse
    const req = {
      method: 'POST',
      url: '/api/ai/writing-review',
      headers: { host: '127.0.0.1:8787', 'x-flowlary-entitlement': 'free' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({
          cycleId: 'cycle-review',
          snippet: 'hello comming',
        }))
      },
    } as unknown as IncomingMessage

    await handleHttpRequest(config, req, res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(payload)).toMatchObject({
      ok: true,
      verdict: 'no_change',
      edits: [],
    })
    expect(JSON.parse(payload)).not.toHaveProperty('rankedHypothesisIds')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
