import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import { handleHttpRequest, resetRoutesForTests } from '../../backend/src/routes/http.ts'
import { resetRateLimitsForTests } from '../../backend/src/middleware/rateLimit.ts'
import { configureStorePath, findAccountById, resetStoreForTests } from '../../backend/src/db/store.ts'
import { markAccountEmailVerifiedForTests } from '../../backend/src/services/accountService.ts'
import { setEmailSenderForTests } from '../../backend/src/services/emailService.ts'
import { signPaddlePayload } from '../../backend/src/billing/paddleSignature.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'production',
    authDisabled: false,
    authSecret: 'phase20-test-secret',
    jwtSecret: 'phase20-jwt-secret',
    dataPath: ':memory:',
    groqApiKey: 'test-groq-key-not-real',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    paddleEnvironment: 'sandbox',
    paddleApiKey: '',
    paddleWebhookSecret: '',
    paddleClientToken: '',
    paddlePriceIdPro: '',
    paddlePriceIdProYearly: '',
    ...overrides,
  }
}

async function request(
  config: AppConfig,
  method: string,
  path: string,
  options?: { body?: unknown; rawBody?: string; headers?: Record<string, string> },
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
      if (options?.rawBody !== undefined) {
        yield Buffer.from(options.rawBody)
        return
      }
      if (options?.body !== undefined) {
        yield Buffer.from(JSON.stringify(options.body))
      }
    },
  } as unknown as IncomingMessage

  await handleHttpRequest(config, req, res)
  return { status: res.statusCode, body: JSON.parse(payload || '{}') as Record<string, unknown> }
}

function signedWebhook(secret: string, payload: Record<string, unknown>) {
  const rawBody = JSON.stringify(payload)
  const ts = String(Math.floor(Date.now() / 1000))
  const h1 = signPaddlePayload(rawBody, secret, ts)
  return { rawBody, header: `ts=${ts};h1=${h1}` }
}

async function registerVerified(
  config: AppConfig,
  email: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await request(config, 'POST', '/api/auth/register', {
    body: { email, password: 'password123', install_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
  })
  const account = res.body.account as { id?: string } | undefined
  if (account?.id) markAccountEmailVerifiedForTests(account.id)
  return res
}

function mockPaddleCheckoutFetch(options: {
  expectedPriceId: string
  transactionId: string
  priceAmount?: string
  priceInterval?: 'month' | 'year'
  onTransaction?: (parsed: {
    items?: Array<{ price_id?: string }>
    custom_data?: { flowlary_account_id?: string }
  }) => void
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const urlStr = String(url)
      if (urlStr.includes('/prices/')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: options.expectedPriceId,
              unit_price: { amount: options.priceAmount ?? '499', currency_code: 'USD' },
              billing_cycle: { interval: options.priceInterval ?? 'month', frequency: 1 },
            },
          }),
        }
      }
      if (urlStr.includes('/transactions')) {
        const parsed = JSON.parse(init?.body ?? '{}') as {
          items?: Array<{ price_id?: string }>
          custom_data?: { flowlary_account_id?: string }
        }
        options.onTransaction?.(parsed)
        return {
          ok: true,
          json: async () => ({ data: { id: options.transactionId } }),
        }
      }
      return { ok: false, json: async () => ({}) }
    }),
  )
}

describe('Phase 20 — Paddle billing', () => {
  beforeEach(() => {
    resetRoutesForTests()
    resetRateLimitsForTests()
    resetStoreForTests()
    configureStorePath(':memory:')
    setEmailSenderForTests(async () => ({ ok: true }))
  })

  afterEach(() => {
    resetRoutesForTests()
    setEmailSenderForTests(null)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reports billing unconfigured without secrets', async () => {
    const config = createTestConfig()
    const health = await request(config, 'GET', '/health')
    expect(health.body.billingConfigured).toBe(false)
    const billing = await request(config, 'GET', '/api/billing/config')
    expect(billing.body.checkoutAvailable).toBe(false)
    expect(billing.body.clientToken).toBeNull()
    expect(billing.body.trial).toBeNull()
  })

  it('rejects unverified webhooks', async () => {
    const config = createTestConfig({ paddleWebhookSecret: 'whsec_test' })
    const rawBody = JSON.stringify({ event_id: 'evt_bad', event_type: 'subscription.created', data: {} })
    const res = await request(config, 'POST', '/api/billing/webhook', {
      rawBody,
      headers: { 'paddle-signature': 'ts=1;h1=deadbeef' },
    })
    expect(res.status).toBe(400)
  })

  it('rejects a valid signature on a modified body', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const { header } = signedWebhook(secret, {
      event_id: 'evt_tamper',
      event_type: 'subscription.created',
      data: { id: 'sub_01aaaaaaaaaaaaaaaaaaaaaaaa' },
    })
    const res = await request(config, 'POST', '/api/billing/webhook', {
      rawBody: JSON.stringify({ event_id: 'evt_tamper', event_type: 'subscription.updated', data: {} }),
      headers: { 'paddle-signature': header },
    })
    expect(res.status).toBe(400)
  })

  it('does not grant Pro for an unknown account', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const { rawBody, header } = signedWebhook(secret, {
      event_id: 'evt_unknown',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'sub_01aaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'active',
        customer_id: 'ctm_01aaaaaaaaaaaaaaaaaaaaaaaa',
        custom_data: { flowlary_account_id: '00000000-0000-0000-0000-000000000000' },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    })
    const res = await request(config, 'POST', '/api/billing/webhook', {
      rawBody,
      headers: { 'paddle-signature': header },
    })
    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe(true)
  })

  it('is idempotent for duplicate event_id', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const registered = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'dup-evt@flowlary.com', password: 'password123' },
    })
    const account = registered.body.account as { id: string }
    const payload = {
      event_id: 'evt_duplicate',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'sub_01bbbbbbbbbbbbbbbbbbbbbbbb',
        status: 'active',
        customer_id: 'ctm_01bbbbbbbbbbbbbbbbbbbbbbbb',
        custom_data: { flowlary_account_id: account.id },
        items: [{ price_id: 'pri_01m0vzs74d5d2gk5czmk2jh0bq' }],
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    }
    const first = signedWebhook(secret, payload)
    const second = signedWebhook(secret, payload)
    const a = await request(config, 'POST', '/api/billing/webhook', {
      rawBody: first.rawBody,
      headers: { 'paddle-signature': first.header },
    })
    const b = await request(config, 'POST', '/api/billing/webhook', {
      rawBody: second.rawBody,
      headers: { 'paddle-signature': second.header },
    })
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(b.body.duplicate).toBe(true)
    expect(findAccountById(account.id)?.plan).toBe('pro')
  })

  it('promotes Free/trial to Pro from a verified subscription.created webhook', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const registered = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'pro@flowlary.com', password: 'password123' },
    })
    const token = String(registered.body.access_token)
    const account = registered.body.account as { id: string }
    const before = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((before.body.entitlement as { isPro?: boolean }).isPro).toBe(false)

    const { rawBody, header } = signedWebhook(secret, {
      event_id: 'evt_created',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'sub_01cccccccccccccccccccccccc',
        status: 'active',
        customer_id: 'ctm_01cccccccccccccccccccccccc',
        custom_data: { flowlary_account_id: account.id },
        items: [{ price_id: 'pri_flowlary_pro' }],
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    })
    const hook = await request(config, 'POST', '/api/billing/webhook', {
      rawBody,
      headers: { 'paddle-signature': header },
    })
    expect(hook.status).toBe(200)
    const after = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const entitlement = after.body.entitlement as { isPro?: boolean; plan?: string }
    expect(entitlement.isPro).toBe(true)
    expect(entitlement.plan).toBe('pro')
    expect(findAccountById(account.id)?.plan).toBe('pro')
  })

  it('keeps Pro after cancel until period end, then Free', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const registered = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'cancel@flowlary.com', password: 'password123' },
    })
    const token = String(registered.body.access_token)
    const account = registered.body.account as { id: string }
    const periodEnd = Date.now() + 86_400_000
    const created = signedWebhook(secret, {
      event_id: 'evt_c1',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'sub_01dddddddddddddddddddddddd',
        status: 'active',
        customer_id: 'ctm_01dddddddddddddddddddddddd',
        custom_data: { flowlary_account_id: account.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(periodEnd).toISOString(),
        },
      },
    })
    await request(config, 'POST', '/api/billing/webhook', {
      rawBody: created.rawBody,
      headers: { 'paddle-signature': created.header },
    })
    const canceled = signedWebhook(secret, {
      event_id: 'evt_c2',
      event_type: 'subscription.canceled',
      occurred_at: new Date(Date.now() + 1000).toISOString(),
      data: {
        id: 'sub_01dddddddddddddddddddddddd',
        status: 'canceled',
        customer_id: 'ctm_01dddddddddddddddddddddddd',
        custom_data: { flowlary_account_id: account.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(periodEnd).toISOString(),
        },
      },
    })
    await request(config, 'POST', '/api/billing/webhook', {
      rawBody: canceled.rawBody,
      headers: { 'paddle-signature': canceled.header },
    })
    const stillPro = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((stillPro.body.entitlement as { isPro?: boolean }).isPro).toBe(true)

    const expired = signedWebhook(secret, {
      event_id: 'evt_c3',
      event_type: 'subscription.updated',
      occurred_at: new Date(Date.now() + 2000).toISOString(),
      data: {
        id: 'sub_01dddddddddddddddddddddddd',
        status: 'canceled',
        customer_id: 'ctm_01dddddddddddddddddddddddd',
        custom_data: { flowlary_account_id: account.id },
        current_billing_period: {
          starts_at: new Date(Date.now() - 2_000_000).toISOString(),
          ends_at: new Date(Date.now() - 1_000).toISOString(),
        },
      },
    })
    await request(config, 'POST', '/api/billing/webhook', {
      rawBody: expired.rawBody,
      headers: { 'paddle-signature': expired.header },
    })
    const free = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((free.body.entitlement as { isPro?: boolean; plan?: string }).isPro).toBe(false)
    expect((free.body.entitlement as { plan?: string }).plan).not.toBe('pro')
  })

  it('keeps Pro on payment failure / past_due', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const registered = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'due@flowlary.com', password: 'password123' },
    })
    const token = String(registered.body.access_token)
    const account = registered.body.account as { id: string }
    const created = signedWebhook(secret, {
      event_id: 'evt_d1',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'sub_01eeeeeeeeeeeeeeeeeeeeeeee',
        status: 'active',
        customer_id: 'ctm_01eeeeeeeeeeeeeeeeeeeeeeee',
        custom_data: { flowlary_account_id: account.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    })
    await request(config, 'POST', '/api/billing/webhook', {
      rawBody: created.rawBody,
      headers: { 'paddle-signature': created.header },
    })
    const due = signedWebhook(secret, {
      event_id: 'evt_d2',
      event_type: 'subscription.past_due',
      occurred_at: new Date(Date.now() + 1000).toISOString(),
      data: {
        id: 'sub_01eeeeeeeeeeeeeeeeeeeeeeee',
        status: 'past_due',
        customer_id: 'ctm_01eeeeeeeeeeeeeeeeeeeeeeee',
        custom_data: { flowlary_account_id: account.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    })
    await request(config, 'POST', '/api/billing/webhook', {
      rawBody: due.rawBody,
      headers: { 'paddle-signature': due.header },
    })
    const entitlement = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    const view = entitlement.body.entitlement as {
      isPro?: boolean
      subscription?: { paymentFailed?: boolean; status?: string }
    }
    expect(view.isPro).toBe(true)
    expect(view.subscription?.paymentFailed).toBe(true)
    expect(view.subscription?.status).toBe('past_due')
  })

  it('checkout ignores client price ids and requires Paddle config', async () => {
    const config = createTestConfig()
    const registered = await registerVerified(config, 'chk@flowlary.com')
    const token = String(registered.body.access_token)
    const res = await request(config, 'POST', '/api/billing/checkout', {
      headers: { authorization: `Bearer ${token}` },
      body: { priceId: 'pri_attacker', plan: 'pro', amount: '1' },
    })
    expect(res.status).toBe(503)
  })

  it('creates a server-side Paddle transaction and does not trust client price ids', async () => {
    const config = createTestConfig({
      paddleApiKey: 'pdl_sdbx_test',
      paddleClientToken: 'test_token',
      paddlePriceIdPro: 'pri_01m0vzs74d5d2gk5czmk2jh0bq',
    })
    const registered = await registerVerified(config, 'txn@flowlary.com')
    const token = String(registered.body.access_token)
    mockPaddleCheckoutFetch({
      expectedPriceId: 'pri_01m0vzs74d5d2gk5czmk2jh0bq',
      transactionId: 'txn_01ffffffffffffffffffffffff',
      onTransaction: (parsed) => {
        expect(parsed.items?.[0]?.price_id).toBe('pri_01m0vzs74d5d2gk5czmk2jh0bq')
        expect(parsed.custom_data?.flowlary_account_id).toBeTruthy()
      },
    })
    const res = await request(config, 'POST', '/api/billing/checkout', {
      headers: { authorization: `Bearer ${token}` },
      body: { priceId: 'pri_attacker', plan: 'enterprise' },
    })
    expect(res.status).toBe(200)
    expect(res.body.transactionId).toBe('txn_01ffffffffffffffffffffffff')
    expect(res.body.clientToken).toBe('test_token')
  })

  it('selects yearly price id when interval=year and yearly price is configured', async () => {
    const config = createTestConfig({
      paddleApiKey: 'pdl_sdbx_test',
      paddleClientToken: 'test_token',
      paddlePriceIdPro: 'pri_01m0vzs74d5d2gk5czmk2jh0bq',
      paddlePriceIdProYearly: 'pri_01m0yswaktpqwzs5hxcp6x8ehf',
    })
    const registered = await registerVerified(config, 'yearly@flowlary.com')
    const token = String(registered.body.access_token)
    mockPaddleCheckoutFetch({
      expectedPriceId: 'pri_01m0yswaktpqwzs5hxcp6x8ehf',
      transactionId: 'txn_01yyyyyyyyyyyyyyyyyyyyyyyy',
      priceAmount: '3900',
      priceInterval: 'year',
      onTransaction: (parsed) => {
        expect(parsed.items?.[0]?.price_id).toBe('pri_01m0yswaktpqwzs5hxcp6x8ehf')
      },
    })
    const res = await request(config, 'POST', '/api/billing/checkout', {
      headers: { authorization: `Bearer ${token}` },
      body: { interval: 'year', priceId: 'pri_attacker' },
    })
    expect(res.status).toBe(200)
    expect(res.body.interval).toBe('year')
    expect(res.body.transactionId).toBe('txn_01yyyyyyyyyyyyyyyyyyyyyyyy')
  })

  it('acks unsupported events without changing plan', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const registered = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'noop@flowlary.com', password: 'password123' },
    })
    const account = registered.body.account as { id: string }
    const { rawBody, header } = signedWebhook(secret, {
      event_id: 'evt_price',
      event_type: 'price.updated',
      data: { id: 'pri_x' },
    })
    const res = await request(config, 'POST', '/api/billing/webhook', {
      rawBody,
      headers: { 'paddle-signature': header },
    })
    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe(true)
    expect(findAccountById(account.id)?.plan).toBe('trial')
  })

  it('rejects malformed JSON after a valid signature attempt without granting Pro', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const rawBody = '{not-json'
    const ts = String(Math.floor(Date.now() / 1000))
    const header = `ts=${ts};h1=${signPaddlePayload(rawBody, secret, ts)}`
    const res = await request(config, 'POST', '/api/billing/webhook', {
      rawBody,
      headers: { 'paddle-signature': header },
    })
    expect(res.status).toBe(400)
  })

  it('blocks checkout for unverified email', async () => {
    const config = createTestConfig({
      paddleApiKey: 'pdl_sdbx_test',
      paddleClientToken: 'test_token',
      paddlePriceIdPro: 'pri_01m0vzs74d5d2gk5czmk2jh0bq',
    })
    const registered = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'unverified@flowlary.com', password: 'password123' },
    })
    const token = String(registered.body.access_token)
    const res = await request(config, 'POST', '/api/billing/checkout', {
      headers: { authorization: `Bearer ${token}` },
      body: { interval: 'month' },
    })
    expect(res.status).toBe(403)
  })

  it('isolates Pro entitlement between accounts', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const a = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'a-pro@flowlary.com', password: 'password123' },
    })
    const b = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'b-free@flowlary.com', password: 'password123' },
    })
    const accountA = a.body.account as { id: string }
    const tokenB = String(b.body.access_token)
    const { rawBody, header } = signedWebhook(secret, {
      event_id: 'evt_iso',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'sub_01isoooooooooooooooooooooo',
        status: 'active',
        customer_id: 'ctm_01isoooooooooooooooooooooo',
        custom_data: { flowlary_account_id: accountA.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    })
    await request(config, 'POST', '/api/billing/webhook', { rawBody, headers: { 'paddle-signature': header } })
    const entB = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect((entB.body.entitlement as { isPro?: boolean }).isPro).toBe(false)
  })

  it('ignores cross-environment subscription updates', async () => {
    const secret = 'whsec_test'
    const sandboxConfig = createTestConfig({ paddleWebhookSecret: secret, paddleEnvironment: 'sandbox' })
    const prodConfig = createTestConfig({ paddleWebhookSecret: secret, paddleEnvironment: 'production' })
    const registered = await request(sandboxConfig, 'POST', '/api/auth/register', {
      body: { email: 'cross@flowlary.com', password: 'password123' },
    })
    const account = registered.body.account as { id: string }
    const subId = 'sub_01crosscrosscrosscrosscross'
    const created = signedWebhook(secret, {
      event_id: 'evt_sandbox',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: {
        id: subId,
        status: 'active',
        customer_id: 'ctm_01crosscrosscrosscrosscross',
        custom_data: { flowlary_account_id: account.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    })
    await request(sandboxConfig, 'POST', '/api/billing/webhook', {
      rawBody: created.rawBody,
      headers: { 'paddle-signature': created.header },
    })
    expect(findAccountById(account.id)?.plan).toBe('pro')
    const prodAttempt = signedWebhook(secret, {
      event_id: 'evt_prod',
      event_type: 'subscription.updated',
      occurred_at: new Date(Date.now() + 1000).toISOString(),
      data: {
        id: subId,
        status: 'canceled',
        customer_id: 'ctm_01crosscrosscrosscrosscross',
        custom_data: { flowlary_account_id: account.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() - 1000).toISOString(),
        },
      },
    })
    const res = await request(prodConfig, 'POST', '/api/billing/webhook', {
      rawBody: prodAttempt.rawBody,
      headers: { 'paddle-signature': prodAttempt.header },
    })
    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe(true)
    expect(findAccountById(account.id)?.plan).toBe('pro')
  })

  it('revokes Pro when subscription is paused', async () => {
    const secret = 'whsec_test'
    const config = createTestConfig({ paddleWebhookSecret: secret })
    const registered = await request(config, 'POST', '/api/auth/register', {
      body: { email: 'pause@flowlary.com', password: 'password123' },
    })
    const token = String(registered.body.access_token)
    const account = registered.body.account as { id: string }
    const subId = 'sub_01pausepausepausepausepause'
    const created = signedWebhook(secret, {
      event_id: 'evt_pause1',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: {
        id: subId,
        status: 'active',
        customer_id: 'ctm_01pausepausepausepausepause',
        custom_data: { flowlary_account_id: account.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    })
    await request(config, 'POST', '/api/billing/webhook', {
      rawBody: created.rawBody,
      headers: { 'paddle-signature': created.header },
    })
    const paused = signedWebhook(secret, {
      event_id: 'evt_pause2',
      event_type: 'subscription.paused',
      occurred_at: new Date(Date.now() + 1000).toISOString(),
      data: {
        id: subId,
        status: 'paused',
        customer_id: 'ctm_01pausepausepausepausepause',
        custom_data: { flowlary_account_id: account.id },
      },
    })
    await request(config, 'POST', '/api/billing/webhook', {
      rawBody: paused.rawBody,
      headers: { 'paddle-signature': paused.header },
    })
    const entitlement = await request(config, 'GET', '/api/account/entitlement', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((entitlement.body.entitlement as { isPro?: boolean }).isPro).toBe(false)
  })

  it('opens customer portal for Pro accounts', async () => {
    const config = createTestConfig({
      paddleApiKey: 'pdl_sdbx_test',
      paddleClientToken: 'test_token',
      paddlePriceIdPro: 'pri_01m0vzs74d5d2gk5czmk2jh0bq',
    })
    const registered = await registerVerified(config, 'portal@flowlary.com')
    const token = String(registered.body.access_token)
    const account = registered.body.account as { id: string }
    const { updateAccount } = await import('../../backend/src/db/store.ts')
    const row = findAccountById(account.id)!
    row.paddleCustomerId = 'ctm_01portalportalportalportal'
    row.paddleSubscriptionId = 'sub_01portalportalportalportal'
    updateAccount(row)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toContain('/portal-sessions')
        return {
          ok: true,
          json: async () => ({
            data: { urls: { general: { overview: 'https://sandbox-vendors.paddle.com/portal/overview' } } },
          }),
        }
      }),
    )
    const res = await request(config, 'POST', '/api/billing/portal', {
      headers: { authorization: `Bearer ${token}` },
      body: {},
    })
    expect(res.status).toBe(200)
    expect(res.body.url).toContain('portal')
  })

  it('returns authenticated billing status', async () => {
    const config = createTestConfig({
      paddleApiKey: 'pdl_sdbx_test',
      paddleClientToken: 'test_token',
      paddlePriceIdPro: 'pri_test',
      paddleWebhookSecret: 'whsec_test',
    })
    const registered = await registerVerified(config, 'status@flowlary.com')
    const token = String(registered.body.access_token)
    const res = await request(config, 'GET', '/api/billing/status', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    expect((res.body.billing as { checkoutAvailable?: boolean }).checkoutAvailable).toBe(true)
    expect((res.body.entitlement as { inTrial?: boolean }).inTrial).toBe(true)
  })
})
