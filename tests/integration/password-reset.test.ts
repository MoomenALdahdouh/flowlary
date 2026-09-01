import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../backend/src/routes/http.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import {
  configureStorePath,
  createSession,
  findAccountByEmail,
  getPasswordReset,
  resetStoreForTests,
  setPasswordReset,
} from '../../backend/src/db/store.ts'
import { registerAccount } from '../../backend/src/services/accountService.ts'
import { hashVerificationToken } from '../../backend/src/services/crypto.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'test',
    authDisabled: false,
    authSecret: 'password-reset-test-secret',
    jwtSecret: 'password-reset-jwt-secret',
    webOrigin: 'https://flowlary.com',
    dataPath: ':memory:',
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

  const req = {
    method,
    url: path,
    headers: {
      host: '127.0.0.1:8787',
      ...options?.headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      if (options?.body !== undefined) {
        yield Buffer.from(JSON.stringify(options.body))
      }
    },
  } as unknown as IncomingMessage

  await handleHttpRequest(config, req, res)
  return { status: res.statusCode, body: JSON.parse(payload || '{}') as Record<string, unknown> }
}

describe('password reset', () => {
  let config: AppConfig

  beforeEach(() => {
    resetRoutesForTests()
    resetRateLimitsForTests()
    resetStoreForTests()
    config = createTestConfig()
  })

  afterEach(() => {
    resetRoutesForTests()
    resetRateLimitsForTests()
    resetStoreForTests()
  })

  it('accepts forgot-password without revealing account existence', async () => {
    const missing = await request(config, 'POST', '/api/auth/forgot-password', {
      body: { email: 'missing@example.com' },
    })
    expect(missing.status).toBe(200)
    expect(missing.body.ok).toBe(true)
  })

  it('rate limits forgot-password requests', async () => {
    const email = 'reset-user@example.com'
    registerAccount(config, email, 'password123', 'install-1')
    for (let i = 0; i < 10; i += 1) {
      await request(config, 'POST', '/api/auth/forgot-password', { body: { email } })
    }
    const limited = await request(config, 'POST', '/api/auth/forgot-password', { body: { email } })
    expect(limited.status).toBe(429)
    expect(limited.body.error).toBe('rate_limited')
  })

  it('rejects invalid and expired reset tokens', async () => {
    const invalid = await request(config, 'POST', '/api/auth/reset-password', {
      body: { token: 'bad-token', password: 'newpassword1' },
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error).toBe('invalid_token')

    const account = registerAccount(config, 'expired@example.com', 'password123', 'install-2').account
    setPasswordReset({
      accountId: account.id,
      tokenHash: hashVerificationToken('expired-token', config.jwtSecret),
      expiresAt: Date.now() - 1_000,
      lastSentAt: Date.now() - 1_000,
    })
    const expired = await request(config, 'POST', '/api/auth/reset-password', {
      body: { token: 'expired-token', password: 'newpassword1' },
    })
    expect(expired.status).toBe(410)
    expect(expired.body.error).toBe('expired_token')
  })

  it('resets password and revokes existing sessions', async () => {
    const email = 'revoke@example.com'
    const password = 'password123'
    const { account } = registerAccount(config, email, password, 'install-3')
    const session = createSession({ accountId: account.id, installId: 'install-3' })
    setPasswordReset({
      accountId: account.id,
      tokenHash: hashVerificationToken('good-token', config.jwtSecret),
      expiresAt: Date.now() + 60_000,
      lastSentAt: Date.now(),
    })

    const reset = await request(config, 'POST', '/api/auth/reset-password', {
      body: { token: 'good-token', password: 'newpassword456' },
    })
    expect(reset.status).toBe(200)
    expect(reset.body.ok).toBe(true)

    const loginOld = await request(config, 'POST', '/api/auth/login', {
      body: { email, password },
    })
    expect(loginOld.status).toBe(401)

    const loginNew = await request(config, 'POST', '/api/auth/login', {
      body: { email, password: 'newpassword456' },
    })
    expect(loginNew.status).toBe(200)

    expect(getPasswordReset(account.id)).toBeNull()
    expect(findAccountByEmail(email)?.id).toBe(account.id)
    expect(session.id).toBeTruthy()

    const reuse = await request(config, 'POST', '/api/auth/reset-password', {
      body: { token: 'good-token', password: 'anotherpassword1' },
    })
    expect(reuse.status).toBe(400)
    expect(reuse.body.error).toBe('invalid_token')
  })
})
