import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../backend/src/routes/http.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import { configureStorePath, resetStoreForTests } from '../../backend/src/db/store.ts'
import { clearTranslationCacheForTests } from '../../backend/src/providers/translationCache.ts'
import {
  FREE_DAILY_CREDITS,
  PRO_DAILY_CREDITS,
  PRO_MONTHLY_SOFT_CAP,
  PRO_MONTHLY_PRICE_CENTS,
  PRO_YEARLY_PRICE_CENTS,
  TRIAL_DAILY_CREDITS,
} from '@flowlary/shared'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'voc-test-secret',
    jwtSecret: 'voc-jwt-secret',
    dataPath: ':memory:',
    groqApiKey: 'test-groq-key-not-real',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    feedbackAdminEmails: ['admin@flowlary.com'],
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

  const req = {
    method,
    url: path,
    headers: { host: '127.0.0.1:8787', ...options?.headers },
    async *[Symbol.asyncIterator]() {
      if (options?.body !== undefined) yield Buffer.from(JSON.stringify(options.body))
    },
  } as unknown as IncomingMessage

  await handleHttpRequest(config, req, res)
  return { status: res.statusCode, body: JSON.parse(payload || '{}') as Record<string, unknown> }
}

async function register(config: AppConfig, email: string, installId: string): Promise<string> {
  const res = await request(config, 'POST', '/api/auth/register', {
    body: { email, password: 'password123', install_id: installId },
  })
  expect(res.status).toBe(200)
  return String(res.body.access_token)
}

describe('VoC feedback system', () => {
  beforeEach(() => {
    clearTranslationCacheForTests()
    resetRoutesForTests()
    resetRateLimitsForTests()
    resetStoreForTests()
    configureStorePath(':memory:')
  })

  afterEach(() => {
    resetRoutesForTests()
    vi.restoreAllMocks()
  })

  it('returns public feedback config without auth', async () => {
    const config = createTestConfig({ chromeWebStoreUrl: null, edgeAddonsUrl: null })
    const res = await request(config, 'GET', '/api/feedback/config')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const cfg = res.body.config as { storeReviewAvailable?: boolean }
    expect(cfg.storeReviewAvailable).toBe(false)
  })

  it('requires auth for feedback submission', async () => {
    const config = createTestConfig()
    const res = await request(config, 'POST', '/api/feedback', {
      body: { message: 'hello', type: 'GENERAL_FEEDBACK' },
    })
    expect(res.status).toBe(401)
  })

  it('submits feedback for authenticated account', async () => {
    const config = createTestConfig()
    const token = await register(config, 'fb@flowlary.com', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    const res = await request(config, 'POST', '/api/feedback', {
      headers: { authorization: `Bearer ${token}` },
      body: { message: 'Great product', type: 'GENERAL_FEEDBACK', source: 'website', surface: 'support' },
    })
    expect(res.status).toBe(200)
    const item = res.body.item as { message?: string }
    expect(item.message).toBe('Great product')
  })

  it('isolates feedback between accounts', async () => {
    const config = createTestConfig()
    const tokenA = await register(config, 'a@flowlary.com', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    const tokenB = await register(config, 'b@flowlary.com', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
    await request(config, 'POST', '/api/feedback', {
      headers: { authorization: `Bearer ${tokenA}` },
      body: { message: 'Account A only', type: 'GENERAL_FEEDBACK' },
    })
    const mineB = await request(config, 'GET', '/api/feedback/mine', {
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(mineB.status).toBe(200)
    expect((mineB.body.items as unknown[]).length).toBe(0)
  })

  it('creates feature request and prevents duplicate votes', async () => {
    const config = createTestConfig()
    const token = await register(config, 'feat@flowlary.com', 'dddddddd-dddd-dddd-dddd-dddddddddddd')
    const create = await request(config, 'POST', '/api/feedback/feature-request', {
      headers: { authorization: `Bearer ${token}` },
      body: { title: 'Desktop app', description: 'Native desktop experience' },
    })
    expect(create.status).toBe(200)
    const item = create.body.item as { id: string; voteCount: number; votedByMe: boolean }
    expect(item.voteCount).toBe(1)
    expect(item.votedByMe).toBe(true)
    const voteAgain = await request(config, 'POST', `/api/feedback/feature-request/${item.id}/vote`, {
      headers: { authorization: `Bearer ${token}` },
      body: {},
    })
    expect(voteAgain.status).toBe(400)
  })

  it('gates admin routes by email allowlist', async () => {
    const config = createTestConfig()
    const userToken = await register(config, 'user@flowlary.com', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
    const denied = await request(config, 'GET', '/api/feedback/admin/summary', {
      headers: { authorization: `Bearer ${userToken}` },
    })
    expect(denied.status).toBe(403)

    const adminToken = await register(config, 'admin@flowlary.com', 'ffffffff-ffff-ffff-ffff-ffffffffffff')
    const allowed = await request(config, 'GET', '/api/feedback/admin/summary', {
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(allowed.status).toBe(200)
    expect(allowed.body.ok).toBe(true)
  })

  it('leaves protected commercial constants unchanged', () => {
    expect(FREE_DAILY_CREDITS).toBe(500)
    expect(TRIAL_DAILY_CREDITS).toBe(1000)
    expect(PRO_DAILY_CREDITS).toBe(1000)
    expect(PRO_MONTHLY_SOFT_CAP).toBe(30000)
    expect(PRO_MONTHLY_PRICE_CENTS).toBe(499)
    expect(PRO_YEARLY_PRICE_CENTS).toBe(3900)
  })
})
