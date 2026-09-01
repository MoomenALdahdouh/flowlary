import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetch as httpFetch } from 'undici'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { configureStorePath } from '../../backend/src/db/store.ts'
import { createFlowlaryServer } from '../../backend/src/index.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../backend/src/routes/http.ts'
import { resetUsageForTests } from '../../backend/src/services/usage.ts'
import { AI_MODELS } from '@flowlary/shared'

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'development',
    authDisabled: true,
    authSecret: 'reliability-test-secret',
    jwtSecret: 'reliability-test-jwt',
    groqApiKey: 'test-groq-key',
    port: 8787,
    requestTimeoutMs: 2_000,
    maxBodyBytes: 64_000,
    dataPath: ':memory:',
    ...overrides,
  }
}

function mockResponse() {
  let payload = ''
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (chunk: string) => {
      payload = chunk
    },
  } as unknown as ServerResponse
  return {
    res,
    read: () => JSON.parse(payload) as Record<string, unknown>,
    get status() {
      return res.statusCode
    },
  }
}

function correctionRequest(body: Record<string, unknown> = { text: 'hello wrld' }) {
  return {
    method: 'POST',
    url: '/api/ai/correction',
    headers: { host: '127.0.0.1:8787', 'x-flowlary-entitlement': 'free' },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body))
    },
  } as unknown as IncomingMessage
}

describe('production reliability — gateway survives provider failures', () => {
  beforeEach(() => {
    resetRoutesForTests()
    resetRateLimitsForTests()
    resetUsageForTests()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns controlled 504 for AI provider timeout without crashing the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }),
    )

    const config = testConfig()
    const first = mockResponse()
    await handleHttpRequest(config, correctionRequest(), first.res)
    expect(first.status).toBe(504)
    expect(first.read().error).toMatchObject({ code: 'AI_TIMEOUT' })

    const health = mockResponse()
    await handleHttpRequest(config, { method: 'GET', url: '/health', headers: { host: 'localhost' } } as IncomingMessage, health.res)
    expect(health.status).toBe(200)
    expect(health.read()).toMatchObject({ ok: true })
  }, 10_000)

  it('returns controlled 503 for AI provider 500 without crashing the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'server_error' } }),
      })),
    )

    const config = testConfig()
    const ai = mockResponse()
    await handleHttpRequest(config, correctionRequest(), ai.res)
    expect(ai.status).toBe(503)
    expect(ai.read().error).toMatchObject({ code: 'AI_UNAVAILABLE' })

    const ready = mockResponse()
    await handleHttpRequest(config, { method: 'GET', url: '/ready', headers: { host: 'localhost' } } as IncomingMessage, ready.res)
    expect(ready.status).toBe(200)
  })

  it('returns controlled 429 for AI provider rate limit without crashing the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 'rate_limit_exceeded' } }),
      })),
    )

    const config = testConfig()
    const ai = mockResponse()
    await handleHttpRequest(config, correctionRequest(), ai.res)
    expect(ai.status).toBe(429)
    expect(ai.read().error).toMatchObject({ code: 'AI_RATE_LIMITED' })
  })

  it('returns controlled 502 for AI provider auth failure without crashing the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'invalid_api_key' } }),
      })),
    )

    const config = testConfig()
    const ai = mockResponse()
    await handleHttpRequest(config, correctionRequest(), ai.res)
    expect(ai.status).toBe(502)
    expect(ai.read().error).toMatchObject({ code: 'AI_PROVIDER_ERROR' })
  })

  it('serves concurrent AI requests without process failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          model: AI_MODELS.CORRECTION,
          choices: [
            {
              message: {
                content: JSON.stringify({
                  correctedText: 'hello world',
                  changes: [],
                }),
              },
            },
          ],
        }),
      })),
    )

    const config = testConfig()
    const requests = Array.from({ length: 8 }, () => {
      const response = mockResponse()
      return handleHttpRequest(config, correctionRequest(), response.res).then(() => response)
    })
    const responses = await Promise.all(requests)
    expect(responses.every((entry) => entry.status === 200)).toBe(true)

    const health = mockResponse()
    await handleHttpRequest(config, { method: 'GET', url: '/health', headers: { host: 'localhost' } } as IncomingMessage, health.res)
    expect(health.status).toBe(200)
  })

  it('HTTP server responds to health and ready probes after startup', async () => {
    const config = testConfig({ port: 0 })
    configureStorePath(':memory:')
    const server = createFlowlaryServer(config)
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') {
          reject(new Error('invalid_address'))
          return
        }
        resolve(address.port)
      })
    })

    try {
      const baseUrl = `http://127.0.0.1:${port}`
      const health = await httpFetch(`${baseUrl}/health`)
      expect(health.ok).toBe(true)

      const ready = await httpFetch(`${baseUrl}/ready`)
      expect(ready.ok).toBe(true)
      const readyBody = (await ready.json()) as { ready?: boolean }
      expect(readyBody.ready).toBe(true)
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    }
  })
})
