import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../../backend/src/config/env.ts'
import { loadConfig } from '../../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../../backend/src/routes/http.ts'
import { configureStorePath, resetStoreForTests } from '../../../backend/src/db/store.ts'
import { setEmailSenderForTests } from '../../../backend/src/services/emailService.ts'
import { resetRateLimitsForTests, checkStudentOperationRateLimit } from '../../../backend/src/middleware/rateLimit.ts'
import { PRO_DAILY_CREDITS, STUDENT_PROGRAM_DURATION_MONTHS } from '@flowlary/shared'

import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'student-test-secret',
    jwtSecret: 'student-test-jwt',
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

function extractStudentToken(html: string): string | null {
  const match = html.match(/student=1&amp;token=([^"&]+)/) ?? html.match(/student=1&token=([^"&]+)/)
  if (!match?.[1]) return null
  return decodeURIComponent(match[1])
}

describe('student verification', () => {
  let config: AppConfig
  let sentHtml = ''

  beforeEach(() => {
    resetStoreForTests()
    resetRoutesForTests()
    resetRateLimitsForTests()
    config = createTestConfig()
    sentHtml = ''
    setEmailSenderForTests(async (payload) => {
      sentHtml = payload.html ?? payload.text ?? ''
      return { ok: true }
    })
  })

  afterEach(() => {
    setEmailSenderForTests(null)
    resetRateLimitsForTests()
  })

  async function registerAndVerifyAccount(email: string) {
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email, password: 'password1234' },
    })
    expect(register.status).toBe(200)
    const accessToken = String(register.body.access_token)
    const verifyMatch = sentHtml.match(/verify-email\?token=([^"&]+)/)
    expect(verifyMatch?.[1]).toBeTruthy()
    await request(config, 'POST', '/api/auth/verify-email', { body: { token: verifyMatch![1] } })
    return accessToken
  }

  it('grants Pro capabilities after academic email confirmation', async () => {
    const token = await registerAndVerifyAccount('owner@example.com')
    const auth = { Authorization: `Bearer ${token}` }

    const requestRes = await request(config, 'POST', '/api/student/verify/request', {
      headers: auth,
      body: { academicEmail: 'student@school.edu' },
    })
    expect(requestRes.status).toBe(200)
    const studentToken = extractStudentToken(sentHtml)
    expect(studentToken).toBeTruthy()

    const confirm = await request(config, 'POST', '/api/student/verify/confirm', {
      headers: auth,
      body: { token: studentToken },
    })
    expect(confirm.status).toBe(200)
    expect(confirm.body.status).toBe('verified')

    const entitlement = await request(config, 'GET', '/api/account/entitlement', { headers: auth })
    const view = entitlement.body.entitlement as Record<string, unknown>
    expect(view.studentProActive).toBe(true)
    expect(view.isPro).toBe(false)
    expect(view.dailyLimit).toBe(PRO_DAILY_CREDITS)
    expect(view.studentProExpiresAt).toBeTypeOf('number')
    expect(STUDENT_PROGRAM_DURATION_MONTHS).toBe(12)
  })

  it('blocks duplicate academic email on another account', async () => {
    const tokenA = await registerAndVerifyAccount('a@example.com')
    const tokenB = await registerAndVerifyAccount('b@example.com')

    await request(config, 'POST', '/api/student/verify/request', {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { academicEmail: 'student@school.edu' },
    })
    const studentToken = extractStudentToken(sentHtml)
    await request(config, 'POST', '/api/student/verify/confirm', {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { token: studentToken },
    })

    const duplicate = await request(config, 'POST', '/api/student/verify/request', {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { academicEmail: 'student@school.edu' },
    })
    expect(duplicate.status).toBe(409)
  })

  it('rejects non-academic email domains', async () => {
    const token = await registerAndVerifyAccount('owner@gmail.com')
    const auth = { Authorization: `Bearer ${token}` }

    const gmail = await request(config, 'POST', '/api/student/verify/request', {
      headers: auth,
      body: { academicEmail: 'student@gmail.com' },
    })
    expect(gmail.status).toBe(400)

    const spoof = await request(config, 'POST', '/api/student/verify/request', {
      headers: auth,
      body: { academicEmail: 'student@not-real-edu.com' },
    })
    expect(spoof.status).toBe(400)
  })

  it('accepts uppercase academic domains after normalization', async () => {
    const token = await registerAndVerifyAccount('owner@example.com')
    const auth = { Authorization: `Bearer ${token}` }

    const requestRes = await request(config, 'POST', '/api/student/verify/request', {
      headers: auth,
      body: { academicEmail: 'Student@School.EDU' },
    })
    expect(requestRes.status).toBe(200)
  })

  it('rejects token reuse and cross-account confirmation', async () => {
    const tokenA = await registerAndVerifyAccount('a@example.com')
    const tokenB = await registerAndVerifyAccount('b@example.com')

    await request(config, 'POST', '/api/student/verify/request', {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { academicEmail: 'student@school.edu' },
    })
    const studentToken = extractStudentToken(sentHtml)
    expect(studentToken).toBeTruthy()

    const confirmA = await request(config, 'POST', '/api/student/verify/confirm', {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { token: studentToken },
    })
    expect(confirmA.status).toBe(200)

    const reuse = await request(config, 'POST', '/api/student/verify/confirm', {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { token: studentToken },
    })
    expect(reuse.status).toBe(200)
    expect(reuse.body.status).toBe('invalid_token')

    await request(config, 'POST', '/api/student/verify/request', {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { academicEmail: 'other@school.edu' },
    })
    const tokenBFlow = extractStudentToken(sentHtml)
    const crossAccount = await request(config, 'POST', '/api/student/verify/confirm', {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { token: studentToken },
    })
    expect(crossAccount.status).toBe(200)
    expect(crossAccount.body.status).toBe('invalid_token')
    expect(tokenBFlow).toBeTruthy()
  })

  it('rate limits excessive verification requests per day', () => {
    for (let i = 0; i < 5; i += 1) {
      checkStudentOperationRateLimit('student-rate-account', 'student-verify-request')
    }
    expect(() =>
      checkStudentOperationRateLimit('student-rate-account', 'student-verify-request'),
    ).toThrow('rate_limited')
  })
})
