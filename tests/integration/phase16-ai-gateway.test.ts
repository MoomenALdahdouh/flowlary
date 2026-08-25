import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { authenticateRequest, createInstallToken } from '../../backend/src/middleware/auth.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import { resetUsageForTests } from '../../backend/src/services/usage.ts'
import { handleHttpRequest } from '../../backend/src/routes/http.ts'
import { AI_MODELS } from '@flowlary/shared'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
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

  it('authenticates bearer install tokens', () => {
    const config = createTestConfig({ authDisabled: false })
    const installId = '55555555-5555-5555-5555-555555555555'
    const token = createInstallToken(installId, config)
    const auth = authenticateRequest(config, {
      authorization: `Bearer ${token}`,
      'x-flowlary-install-id': installId,
      'x-flowlary-entitlement': 'free',
    })
    expect(auth.installId).toBe(installId)
    expect(auth.entitlement).toBe('free')
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
})
