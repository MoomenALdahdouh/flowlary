import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../../backend/src/config/env.ts'
import { loadConfig } from '../../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../../backend/src/routes/http.ts'
import { configureStorePath, resetStoreForTests } from '../../../backend/src/db/store.ts'
import { setEmailSenderForTests } from '../../../backend/src/services/emailService.ts'
import { clearTranslationCacheForTests } from '../../../backend/src/providers/translationCache.ts'
import { ACCOUNT_TRIAL_DURATION_MS, PRO_DAILY_CREDITS } from '@flowlary/shared'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'wl9-email-test-secret',
    jwtSecret: 'wl9-email-jwt-secret',
    dataPath: ':memory:',
    groqApiKey: 'test-groq-key-not-real',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    smtpHost: '127.0.0.1',
    webOrigin: 'https://flowlary.test',
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

function extractTokenFromEmail(html: string): string | null {
  const match = html.match(/verify-email\?token=([^"&]+)/)
  if (!match?.[1]) return null
  return decodeURIComponent(match[1])
}

describe('WL-9 — email verification (link tokens)', () => {
  let lastHtml: string | null = null

  beforeEach(() => {
    clearTranslationCacheForTests()
    resetRoutesForTests()
    resetStoreForTests()
    configureStorePath(':memory:')
    lastHtml = null
    setEmailSenderForTests(async (payload) => {
      lastHtml = payload.html
      return { ok: true }
    })
  })

  afterEach(() => {
    setEmailSenderForTests(null)
    resetRoutesForTests()
  })

  async function register(config: AppConfig, email: string) {
    return request(config, 'POST', '/api/auth/register', {
      body: { email, password: 'password123', install_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    })
  }

  it('registers unverified trial accounts and sends verification email with link', async () => {
    const config = createTestConfig()
    const res = await register(config, 'verify@flowlary.com')
    expect(res.status).toBe(200)
    const account = res.body.account as {
      emailVerified?: boolean
      plan?: string
      trialEndsAt?: number
      dailyLimit?: number
    }
    expect(account.emailVerified).toBe(false)
    expect(account.plan).toBe('trial')
    expect(account.trialEndsAt).toBeGreaterThan(Date.now() + ACCOUNT_TRIAL_DURATION_MS - 60_000)
    expect(account.dailyLimit ?? PRO_DAILY_CREDITS).toBe(PRO_DAILY_CREDITS)
    const token = extractTokenFromEmail(String(lastHtml))
    expect(token).toBeTruthy()
    expect(String(lastHtml)).toContain('https://flowlary.test/account/verify-email?token=')
    expect(String(lastHtml)).toContain('Verify email')
  })

  it('verifies email with valid token via GET', async () => {
    const config = createTestConfig()
    await register(config, 'good@flowlary.com')
    const token = extractTokenFromEmail(String(lastHtml))
    const verified = await request(config, 'GET', `/api/auth/verify-email?token=${encodeURIComponent(token!)}`)
    expect(verified.status).toBe(200)
    expect(verified.body.status).toBe('verified')
    expect((verified.body.account as { emailVerified?: boolean }).emailVerified).toBe(true)
  })

  it('rejects reused and cross-account tokens', async () => {
    const config = createTestConfig()
    await register(config, 'a@flowlary.com')
    const tokenA = extractTokenFromEmail(String(lastHtml))
    await register(config, 'b@flowlary.com')
    const tokenB = extractTokenFromEmail(String(lastHtml))

    const first = await request(config, 'GET', `/api/auth/verify-email?token=${encodeURIComponent(tokenA!)}`)
    expect(first.status).toBe(200)
    expect(first.body.status).toBe('verified')

    const reuse = await request(config, 'GET', `/api/auth/verify-email?token=${encodeURIComponent(tokenA!)}`)
    expect(reuse.status).toBe(400)
    expect(reuse.body.status).toBe('invalid_token')

    const cross = await request(config, 'GET', `/api/auth/verify-email?token=${encodeURIComponent(tokenB!)}`)
    expect(cross.status).toBe(200)
    expect((cross.body.account as { email?: string }).email).toBe('b@flowlary.com')
  })

  it('returns expired_token for expired verification links', async () => {
    const config = createTestConfig()
    const registerRes = await register(config, 'expired@flowlary.com')
    const token = extractTokenFromEmail(String(lastHtml))
    const accountId = (registerRes.body.account as { id: string }).id
    const { getEmailVerification, setEmailVerification } = await import('../../../backend/src/db/store.ts')
    const existing = getEmailVerification(accountId)!
    setEmailVerification({ ...existing, expiresAt: Date.now() - 1 })

    const expired = await request(config, 'GET', `/api/auth/verify-email?token=${encodeURIComponent(token!)}`)
    expect(expired.status).toBe(410)
    expect(expired.body.status).toBe('expired_token')
  })

  it('resend invalidates previous token and enforces cooldown', async () => {
    const config = createTestConfig()
    const registerRes = await register(config, 'resend@flowlary.com')
    const oldToken = extractTokenFromEmail(String(lastHtml))
    const access = String(registerRes.body.access_token)

    const resend = await request(config, 'POST', '/api/auth/resend-verification', {
      headers: { authorization: `Bearer ${access}` },
      body: {},
    })
    expect(resend.status).toBe(200)
    const newToken = extractTokenFromEmail(String(lastHtml))
    expect(newToken).toBeTruthy()
    expect(newToken).not.toBe(oldToken)

    const stale = await request(config, 'GET', `/api/auth/verify-email?token=${encodeURIComponent(oldToken!)}`)
    expect(stale.status).toBe(400)

    const cooldown = await request(config, 'POST', '/api/auth/resend-verification', {
      headers: { authorization: `Bearer ${access}` },
      body: {},
    })
    expect(cooldown.status).toBe(429)
  })

  it('blocks checkout until email is verified when billing configured', async () => {
    const config = createTestConfig({
      paddleApiKey: 'test-key',
      paddleClientToken: 'test-client',
      paddlePriceIdPro: 'pri_test_monthly',
      paddleWebhookSecret: 'whsec_test',
    })
    const registerRes = await register(config, 'pay@flowlary.com')
    const token = String(registerRes.body.access_token)
    const checkout = await request(config, 'POST', '/api/billing/checkout', {
      headers: { authorization: `Bearer ${token}` },
      body: { interval: 'month' },
    })
    expect(checkout.status).toBe(403)
  })

  it('verification does not consume AI credits', async () => {
    const config = createTestConfig()
    const registerRes = await register(config, 'credits@flowlary.com')
    const before = registerRes.body.account as { creditsRemaining?: number; dailyLimit?: number }
    const token = extractTokenFromEmail(String(lastHtml))
    await request(config, 'GET', `/api/auth/verify-email?token=${encodeURIComponent(token!)}`)
    const accountRes = await request(config, 'GET', '/api/account', {
      headers: { authorization: `Bearer ${registerRes.body.access_token}` },
    })
    const after = accountRes.body.account as { creditsRemaining?: number; dailyLimit?: number }
    expect(after.dailyLimit ?? before.dailyLimit).toBe(PRO_DAILY_CREDITS)
    expect(after.creditsRemaining ?? before.creditsRemaining).toBe(before.creditsRemaining ?? PRO_DAILY_CREDITS)
  })
})
