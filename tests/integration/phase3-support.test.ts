import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../backend/src/routes/http.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import { configureStorePath, resetStoreForTests } from '../../backend/src/db/store.ts'
import { setEmailSenderForTests } from '../../backend/src/services/emailService.ts'
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
    authSecret: 'phase3-support-secret',
    jwtSecret: 'phase3-jwt-secret',
    dataPath: ':memory:',
    groqApiKey: 'test-groq-key-not-real',
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

describe('Phase 3 support system', () => {
  beforeEach(() => {
    resetStoreForTests()
    resetRoutesForTests()
    resetRateLimitsForTests()
    setEmailSenderForTests(async () => ({ ok: true }))
  })

  afterEach(() => {
    setEmailSenderForTests(null)
  })

  it('keeps protected commercial constants', () => {
    expect(FREE_DAILY_CREDITS).toBe(500)
    expect(PRO_DAILY_CREDITS).toBe(1000)
    expect(TRIAL_DAILY_CREDITS).toBe(1000)
    expect(PRO_MONTHLY_SOFT_CAP).toBe(30000)
    expect(PRO_MONTHLY_PRICE_CENTS).toBe(499)
    expect(PRO_YEARLY_PRICE_CENTS).toBe(3900)
  })

  it('creates support ticket for authenticated user', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'user@flowlary.com', password: 'password123', install_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    })
    const token = String(register.body.access_token)
    const created = await request(config, 'POST', '/api/support/ticket', {
      headers: { authorization: `Bearer ${token}` },
      body: { issueType: 'BUG', subject: 'Correction failed', message: 'It stopped working today.' },
    })
    expect(created.status).toBe(200)
    const ticket = created.body.ticket as { id: string; displayNumber: string; status: string }
    expect(ticket.displayNumber).toMatch(/^\d{4}$/)
    expect(ticket.status).toBe('OPEN')
  })

  it('isolates tickets between accounts', async () => {
    const config = createTestConfig()
    const userA = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'a@flowlary.com', password: 'password123', install_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    })
    const userB = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'b@flowlary.com', password: 'password123', install_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
    })
    const tokenA = String(userA.body.access_token)
    const tokenB = String(userB.body.access_token)
    const created = await request(config, 'POST', '/api/support/ticket', {
      headers: { authorization: `Bearer ${tokenA}` },
      body: { subject: 'Private issue', message: 'Only A should see this.' },
    })
    const ticketId = String((created.body.ticket as { id: string }).id)
    const denied = await request(config, 'GET', `/api/support/tickets/${encodeURIComponent(ticketId)}`, {
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(denied.status).toBe(404)
  })

  it('allows user reply and admin reply', async () => {
    const config = createTestConfig()
    const user = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'writer@flowlary.com', password: 'password123', install_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' },
    })
    const admin = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'admin@flowlary.com', password: 'password123', install_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' },
    })
    const userToken = String(user.body.access_token)
    const adminToken = String(admin.body.access_token)
    const created = await request(config, 'POST', '/api/support/ticket', {
      headers: { authorization: `Bearer ${userToken}` },
      body: { subject: 'Need help', message: 'Something broke.' },
    })
    const ticketId = String((created.body.ticket as { id: string }).id)
    const userReply = await request(config, 'POST', `/api/support/tickets/${encodeURIComponent(ticketId)}/message`, {
      headers: { authorization: `Bearer ${userToken}` },
      body: { message: 'Still broken after refresh.' },
    })
    expect(userReply.status).toBe(200)
    const adminReply = await request(config, 'POST', `/api/feedback/admin/tickets/${encodeURIComponent(ticketId)}/reply`, {
      headers: { authorization: `Bearer ${adminToken}` },
      body: { message: 'Thanks — we are investigating.' },
    })
    expect(adminReply.status).toBe(200)
    const detail = await request(config, 'GET', `/api/support/tickets/${encodeURIComponent(ticketId)}`, {
      headers: { authorization: `Bearer ${userToken}` },
    })
    const messages = detail.body.messages as { author: string }[]
    expect(messages.some((m) => m.author === 'support')).toBe(true)
  })

  it('blocks non-admin from admin ticket APIs', async () => {
    const config = createTestConfig()
    const user = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'user2@flowlary.com', password: 'password123', install_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
    })
    const token = String(user.body.access_token)
    const denied = await request(config, 'GET', '/api/feedback/admin/tickets', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(denied.status).toBe(403)
  })
})
