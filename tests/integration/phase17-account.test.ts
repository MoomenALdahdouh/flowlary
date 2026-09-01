import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../backend/src/routes/http.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import {
  configureStorePath,
  findAccountById,
  resetStoreForTests,
  updateAccount,
  upsertSubscription,
} from '../../backend/src/db/store.ts'
import { setAccountPlan } from '../../backend/src/services/accountService.ts'
import { getUsageRecords } from '../../backend/src/services/usage.ts'
import { clearTranslationCacheForTests } from '../../backend/src/providers/translationCache.ts'
import { AI_MODELS, FREE_DAILY_CREDITS, PRO_DAILY_CREDITS } from '@flowlary/shared'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'phase17-test-secret',
    jwtSecret: 'phase17-jwt-secret',
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

describe('Phase 17 — account auth & entitlement', () => {
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

  it('registers account with email and password', async () => {
    const config = createTestConfig()
    const res = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'user@flowlary.com', password: 'password123', install_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.access_token).toBeTruthy()
    expect(res.body.refresh_token).toBeTruthy()
    expect(res.body.session_id).toBeTruthy()
  })

  it('rejects invalid login', async () => {
    const config = createTestConfig()
    await request(config, 'POST', '/api/auth/register', {
      body: { email: 'user2@flowlary.com', password: 'password123', install_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    })
    const res = await request(config, 'POST', '/api/auth/login', {
      body: { email: 'user2@flowlary.com', password: 'wrong-password' },
    })
    expect(res.status).toBe(401)
  })

  it('returns server entitlement for authenticated account', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'ent@flowlary.com', password: 'password123', install_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
    })
    const token = String(register.body.access_token)
    const res = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const entitlement = res.body.entitlement as { plan?: string; allowed?: boolean }
    expect(entitlement.plan).toBe('trial')
    expect(entitlement.allowed).toBe(true)
  })

  it('rejects duplicate registration', async () => {
    const config = createTestConfig()
    const body = { email: 'dup@flowlary.com', password: 'password123' }
    const first = await request(config, 'POST', '/api/auth/register', { body })
    expect(first.status).toBe(200)
    const second = await request(config, 'POST', '/api/auth/register', { body })
    expect(second.status).toBe(409)
  })

  it('rejects invalid access tokens', async () => {
    const config = createTestConfig()
    const res = await request(config, 'GET', '/api/account', {
      headers: { authorization: 'Bearer not-a-valid-token' },
    })
    expect(res.status).toBe(401)
  })

  it('migrates expired trial to free with daily credits (ignores legacy usageBalanceMs)', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'trial-end@flowlary.com', password: 'password123' },
    })
    const account = register.body.account as { id?: string }
    expect(account.id).toBeTruthy()
    const row = findAccountById(String(account.id))
    expect(row).toBeTruthy()
    row!.plan = 'trial'
    row!.trialEndsAt = Date.now() - 1_000
    row!.usageBalanceMs = 90_000
    row!.dailyCreditsUsed = 0
    updateAccount(row!)

    const token = String(register.body.access_token)
    const res = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const entitlement = res.body.entitlement as {
      plan?: string
      allowed?: boolean
      creditsRemaining?: number
      dailyLimit?: number
    }
    expect(entitlement.plan).toBe('free')
    expect(entitlement.allowed).toBe(true)
    expect(entitlement.dailyLimit).toBe(FREE_DAILY_CREDITS)
    expect(entitlement.creditsRemaining).toBe(FREE_DAILY_CREDITS)
    expect(findAccountById(String(account.id))?.plan).toBe('free')
  })

  it('does not grant pro from client entitlement header when usage is exhausted', async () => {
    const config = createTestConfig()
    const installId = 'dddddddd-dddd-dddd-dddd-dddddddddddddd'
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'free@flowlary.com', password: 'password123', install_id: installId },
    })
    const token = String(register.body.access_token)
    const account = register.body.account as { id?: string }
    expect(account.id).toBeTruthy()
    setAccountPlan(String(account.id), 'free')
    const row = findAccountById(String(account.id))
    expect(row).toBeTruthy()
    row!.dailyCreditsUsed = FREE_DAILY_CREDITS
    row!.dailyCreditsDayKey = new Date().toISOString().slice(0, 10)
    updateAccount(row!)

    const res = await request(config, 'POST', '/api/ai/translation', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-flowlary-install-id': installId,
        'x-flowlary-entitlement': 'pro',
      },
      body: { text: 'hello', source_language: 'en', target_language: 'ar' },
    })
    expect(res.status).toBe(403)
    expect((res.body.error as { code?: string } | undefined)?.code).toBe('AI_ENTITLEMENT_DENIED')
  })

  it('preserves install-only register for legacy clients', async () => {
    const config = createTestConfig()
    const installId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    const res = await request(config, 'POST', '/api/auth/register', {
      body: { install_id: installId },
    })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.install_id).toBe(installId)
  })

  it('denies AI for install-token auth without account (Phase 27)', async () => {
    const config = createTestConfig()
    const installId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    const reg = await request(config, 'POST', '/api/auth/register', { body: { install_id: installId } })
    const token = String(reg.body.token)
    const res = await request(config, 'POST', '/api/ai/translation', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-flowlary-install-id': installId,
        'x-flowlary-entitlement': 'anonymous',
      },
      body: { text: 'hello', source_language: 'en', target_language: 'ar' },
    })
    expect(res.status).toBe(403)
  })

  it('debits weighted credits on successful translation (weight 2)', async () => {
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

    const config = createTestConfig()
    const installId = '15151515-1515-1515-1515-151515151515'
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'credits@flowlary.com', password: 'password123', install_id: installId },
    })
    const token = String(register.body.access_token)
    const account = register.body.account as { id?: string; creditsRemaining?: number }
    expect(account.id).toBeTruthy()
    setAccountPlan(String(account.id), 'free')

    const before = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const beforeEnt = before.body.entitlement as { creditsRemaining?: number }
    expect(beforeEnt.creditsRemaining).toBe(FREE_DAILY_CREDITS)

    await request(config, 'POST', '/api/ai/translation', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-flowlary-install-id': installId,
      },
      body: { text: 'hello', source_language: 'en', target_language: 'ar' },
    })

    const after = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const afterEnt = after.body.entitlement as { creditsRemaining?: number; creditsUsed?: number }
    expect(afterEnt.creditsUsed).toBe(2)
    expect(afterEnt.creditsRemaining).toBe(FREE_DAILY_CREDITS - 2)
  })

  it('trial registration lasts 30 days and grants Pro-level daily limit', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'trial30@flowlary.com', password: 'password123' },
    })
    const account = register.body.account as { id?: string }
    const row = findAccountById(String(account.id))
    expect(row?.plan).toBe('trial')
    expect((row!.trialEndsAt ?? 0) - row!.createdAt).toBeGreaterThanOrEqual(29 * 24 * 60 * 60 * 1000)
    const token = String(register.body.access_token)
    const res = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const entitlement = res.body.entitlement as {
      plan?: string
      dailyLimit?: number
      capabilities?: string[]
      inTrial?: boolean
    }
    expect(entitlement.plan).toBe('trial')
    expect(entitlement.inTrial).toBe(true)
    expect(entitlement.dailyLimit).toBe(PRO_DAILY_CREDITS)
    expect(entitlement.capabilities).toContain('learning.export')
    expect(entitlement.capabilities).toContain('practice.full')
  })

  it('refreshes access token and rejects after logout', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: {
        email: 'refresh@flowlary.com',
        password: 'password123',
        install_id: '12121212-1212-1212-1212-121212121212',
      },
    })
    const refreshToken = String(register.body.refresh_token)
    const sessionId = String(register.body.session_id)

    const refreshed = await request(config, 'POST', '/api/auth/refresh', {
      body: { refresh_token: refreshToken, session_id: sessionId },
    })
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.access_token).toBeTruthy()

    const accessToken = String(refreshed.body.access_token)
    await request(config, 'POST', '/api/auth/logout', {
      headers: { authorization: `Bearer ${accessToken}` },
      body: { session_id: String(refreshed.body.session_id) },
    })

    const denied = await request(config, 'POST', '/api/auth/refresh', {
      body: {
        refresh_token: String(refreshed.body.refresh_token),
        session_id: String(refreshed.body.session_id),
      },
    })
    expect(denied.status).toBe(401)
  })

  it('logout invalidates only the current session', async () => {
    const config = createTestConfig()
    const first = await request(config, 'POST', '/api/auth/register', {
      body: {
        email: 'multi-session@flowlary.com',
        password: 'password123',
        install_id: '13131313-1313-1313-1313-131313131313',
      },
    })
    const second = await request(config, 'POST', '/api/auth/login', {
      body: {
        email: 'multi-session@flowlary.com',
        password: 'password123',
        install_id: '14141414-1414-1414-1414-141414141414',
      },
    })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    await request(config, 'POST', '/api/auth/logout', {
      headers: { authorization: `Bearer ${String(first.body.access_token)}` },
      body: { session_id: String(first.body.session_id) },
    })

    const firstDenied = await request(config, 'POST', '/api/auth/refresh', {
      body: {
        refresh_token: String(first.body.refresh_token),
        session_id: String(first.body.session_id),
      },
    })
    const secondKept = await request(config, 'POST', '/api/auth/refresh', {
      body: {
        refresh_token: String(second.body.refresh_token),
        session_id: String(second.body.session_id),
      },
    })
    expect(firstDenied.status).toBe(401)
    expect(secondKept.status).toBe(200)
  })

  it('issues an independent device session without invalidating the website session', async () => {
    const config = createTestConfig()
    const website = await request(config, 'POST', '/api/auth/register', {
      body: {
        email: 'device-session@flowlary.com',
        password: 'password123',
        install_id: '15151515-1515-1515-1515-151515151515',
      },
    })
    expect(website.status).toBe(200)

    const device = await request(config, 'POST', '/api/auth/device-session', {
      headers: {
        authorization: `Bearer ${String(website.body.access_token)}`,
        'x-flowlary-install-id': '16161616-1616-1616-1616-161616161616',
      },
      body: { install_id: '16161616-1616-1616-1616-161616161616' },
    })
    expect(device.status).toBe(200)
    expect(device.body.session_id).toBeTruthy()
    expect(device.body.session_id).not.toBe(website.body.session_id)
    expect(device.body.refresh_token).not.toBe(website.body.refresh_token)

    const websiteRefresh = await request(config, 'POST', '/api/auth/refresh', {
      body: {
        refresh_token: String(website.body.refresh_token),
        session_id: String(website.body.session_id),
      },
    })
    expect(websiteRefresh.status).toBe(200)

    const deviceRefresh = await request(config, 'POST', '/api/auth/refresh', {
      body: {
        refresh_token: String(device.body.refresh_token),
        session_id: String(device.body.session_id),
      },
    })
    expect(deviceRefresh.status).toBe(200)
  })

  it('requires authentication for GET /api/account', async () => {
    const config = createTestConfig()
    const res = await request(config, 'GET', '/api/account')
    expect(res.status).toBe(401)
  })

  it('records usage for authenticated account AI requests', async () => {
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

    const config = createTestConfig()
    const installId = '13131313-1313-1313-1313-131313131313'
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'usage@flowlary.com', password: 'password123', install_id: installId },
    })
    const token = String(register.body.access_token)
    const account = register.body.account as { id?: string }
    expect(account.id).toBeTruthy()

    const response = await request(config, 'POST', '/api/ai/translation', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-flowlary-install-id': installId,
      },
      body: { text: 'hello', source_language: 'en', target_language: 'ar' },
    })
    expect(response.status, JSON.stringify(response.body)).toBe(200)

    const usage = getUsageRecords({ userId: String(account.id), operation: 'translation' })
    expect(usage.length).toBeGreaterThanOrEqual(1)
    expect(usage.at(-1)?.status).toBe('success')
  })

  it('returns 429 when rate limit exceeded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          model: AI_MODELS.TRANSLATION,
          choices: [{ message: { content: 'x' } }],
        }),
      })),
    )

    const config = createTestConfig()
    const installId = '14141414-1414-1414-1414-141414141414'
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'rate@flowlary.com', password: 'password123', install_id: installId },
    })
    const token = String(register.body.access_token)
    const headers = {
      authorization: `Bearer ${token}`,
      'x-flowlary-install-id': installId,
      'x-flowlary-entitlement': 'trial',
    }
    const body = { text: 'hello', source_language: 'en', target_language: 'ar' }

    let lastStatus = 200
    let lastCode: string | undefined
    for (let i = 0; i < 65; i += 1) {
      const res = await request(config, 'POST', '/api/ai/translation', { headers, body })
      lastStatus = res.status
      lastCode = (res.body.error as { code?: string } | undefined)?.code
      if (res.status === 429) break
    }
    expect(lastStatus).toBe(429)
    expect(lastCode).toBe('AI_RATE_LIMITED')
  })

  it('prevents concurrent requests from overspending the last remaining credit', async () => {
    let resolveFetch: (() => void) | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = () =>
              resolve({
                ok: true,
                json: async () => ({
                  model: AI_MODELS.TRANSLATION,
                  choices: [{ message: { content: 'مرحبا' } }],
                  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
              })
          }),
      ),
    )

    const config = createTestConfig()
    const installId = '16161616-1616-1616-1616-161616161616'
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'concurrent@flowlary.com', password: 'password123', install_id: installId },
    })
    const token = String(register.body.access_token)
    const accountId = String((register.body.account as { id: string }).id)
    setAccountPlan(accountId, 'free')
    const row = findAccountById(accountId)!
    row.dailyCreditsUsed = FREE_DAILY_CREDITS - 2
    row.dailyCreditsDayKey = new Date().toISOString().slice(0, 10)
    updateAccount(row)

    const headers = {
      authorization: `Bearer ${token}`,
      'x-flowlary-install-id': installId,
    }

    const firstRequest = request(config, 'POST', '/api/ai/translation', {
      headers,
      body: { text: 'hello', source_language: 'en', target_language: 'ar' },
    })
    await Promise.resolve()
    const second = await request(config, 'POST', '/api/ai/translation', {
      headers,
      body: { text: 'hello', source_language: 'en', target_language: 'ar' },
    })

    expect(second.status).toBe(403)
    expect((second.body.error as { code?: string } | undefined)?.code).toBe('AI_ENTITLEMENT_DENIED')

    resolveFetch?.()
    const first = await firstRequest
    expect(first.status, JSON.stringify(first.body)).toBe(200)

    const entitlement = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((entitlement.body.entitlement as { creditsUsed?: number }).creditsUsed).toBe(FREE_DAILY_CREDITS)
  })

  it('keeps Pro during past_due and downgrades after canceled period end', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'billing@flowlary.com', password: 'password123' },
    })
    const token = String(register.body.access_token)
    const accountId = String((register.body.account as { id: string }).id)
    const row = findAccountById(accountId)!
    row.plan = 'free'
    updateAccount(row)

    upsertSubscription({
      accountId,
      paddleCustomerId: 'ctm_test',
      paddleSubscriptionId: 'sub_test_due',
      status: 'past_due',
      priceId: 'pri_test',
      plan: 'pro',
      currentPeriodStart: Date.now() - 10_000,
      currentPeriodEnd: Date.now() + 86_400_000,
      cancelAtPeriodEnd: false,
      paymentFailed: true,
      lastWebhookAt: Date.now(),
      lastEventOccurredAt: null,
      billingEnvironment: 'sandbox',
    })

    const pastDue = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const pastDueEnt = pastDue.body.entitlement as { plan?: string; isPro?: boolean; subscription?: { status?: string } }
    expect(pastDueEnt.plan).toBe('pro')
    expect(pastDueEnt.isPro).toBe(true)
    expect(pastDueEnt.subscription?.status).toBe('past_due')

    upsertSubscription({
      accountId,
      paddleCustomerId: 'ctm_test',
      paddleSubscriptionId: 'sub_test_due',
      status: 'canceled',
      priceId: 'pri_test',
      plan: 'pro',
      currentPeriodStart: Date.now() - 172_800_000,
      currentPeriodEnd: Date.now() - 1_000,
      cancelAtPeriodEnd: true,
      paymentFailed: false,
      lastWebhookAt: Date.now(),
      lastEventOccurredAt: null,
      billingEnvironment: 'sandbox',
    })

    const expired = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const expiredEnt = expired.body.entitlement as {
      plan?: string
      isPro?: boolean
      subscription?: { status?: string; plan?: string }
      capabilities?: string[]
    }
    expect(expiredEnt.plan).toBe('free')
    expect(expiredEnt.isPro).toBe(false)
    expect(expiredEnt.subscription?.status).toBe('expired')
    expect(expiredEnt.subscription?.plan).toBe('free')
    expect(expiredEnt.capabilities).toContain('keyboard.unlimited')
    expect(expiredEnt.capabilities).not.toContain('learning.export')
  })
})
