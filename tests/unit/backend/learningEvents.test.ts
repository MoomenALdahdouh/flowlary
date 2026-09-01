import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../../backend/src/config/env.ts'
import { loadConfig } from '../../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../../backend/src/routes/http.ts'
import { resetRateLimitsForTests } from '../../../backend/src/middleware/rateLimit.ts'
import { configureStorePath, resetStoreForTests } from '../../../backend/src/db/store.ts'
import { clearTranslationCacheForTests } from '../../../backend/src/providers/translationCache.ts'
import {
  hashWritingSample,
  validateLearningEventIngestInput,
} from '@flowlary/shared'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'wl7-test-secret',
    jwtSecret: 'wl7-jwt-secret',
    dataPath: ':memory:',
    groqApiKey: 'test-groq-key-not-real',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    ...overrides,
  }
}

async function request(
  config: AppConfig,
  method: string,
  path: string,
  options?: { body?: unknown; headers?: Record<string, string> },
): Promise<{ status: number; body: Record<string, unknown> }> {
  let payload = ''
  const res = {
    statusCode: 200,
    setHeader: () => undefined,
    end: (chunk: string) => {
      payload = chunk
    },
  } as unknown as ServerResponse

  const headers: Record<string, string | string[] | undefined> = {
    host: '127.0.0.1:8787',
    ...options?.headers,
  }

  const req = {
    method,
    url: path,
    headers,
    async *[Symbol.asyncIterator]() {
      if (options?.body !== undefined) {
        yield Buffer.from(JSON.stringify(options.body))
      }
    },
  } as unknown as IncomingMessage

  await handleHttpRequest(config, req, res)
  return { status: res.statusCode, body: JSON.parse(payload || '{}') as Record<string, unknown> }
}

async function registerAccount(
  config: AppConfig,
  email: string,
  installId: string,
): Promise<string> {
  const res = await request(config, 'POST', '/api/auth/register', {
    body: { email, password: 'password123', install_id: installId },
  })
  return String(res.body.access_token)
}

function validWritingEvent(overrides: Record<string, unknown> = {}) {
  return {
    batchId: 'batch-1',
    category: 'grammar',
    original: 'go',
    corrected: 'went',
    action: 'detected',
    source: 'writing',
    sampleWordCount: 5,
    sampleHash: hashWritingSample('Yesterday I go to university.'),
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('WL-7 — learning events API', () => {
  beforeEach(() => {
    clearTranslationCacheForTests()
    resetRoutesForTests()
    resetRateLimitsForTests()
    resetStoreForTests()
    configureStorePath(':memory:')
  })

  afterEach(() => {
    resetRoutesForTests()
  })

  it('rejects unauthenticated POST /api/learning/events', async () => {
    const config = createTestConfig()
    const res = await request(config, 'POST', '/api/learning/events', {
      body: { events: [validWritingEvent()] },
    })
    expect(res.status).toBe(401)
  })

  it('accepts valid writing events for authenticated account', async () => {
    const config = createTestConfig()
    const token = await registerAccount(config, 'wl7@flowlary.com', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    const res = await request(config, 'POST', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}`, 'x-flowlary-client': 'website' },
      body: { events: [validWritingEvent()] },
    })
    expect(res.status).toBe(200)
    const result = res.body.result as { accepted?: number }
    expect(result.accepted).toBe(1)
  })

  it('rejects invalid category', async () => {
    const config = createTestConfig()
    const token = await registerAccount(config, 'invalid@flowlary.com', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    const res = await request(config, 'POST', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}` },
      body: { events: [validWritingEvent({ category: 'layout' })] },
    })
    expect(res.status).toBe(200)
    const result = res.body.result as { accepted?: number; rejected?: number }
    expect(result.accepted).toBe(0)
    expect(result.rejected).toBeGreaterThan(0)
  })

  it('accepts website practice events', async () => {
    const config = createTestConfig()
    const token = await registerAccount(config, 'practice@flowlary.com', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
    const res = await request(config, 'POST', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}`, 'x-flowlary-client': 'website' },
      body: {
        events: [
          validWritingEvent({
            source: 'practice',
            action: 'detected',
          }),
        ],
      },
    })
    expect(res.status).toBe(200)
    const result = res.body.result as { accepted?: number; rejected?: number }
    expect(result.accepted).toBe(1)
    expect(result.rejected).toBe(0)
  })

  it('deduplicates identical events', async () => {
    const config = createTestConfig()
    const token = await registerAccount(config, 'dedupe@flowlary.com', 'dddddddd-dddd-dddd-dddd-dddddddddddd')
    const event = validWritingEvent()
    const first = await request(config, 'POST', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}` },
      body: { events: [event] },
    })
    const second = await request(config, 'POST', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}` },
      body: { events: [event] },
    })
    expect((first.body.result as { accepted?: number }).accepted).toBe(1)
    expect((second.body.result as { deduplicated?: number }).deduplicated).toBe(1)

    const listed = await request(config, 'GET', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}` },
    })
    const store = listed.body.store as { events?: unknown[] }
    expect(store.events).toHaveLength(1)
  })

  it('isolates learning events by account', async () => {
    const config = createTestConfig()
    const tokenA = await registerAccount(config, 'a@flowlary.com', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
    const tokenB = await registerAccount(config, 'b@flowlary.com', 'ffffffff-ffff-ffff-ffff-ffffffffffff')

    await request(config, 'POST', '/api/learning/events', {
      headers: { authorization: `Bearer ${tokenA}` },
      body: { events: [validWritingEvent({ batchId: 'batch-a' })] },
    })

    const listB = await request(config, 'GET', '/api/learning/events', {
      headers: { authorization: `Bearer ${tokenB}` },
    })
    const storeB = listB.body.store as { events?: unknown[] }
    expect(storeB.events).toHaveLength(0)

    const listA = await request(config, 'GET', '/api/learning/events', {
      headers: { authorization: `Bearer ${tokenA}` },
    })
    const storeA = listA.body.store as { events?: unknown[] }
    expect(storeA.events).toHaveLength(1)
  })

  it('clears account learning events on DELETE', async () => {
    const config = createTestConfig()
    const token = await registerAccount(config, 'clear@flowlary.com', '11111111-1111-1111-1111-111111111111')
    await request(config, 'POST', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}` },
      body: { events: [validWritingEvent()] },
    })
    const deleted = await request(config, 'DELETE', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(deleted.status).toBe(200)
    const listed = await request(config, 'GET', '/api/learning/events', {
      headers: { authorization: `Bearer ${token}` },
    })
    const store = listed.body.store as { events?: unknown[] }
    expect(store.events).toHaveLength(0)
  })
})

describe('validateLearningEventIngestInput', () => {
  it('rejects oversized original text', () => {
    const result = validateLearningEventIngestInput(
      validWritingEvent({ original: 'x'.repeat(600) }),
      Date.now(),
    )
    expect(result).toBeNull()
  })

  it('rejects invalid timestamps', () => {
    const result = validateLearningEventIngestInput(
      validWritingEvent({ timestamp: Date.now() + 60 * 60 * 1000 }),
      Date.now(),
    )
    expect(result).toBeNull()
  })
})
