import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../../backend/src/config/env.ts'
import { loadConfig } from '../../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../../backend/src/routes/http.ts'
import { resetRateLimitsForTests } from '../../../backend/src/middleware/rateLimit.ts'
import { appendUsage, configureStorePath, resetStoreForTests } from '../../../backend/src/db/store.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'admin-test-secret',
    jwtSecret: 'admin-jwt-secret',
    dataPath: ':memory:',
    groqApiKey: '',
    geminiApiKey: '',
    openRouterApiKey: '',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    feedbackAdminEmails: ['admin@flowlary.com'],
    webOrigin: 'https://flowlary.com',
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

describe('Platform admin APIs', () => {
  beforeEach(() => {
    resetStoreForTests()
    resetRoutesForTests()
    resetRateLimitsForTests()
  })

  afterEach(() => {
    resetStoreForTests()
  })

  it('rejects unauthenticated and non-admin users', async () => {
    const config = createTestConfig()
    const anon = await request(config, 'GET', '/api/admin/overview')
    expect(anon.status).toBe(401)
    const user = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'user@flowlary.com', password: 'password123' },
    })
    const denied = await request(config, 'GET', '/api/admin/overview', {
      headers: { authorization: `Bearer ${String(user.body.access_token)}` },
    })
    expect(denied.status).toBe(403)
  })

  it('returns overview metrics and empty-honest usage for admins', async () => {
    const config = createTestConfig()
    const admin = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'admin@flowlary.com', password: 'password123' },
    })
    const token = String(admin.body.access_token)
    const overview = await request(config, 'GET', '/api/admin/overview?rangeDays=7', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(overview.status).toBe(200)
    const body = overview.body.overview as { kpis: { totalUsers: { value: number } }; estimatedCatalogMrrNote: string }
    expect(body.kpis.totalUsers.value).toBeGreaterThanOrEqual(1)
    expect(body.estimatedCatalogMrrNote).toBe('unavailable')
    const settings = await request(config, 'GET', '/api/admin/settings', {
      headers: { authorization: `Bearer ${token}` },
    })
    const providers = (settings.body.settings as { providers: Record<string, string> }).providers
    expect(JSON.stringify(settings.body)).not.toMatch(/gsk_|GROQ_API_KEY|jwtSecret/)
    expect(providers.groq).toBe('not_configured')
  })

  it('lists users, details, and records audited suspend with confirmation', async () => {
    const config = createTestConfig()
    const user = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'writer@flowlary.com', password: 'password123' },
    })
    const admin = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'admin@flowlary.com', password: 'password123' },
    })
    const userId = String((user.body.account as { id: string }).id)
    appendUsage({
      accountId: userId,
      userId,
      operation: 'correction',
      model: 'openai/gpt-oss-20b',
      status: 'success',
      latencyMs: 12,
      creditsCharged: 1,
      requestId: 'req-1',
      createdAt: Date.now(),
      plan: 'free',
    })
    const token = String(admin.body.access_token)
    const list = await request(config, 'GET', '/api/admin/users', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(list.status).toBe(200)
    const emails = ((list.body.items as { email: string }[]) ?? []).map((row) => row.email)
    expect(emails).toContain('writer@flowlary.com')
    expect(emails).toContain('admin@flowlary.com')
    const filtered = await request(config, 'GET', '/api/admin/users?q=writer', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(filtered.status).toBe(200)
    expect(((filtered.body.items as { email: string }[]) ?? []).some((row) => row.email === 'writer@flowlary.com')).toBe(true)
    expect(((filtered.body.items as { email: string }[]) ?? []).some((row) => row.email === 'admin@flowlary.com')).toBe(false)
    const detail = await request(config, 'GET', `/api/admin/users/${userId}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(detail.status).toBe(200)
    const missing = await request(config, 'POST', `/api/admin/users/${userId}/suspend`, {
      headers: { authorization: `Bearer ${token}` },
      body: {},
    })
    expect(missing.status).toBe(400)
    const suspended = await request(config, 'POST', `/api/admin/users/${userId}/suspend`, {
      headers: { authorization: `Bearer ${token}` },
      body: { confirm: true },
    })
    expect(suspended.status).toBe(200)
    const usage = await request(config, 'GET', '/api/admin/usage?rangeDays=7', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(((usage.body.usage as { byProvider: { provider: string }[] }).byProvider.some((row) => row.provider === 'groq'))).toBe(true)
    const activity = await request(config, 'GET', '/api/admin/activity', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(((activity.body.items as { action: string }[]) ?? []).some((row) => row.action === 'account.suspend')).toBe(true)
    const restoreMissing = await request(config, 'POST', `/api/admin/users/${userId}/restore`, {
      headers: { authorization: `Bearer ${token}` },
      body: {},
    })
    expect(restoreMissing.status).toBe(400)
    const restored = await request(config, 'POST', `/api/admin/users/${userId}/restore`, {
      headers: { authorization: `Bearer ${token}` },
      body: { confirm: true },
    })
    expect(restored.status).toBe(200)
  })

  it('does not allow IDOR from a normal user to another account via admin user detail', async () => {
    const config = createTestConfig()
    const userA = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'a@flowlary.com', password: 'password123' },
    })
    const userB = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'b@flowlary.com', password: 'password123' },
    })
    const idA = String((userA.body.account as { id: string }).id)
    const denied = await request(config, 'GET', `/api/admin/users/${idA}`, {
      headers: { authorization: `Bearer ${String(userB.body.access_token)}` },
    })
    expect(denied.status).toBe(403)
  })
})
