import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../backend/src/routes/http.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import { configureStorePath, resetStoreForTests } from '../../backend/src/db/store.ts'
import { resetProductStatisticsCacheForTests } from '../../backend/src/services/productStatisticsService.ts'
import { clearTranslationCacheForTests } from '../../backend/src/providers/translationCache.ts'
import {
  FREE_DAILY_CREDITS,
  PRO_DAILY_CREDITS,
  PRO_MONTHLY_SOFT_CAP,
  PRO_MONTHLY_PRICE_CENTS,
  PRO_YEARLY_PRICE_CENTS,
  PRODUCT_STATISTICS_THRESHOLDS,
  TRIAL_DAILY_CREDITS,
} from '@flowlary/shared'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'phase2-trust-secret',
    jwtSecret: 'phase2-jwt-secret',
    dataPath: ':memory:',
    groqApiKey: 'test-groq-key-not-real',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    feedbackAdminEmails: ['admin@flowlary.com'],
    publicStatsEnabled: true,
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

describe('Phase 2 — trust & product statistics', () => {
  beforeEach(() => {
    clearTranslationCacheForTests()
    resetRoutesForTests()
    resetRateLimitsForTests()
    resetProductStatisticsCacheForTests()
    resetStoreForTests()
    configureStorePath(':memory:')
  })

  afterEach(() => {
    resetRoutesForTests()
    vi.restoreAllMocks()
  })

  it('returns public stats without auth and omits unavailable metrics', async () => {
    const config = createTestConfig()
    const res = await request(config, 'GET', '/api/public/stats')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const stats = res.body.stats as { metrics?: Record<string, number>; metricStates?: Record<string, string> }
    expect(stats.metrics?.registeredUsers).toBeUndefined()
    expect(stats.metricStates?.registeredUsers).toBe('INSUFFICIENT_DATA')
    expect(Array.isArray(res.body.platforms)).toBe(true)
  })

  it('shows registered users only when accounts exist', async () => {
    const config = createTestConfig()
    await request(config, 'POST', '/api/auth/register', {
      body: { email: 'writer@flowlary.com', password: 'password123', install_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    })
    const res = await request(config, 'GET', '/api/public/stats')
    const stats = res.body.stats as { metrics?: { registeredUsers?: number } }
    expect(stats.metrics?.registeredUsers).toBe(1)
  })

  it('does not expose fake store ratings without verified config', async () => {
    const config = createTestConfig({ verifiedChromeRating: null, verifiedChromeReviewCount: null })
    const res = await request(config, 'GET', '/api/public/stats')
    const stats = res.body.stats as { storeRatings?: unknown; metrics?: Record<string, number> }
    expect(stats.storeRatings).toBeUndefined()
    expect(stats.metrics?.chromeRating).toBeUndefined()
  })

  it('includes verified store ratings only when configured', async () => {
    const config = createTestConfig({ verifiedChromeRating: 4.8, verifiedChromeReviewCount: 120 })
    const res = await request(config, 'GET', '/api/public/stats')
    const stats = res.body.stats as { storeRatings?: { chrome?: { rating: number } } }
    expect(stats.storeRatings?.chrome?.rating).toBe(4.8)
  })

  it('returns personal statistics for authenticated account', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'stats@flowlary.com', password: 'password123', install_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    })
    const token = String(register.body.access_token)
    const res = await request(config, 'GET', '/api/account/statistics', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const statistics = res.body.statistics as { writingChecksUsed: number }
    expect(statistics.writingChecksUsed).toBe(0)
  })

  it('gates growth admin dashboard', async () => {
    const config = createTestConfig()
    const user = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'user@flowlary.com', password: 'password123', install_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
    })
    const denied = await request(config, 'GET', '/api/admin/growth/summary', {
      headers: { authorization: `Bearer ${String(user.body.access_token)}` },
    })
    expect(denied.status).toBe(403)
  })

  it('creates testimonial only with explicit consent', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 't@flowlary.com', password: 'password123', install_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' },
    })
    const token = String(register.body.access_token)
    await request(config, 'POST', '/api/feedback', {
      headers: { authorization: `Bearer ${token}` },
      body: {
        type: 'PRAISE',
        message: 'Flowlary keeps me writing.',
        testimonialConsent: 'yes',
        testimonialDisplayPreference: 'anonymous',
      },
    })
    const admin = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'admin@flowlary.com', password: 'password123', install_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' },
    })
    const adminRes = await request(config, 'GET', '/api/admin/testimonials', {
      headers: { authorization: `Bearer ${String(admin.body.access_token)}` },
    })
    expect(adminRes.status).toBe(200)
    const items = adminRes.body.items as Array<{ consentGiven: boolean; published: boolean }>
    expect(items.length).toBe(1)
    expect(items[0]?.consentGiven).toBe(true)
    expect(items[0]?.published).toBe(false)
  })

  it('respects minimum internal rating threshold', () => {
    expect(PRODUCT_STATISTICS_THRESHOLDS.minInternalRatings).toBeGreaterThanOrEqual(3)
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
