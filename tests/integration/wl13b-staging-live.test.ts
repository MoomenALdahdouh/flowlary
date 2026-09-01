/**
 * WL-13B live staging checks (requires running API + Mailpit).
 * Run: WL13B_LIVE_API=1 npm run test -w @flowlary/extension -- ../tests/integration/wl13b-staging-live.test.ts
 */
import { describe, expect, it } from 'vitest'
import { PRO_DAILY_CREDITS } from '@flowlary/shared'

const API = process.env.WL13B_API ?? 'http://127.0.0.1:8787'
const MAILPIT = process.env.WL13B_MAILPIT ?? 'http://127.0.0.1:8025'
const LIVE = process.env.WL13B_LIVE_API === '1'

async function json(
  method: string,
  path: string,
  init: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  return { status: res.status, data: await res.json() }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForMail(toEmail: string) {
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch(`${MAILPIT}/api/v1/messages`)
    const data = (await res.json()) as { messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }> }
    const hit = (data.messages ?? []).find((m) =>
      (m.To ?? []).some((t) => String(t.Address ?? t).toLowerCase().includes(toEmail.toLowerCase())),
    )
    if (hit) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)
      return detail.json()
    }
    await sleep(300)
  }
  return null
}

describe.skipIf(!LIVE)('WL-13B staging live (API + Mailpit)', () => {
  it('registers, delivers verification email, and verifies account', async () => {
    const email = `wl13b-vitest-${Date.now()}@flowlary.test`
    const password = 'StagingPass123!'
    const reg = await json('POST', '/api/auth/register', {
      body: { email, password, confirmPassword: password },
    })
    expect(reg.status).toBe(200)
    expect(reg.data.account?.inTrial).toBe(true)
    expect(reg.data.account?.creditsRemaining).toBe(PRO_DAILY_CREDITS)

    const mail = await waitForMail(email)
    expect(mail).toBeTruthy()
    const html = String((mail as { HTML?: string }).HTML ?? '')
    expect(html).toContain('flowlary.test')
    expect(html).not.toContain('127.0.0.1')

    const tokenMatch = html.match(/verify-email\?token=([^"&]+)/)
    expect(tokenMatch?.[1]).toBeTruthy()
    const verify = await json('GET', `/api/auth/verify-email?token=${encodeURIComponent(decodeURIComponent(tokenMatch![1]))}`)
    expect(verify.data.status).toBe('verified')
  })

  it('isolates learning events between accounts', async () => {
    const stamp = Date.now()
    const password = 'StagingPass123!'
    const regA = await json('POST', '/api/auth/register', {
      body: { email: `wl13b-iso-a-${stamp}@flowlary.test`, password },
    })
    const tokenA = regA.data.access_token as string
    const ingest = await json('POST', '/api/learning/events', {
      token: tokenA,
      headers: { 'X-Flowlary-Client': 'website', 'X-Flowlary-Surface': 'website' },
      body: {
        events: [
          {
            batchId: `iso-${stamp}`,
            category: 'grammar',
            original: 'he go',
            corrected: 'he goes',
            action: 'detected',
            source: 'writing',
            sampleWordCount: 2,
            sampleHash: `iso-hash-${stamp}`,
          },
        ],
      },
    })

    const regB = await json('POST', '/api/auth/register', {
      body: { email: `wl13b-iso-b-${stamp}@flowlary.test`, password },
    })
    const tokenB = regB.data.access_token as string
    const eventsB = await json('GET', '/api/learning/events', { token: tokenB })
    expect(eventsB.data.store?.events?.length ?? 0).toBe(0)

    const eventsA = await json('GET', '/api/learning/events', { token: tokenA })
    expect(eventsA.data.store?.events?.length ?? 0).toBeGreaterThan(0)
  })
})
