import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../backend/src/routes/http.ts'
import { configureStorePath, appendUsage, resetStoreForTests, upsertSubscription } from '../../backend/src/db/store.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'admin-panel-secret',
    jwtSecret: 'admin-panel-jwt',
    dataPath: ':memory:',
    groqApiKey: 'test-groq-key-not-real',
    geminiApiKey: '',
    openRouterApiKey: '',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    feedbackAdminEmails: ['admin@flowlary.com'],
    paddleEnvironment: 'sandbox',
    paddleApiKey: '',
    paddleWebhookSecret: '',
    paddleClientToken: '',
    paddlePriceIdPro: 'pri_test_month',
    paddlePriceIdProYearly: '',
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

async function register(config: AppConfig, email: string, install: string) {
  return request(config, 'POST', '/api/auth/register', {
    body: { email, password: 'password123', install_id: install },
  })
}

describe('Admin panel APIs', () => {
  beforeEach(() => {
    resetRoutesForTests()
    resetStoreForTests()
    configureStorePath(':memory:')
  })

  afterEach(() => {
    resetRoutesForTests()
  })

  it('rejects unauthenticated admin access', async () => {
    const config = createTestConfig()
    const res = await request(config, 'GET', '/api/admin/overview')
    expect(res.status).toBe(401)
  })

  it('rejects non-admin access to admin APIs', async () => {
    const config = createTestConfig()
    const user = await register(config, 'user@flowlary.com', '11111111-1111-1111-1111-111111111111')
    const token = String(user.body.access_token)
    for (const path of [
      '/api/admin/overview',
      '/api/admin/users',
      '/api/admin/subscriptions',
      '/api/admin/usage',
      '/api/admin/activity',
      '/api/admin/settings',
      '/api/admin/search?q=user',
    ]) {
      const res = await request(config, 'GET', path, { headers: { authorization: `Bearer ${token}` } })
      expect(res.status).toBe(403)
    }
  })

  it('allows admin overview with real empty metrics', async () => {
    const config = createTestConfig()
    const admin = await register(config, 'admin@flowlary.com', '22222222-2222-2222-2222-222222222222')
    const res = await request(config, 'GET', '/api/admin/overview?rangeDays=30', {
      headers: { authorization: `Bearer ${String(admin.body.access_token)}` },
    })
    expect(res.status).toBe(200)
    const overview = res.body.overview as { kpis: { totalUsers: { value: number }; aiRequests: { value: number } } }
    expect(overview.kpis.totalUsers.value).toBe(1)
    expect(overview.kpis.aiRequests.value).toBe(0)
  })

  it('paginates and searches users', async () => {
    const config = createTestConfig()
    await register(config, 'alpha@flowlary.com', '33333333-3333-3333-3333-333333333333')
    const admin = await register(config, 'admin@flowlary.com', '44444444-4444-4444-4444-444444444444')
    const token = String(admin.body.access_token)
    const listed = await request(config, 'GET', '/api/admin/users?page=1&pageSize=1', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listed.status).toBe(200)
    expect((listed.body.items as unknown[]).length).toBe(1)
    expect(listed.body.total).toBe(2)

    const search = await request(config, 'GET', '/api/admin/users?q=alpha', {
      headers: { authorization: `Bearer ${token}` },
    })
    const items = search.body.items as Array<{ email: string }>
    expect(items).toHaveLength(1)
    expect(items[0]?.email).toBe('alpha@flowlary.com')
  })

  it('returns user detail and protects suspend confirmation and self-lockout', async () => {
    const config = createTestConfig()
    const user = await register(config, 'member@flowlary.com', '55555555-5555-5555-5555-555555555555')
    const admin = await register(config, 'admin@flowlary.com', '66666666-6666-6666-6666-666666666666')
    const token = String(admin.body.access_token)
    const userId = String(user.body.account ? (user.body.account as { id: string }).id : '')
    const accountId = userId || String((user.body as { account_id?: string }).account_id ?? '')
    const list = await request(config, 'GET', '/api/admin/users?q=member', {
      headers: { authorization: `Bearer ${token}` },
    })
    const id = (list.body.items as Array<{ id: string }>)[0]!.id

    const detail = await request(config, 'GET', `/api/admin/users/${id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(detail.status).toBe(200)
    expect((detail.body.user as { account: { email: string } }).account.email).toBe('member@flowlary.com')

    const missingConfirm = await request(config, 'POST', `/api/admin/users/${id}/suspend`, {
      headers: { authorization: `Bearer ${token}` },
      body: {},
    })
    expect(missingConfirm.status).toBe(400)

    const adminList = await request(config, 'GET', '/api/admin/users?q=admin@flowlary.com', {
      headers: { authorization: `Bearer ${token}` },
    })
    const adminId = (adminList.body.items as Array<{ id: string }>)[0]!.id
    const self = await request(config, 'POST', `/api/admin/users/${adminId}/suspend`, {
      headers: { authorization: `Bearer ${token}` },
      body: { confirm: true },
    })
    expect(self.status).toBe(400)

    const suspended = await request(config, 'POST', `/api/admin/users/${id}/suspend`, {
      headers: { authorization: `Bearer ${token}` },
      body: { confirm: true },
    })
    expect(suspended.status).toBe(200)
    expect((suspended.body.user as { account: { status: string } }).account.status).toBe('suspended')

    const activity = await request(config, 'GET', '/api/admin/activity', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((activity.body.items as Array<{ action: string }>)[0]?.action).toBe('account.suspend')

    const restoreMissing = await request(config, 'POST', `/api/admin/users/${id}/restore`, {
      headers: { authorization: `Bearer ${token}` },
      body: {},
    })
    expect(restoreMissing.status).toBe(400)
    const restored = await request(config, 'POST', `/api/admin/users/${id}/restore`, {
      headers: { authorization: `Bearer ${token}` },
      body: { confirm: true },
    })
    expect(restored.status).toBe(200)
    expect((restored.body.user as { account: { status: string } }).account.status).toBe('active')
    void accountId
  })

  it('lists subscriptions without implying live billing and hides secrets in settings', async () => {
    const config = createTestConfig()
    const user = await register(config, 'paid@flowlary.com', '77777777-7777-7777-7777-777777777777')
    const admin = await register(config, 'admin@flowlary.com', '88888888-8888-8888-8888-888888888888')
    const list = await request(config, 'GET', '/api/admin/users?q=paid', {
      headers: { authorization: `Bearer ${String(admin.body.access_token)}` },
    })
    const accountId = (list.body.items as Array<{ id: string }>)[0]!.id
    upsertSubscription({
      accountId,
      paddleCustomerId: 'ctm_test',
      paddleSubscriptionId: 'sub_test',
      status: 'active',
      priceId: 'pri_test_month',
      plan: 'pro',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 86400000,
      cancelAtPeriodEnd: false,
      paymentFailed: false,
      lastWebhookAt: Date.now(),
      lastEventOccurredAt: null,
      billingEnvironment: 'sandbox',
    })

    const subs = await request(config, 'GET', '/api/admin/subscriptions', {
      headers: { authorization: `Bearer ${String(admin.body.access_token)}` },
    })
    expect(subs.status).toBe(200)
    expect((subs.body.items as unknown[]).length).toBe(1)

    const settings = await request(config, 'GET', '/api/admin/settings', {
      headers: { authorization: `Bearer ${String(admin.body.access_token)}` },
    })
    const payload = JSON.stringify(settings.body)
    expect(payload).not.toContain('test-groq-key-not-real')
    expect(payload).not.toContain('GROQ_API_KEY')
    expect(payload).not.toContain('PADDLE_API_KEY')
    const settingsView = settings.body.settings as { billing: { environment: string; configured: boolean }; providers: { groq: string } }
    expect(settingsView.billing.environment).toBe('sandbox')
    expect(settingsView.billing.configured).toBe(false)
    expect(settingsView.providers.groq).toBe('configured')
    void user
  })

  it('aggregates usage without fabricating cache hits', async () => {
    const config = createTestConfig()
    const user = await register(config, 'writer@flowlary.com', '99999999-9999-9999-9999-999999999999')
    const admin = await register(config, 'admin@flowlary.com', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1')
    const list = await request(config, 'GET', '/api/admin/users?q=writer', {
      headers: { authorization: `Bearer ${String(admin.body.access_token)}` },
    })
    const accountId = (list.body.items as Array<{ id: string }>)[0]!.id
    appendUsage({
      accountId,
      userId: accountId,
      operation: 'correction',
      model: 'llama-3.1',
      status: 'success',
      latencyMs: 12,
      creditsCharged: 1,
      requestId: 'req-1',
      createdAt: Date.now(),
      plan: 'trial',
    })
    const usage = await request(config, 'GET', '/api/admin/usage?rangeDays=30', {
      headers: { authorization: `Bearer ${String(admin.body.access_token)}` },
    })
    expect(usage.status).toBe(200)
    const view = usage.body.usage as { totals: { requests: number }; cacheHits: { available: boolean } }
    expect(view.totals.requests).toBe(1)
    expect(view.cacheHits.available).toBe(false)
    void user
  })

  it('does not allow a normal user to call destructive admin endpoints', async () => {
    const config = createTestConfig()
    const user = await register(config, 'normal@flowlary.com', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')
    const admin = await register(config, 'admin@flowlary.com', 'cccccccc-cccc-cccc-cccc-ccccccccccc1')
    const list = await request(config, 'GET', '/api/admin/users?q=normal', {
      headers: { authorization: `Bearer ${String(admin.body.access_token)}` },
    })
    const id = (list.body.items as Array<{ id: string }>)[0]!.id
    const res = await request(config, 'POST', `/api/admin/users/${id}/suspend`, {
      headers: { authorization: `Bearer ${String(user.body.access_token)}` },
      body: { confirm: true },
    })
    expect(res.status).toBe(403)
  })
})
