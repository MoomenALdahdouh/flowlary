/**
 * Phase 28 — critical-path E2E-style coverage for monetization coherence.
 * Exercises server entitlement + credit weights + install-auth deny without live UI.
 */
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
} from '../../backend/src/db/store.ts'
import { setAccountPlan } from '../../backend/src/services/accountService.ts'
import { createInstallToken } from '../../backend/src/middleware/auth.ts'
import { AI_MODELS, FREE_DAILY_CREDITS, PRO_DAILY_CREDITS } from '@flowlary/shared'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'phase28-test-secret',
    jwtSecret: 'phase28-jwt-secret',
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

describe('Phase 28 — monetization critical path', () => {
  beforeEach(() => {
    resetRoutesForTests()
    resetRateLimitsForTests()
    resetStoreForTests()
    configureStorePath(':memory:')
  })

  afterEach(() => {
    resetRoutesForTests()
    vi.restoreAllMocks()
  })

  it('install → account → trial → free credits → exhaustion → local tools still exist as capabilities', async () => {
    const config = createTestConfig()
    const installId = '28282828-2828-2828-2828-282828282828'

    const installTok = createInstallToken(installId, config)
    const denied = await request(config, 'POST', '/api/ai/correction', {
      headers: {
        authorization: `Bearer ${installTok}`,
        'x-flowlary-install-id': installId,
        'x-flowlary-entitlement': 'pro',
      },
      body: { text: 'I has a problem', mode: 'direct' },
    })
    expect(denied.status).toBe(403)

    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'phase28@flowlary.com', password: 'password123', install_id: installId },
    })
    expect(register.status).toBe(200)
    const token = String(register.body.access_token)
    const account = register.body.account as { id?: string }
    const trial = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const trialEnt = trial.body.entitlement as {
      plan?: string
      dailyLimit?: number
      capabilities?: string[]
      inTrial?: boolean
    }
    expect(trialEnt.plan).toBe('trial')
    expect(trialEnt.inTrial).toBe(true)
    expect(trialEnt.dailyLimit).toBe(PRO_DAILY_CREDITS)
    expect(trialEnt.capabilities).toContain('learning.export')
    expect(trialEnt.capabilities).toContain('keyboard.unlimited')

    setAccountPlan(String(account.id), 'free')
    const free = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const freeEnt = free.body.entitlement as {
      plan?: string
      creditsRemaining?: number
      dailyLimit?: number
      capabilities?: string[]
    }
    expect(freeEnt.plan).toBe('free')
    expect(freeEnt.dailyLimit).toBe(FREE_DAILY_CREDITS)
    expect(freeEnt.creditsRemaining).toBe(FREE_DAILY_CREDITS)
    expect(freeEnt.capabilities).toContain('ai.correction')
    expect(freeEnt.capabilities).not.toContain('learning.export')

    const row = findAccountById(String(account.id))!
    row.dailyCreditsUsed = FREE_DAILY_CREDITS
    row.dailyCreditsDayKey = new Date().toISOString().slice(0, 10)
    updateAccount(row)

    const exhausted = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const exhaustedEnt = exhausted.body.entitlement as {
      allowed?: boolean
      reason?: string
      capabilities?: string[]
    }
    expect(exhaustedEnt.allowed).toBe(false)
    expect(exhaustedEnt.reason).toBe('usage_exhausted')
    expect(exhaustedEnt.capabilities).toContain('keyboard.unlimited')
    expect(exhaustedEnt.capabilities).toContain('speedbox.unlimited')
    expect(exhaustedEnt.capabilities).not.toContain('ai.correction')
  })

  it('failed AI requests do not consume credits; success debits translation weight 2', async () => {
    const config = createTestConfig()
    const installId = '29292929-2929-2929-2929-292929292929'
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'phase28b@flowlary.com', password: 'password123', install_id: installId },
    })
    const token = String(register.body.access_token)
    setAccountPlan(String((register.body.account as { id: string }).id), 'free')

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await request(config, 'POST', '/api/ai/translation', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-flowlary-install-id': installId,
      },
      body: { text: 'hello', source_language: 'en', target_language: 'ar' },
    })
    const afterFail = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((afterFail.body.entitlement as { creditsUsed?: number }).creditsUsed).toBe(0)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          model: AI_MODELS.TRANSLATION,
          choices: [{ message: { content: 'مرحبا' } }],
        }),
      })),
    )
    await request(config, 'POST', '/api/ai/translation', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-flowlary-install-id': installId,
      },
      body: { text: 'hello', source_language: 'en', target_language: 'ar' },
    })
    const afterOk = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((afterOk.body.entitlement as { creditsUsed?: number }).creditsUsed).toBe(2)
    expect((afterOk.body.entitlement as { creditsRemaining?: number }).creditsRemaining).toBe(
      FREE_DAILY_CREDITS - 2,
    )
  })

  it('client cannot forge trial extension via local plan claim after expiry', async () => {
    const config = createTestConfig()
    const register = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'phase28c@flowlary.com', password: 'password123' },
    })
    const token = String(register.body.access_token)
    const account = register.body.account as { id: string }
    const row = findAccountById(account.id)!
    row.plan = 'trial'
    row.trialEndsAt = Date.now() - 1000
    updateAccount(row)

    const res = await request(config, 'GET', '/api/account/entitlement', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-flowlary-entitlement': 'trial',
      },
    })
    const ent = res.body.entitlement as { plan?: string; inTrial?: boolean; dailyLimit?: number }
    expect(ent.plan).toBe('free')
    expect(ent.inTrial).toBe(false)
    expect(ent.dailyLimit).toBe(FREE_DAILY_CREDITS)
  })
})
