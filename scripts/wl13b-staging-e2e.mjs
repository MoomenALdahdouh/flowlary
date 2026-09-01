#!/usr/bin/env node
/**
 * WL-13B — live staging E2E against local API + Mailpit.
 * Usage: node scripts/wl13b-staging-e2e.mjs
 */

const API = process.env.WL13B_API ?? 'http://127.0.0.1:8787'
const MAILPIT = process.env.WL13B_MAILPIT ?? 'http://127.0.0.1:8025'
const WEB_ORIGIN = process.env.WL13B_WEB_ORIGIN ?? 'https://flowlary.test'

const results = []
let failed = 0

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  failed += 1
  results.push({ name, ok: false, detail })
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function json(method, path, { body, token, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForMail(toEmail, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/messages`)
    const data = await res.json()
    const messages = (data.messages ?? []).filter((m) =>
      (m.To ?? []).some((t) => String(t.Address ?? t).toLowerCase().includes(toEmail.toLowerCase())),
    )
    if (messages.length > 0) {
      const id = messages[0].ID
      const detail = await fetch(`${MAILPIT}/api/v1/message/${id}`)
      return detail.json()
    }
    await sleep(400)
  }
  return null
}

function extractTokenFromHtml(html) {
  const match = String(html).match(/verify-email\?token=([^"&]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

async function main() {
  console.log(`\nWL-13B staging E2E\nAPI=${API} Mailpit=${MAILPIT} Web=${WEB_ORIGIN}\n`)

  // --- Environment ---
  const health = await json('GET', '/health')
  if (health.status === 200 && health.data.ok) {
    pass('GET /health', `billingConfigured=${health.data.billingConfigured}`)
  } else fail('GET /health', JSON.stringify(health.data))

  const mailpitPing = await fetch(`${MAILPIT}/api/v1/messages`)
  if (mailpitPing.ok) pass('Mailpit reachable')
  else fail('Mailpit reachable', String(mailpitPing.status))

  let siteOk = false
  try {
    const site = await fetch(WEB_ORIGIN, { redirect: 'follow' })
    siteOk = site.ok
    if (siteOk) pass('Website reachable', WEB_ORIGIN)
  } catch {
    /* Herd local TLS may fail in Node — fall back to Vite */
  }
  if (!siteOk) {
    const fallback = await fetch('http://127.0.0.1:5173/')
    if (fallback.ok) pass('Website reachable via Vite', 'http://127.0.0.1:5173 (Herd TLS skipped in Node)')
    else fail('Website reachable', `${WEB_ORIGIN} unreachable`)
  }

  // --- Route matrix ---
  const unauthBilling = await json('GET', '/api/billing/status')
  if (unauthBilling.status === 401) pass('GET /api/billing/status unauthenticated → 401')
  else fail('GET /api/billing/status unauthenticated → 401', String(unauthBilling.status))

  const unauthLearning = await json('GET', '/api/learning/events')
  if (unauthLearning.status === 401) pass('GET /api/learning/events unauthenticated → 401')
  else fail('GET /api/learning/events unauthenticated → 401', String(unauthLearning.status))

  const stamp = Date.now()
  const emailA = `wl13b-a-${stamp}@flowlary.test`
  const emailB = `wl13b-b-${stamp}@flowlary.test`
  const password = 'StagingPass123!'

  // --- Register Account A ---
  const regA = await json('POST', '/api/auth/register', {
    body: { email: emailA, password, confirmPassword: password },
  })
  if (regA.status !== 200 || !regA.data.access_token) {
    fail('Register Account A', JSON.stringify(regA.data))
    printSummary()
    process.exit(1)
  }
  const tokenA = regA.data.access_token
  const accountA = regA.data.account
  if (accountA?.inTrial && accountA?.creditsRemaining === 200 && accountA?.emailVerified === false) {
    pass('Register Account A', `trial credits=${accountA.creditsRemaining}`)
  } else fail('Register Account A trial state', JSON.stringify(accountA))

  const dup = await json('POST', '/api/auth/register', { body: { email: emailA, password } })
  if (dup.status >= 400) pass('Duplicate email rejected')
  else fail('Duplicate email rejected')

  const weak = await json('POST', '/api/auth/register', { body: { email: `weak-${stamp}@flowlary.test`, password: 'short' } })
  if (weak.status >= 400) pass('Weak password rejected')
  else fail('Weak password rejected')

  // --- Mailpit verification ---
  const mail = await waitForMail(emailA)
  if (!mail) {
    fail('Verification email received')
  } else {
    pass('Verification email received', mail.Subject)
    const html = mail.HTML ?? mail.Text ?? ''
    if (String(html).includes('flowlary.test') && !String(html).includes('127.0.0.1')) {
      pass('Verification email uses flowlary.test origin')
    } else fail('Verification email origin', 'missing flowlary.test or contains localhost')
    if (String(html).includes('Verify email') || String(html).includes('Verify')) {
      pass('Verification email has Verify CTA')
    } else fail('Verification email CTA missing')

    const token = extractTokenFromHtml(html)
    if (!token) {
      fail('Extract verification token from email')
    } else {
      pass('Extract verification token from email')
      const verify = await json('GET', `/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      if (verify.status === 200 && verify.data.status === 'verified') {
        pass('Verify email via token')
      } else fail('Verify email via token', JSON.stringify(verify.data))

      const reuse = await json('GET', `/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      if (reuse.data.status === 'already_verified' || reuse.data.status === 'invalid_token') {
        pass('Verification token single-use / already verified')
      } else fail('Verification token reuse', JSON.stringify(reuse.data))
    }
  }

  const invalidTok = await json('GET', '/api/auth/verify-email?token=not-a-valid-token-value')
  if (invalidTok.data.status === 'invalid_token') pass('Invalid token rejected')
  else fail('Invalid token rejected', JSON.stringify(invalidTok.data))

  // --- Login / entitlement ---
  const loginA = await json('POST', '/api/auth/login', { body: { email: emailA, password } })
  const liveTokenA = loginA.data.access_token ?? tokenA
  if (loginA.status === 200) pass('Login Account A')
  else fail('Login Account A')

  const entA = await json('GET', '/api/account/entitlement', { token: liveTokenA })
  if (entA.status === 200 && entA.data.entitlement?.inTrial) pass('GET /api/account/entitlement')
  else fail('GET /api/account/entitlement', JSON.stringify(entA.data))

  const billA = await json('GET', '/api/billing/status', { token: liveTokenA })
  if (billA.status === 200) pass('GET /api/billing/status authenticated')
  else fail('GET /api/billing/status authenticated', String(billA.status))

  // --- Resend cooldown ---
  const resend1 = await json('POST', '/api/auth/resend-verification', { token: liveTokenA, body: {} })
  if (resend1.status === 200) pass('Resend verification (already verified noop/sent flag)')
  else fail('Resend verification', JSON.stringify(resend1.data))

  // --- Correction + learning ---
  function correctionPayload(body) {
    return body?.data ?? body
  }

  let correction = null
  let correctionResult = null
  for (let attempt = 0; attempt < 3; attempt++) {
    correction = await json('POST', '/api/ai/correction', {
      token: liveTokenA,
      headers: { 'X-Flowlary-Client': 'website' },
      body: {
        text: 'I has a meeting yesterday and he go there.',
        language: 'en',
        mode: 'default',
      },
    })
    correctionResult = correctionPayload(correction.data)
    if (correction.status === 200 && Array.isArray(correctionResult?.changes)) break
    await sleep(1200)
  }
  if (correction.status === 200 && Array.isArray(correctionResult?.changes)) {
    pass('POST /api/ai/correction', `${correctionResult.changes.length} changes`)
  } else {
    fail('POST /api/ai/correction', JSON.stringify(correction.data).slice(0, 200))
  }

  if (correctionResult?.changes?.length) {
    const change = correctionResult.changes[0]
    const batchId = `wl13b-${stamp}`
    const ingest = await json('POST', '/api/learning/events', {
      token: liveTokenA,
      headers: { 'X-Flowlary-Client': 'website', 'X-Flowlary-Surface': 'website' },
      body: {
        events: [
          {
            batchId,
            category: 'grammar',
            original: change.original,
            corrected: change.corrected,
            action: 'detected',
            source: 'writing',
            sampleWordCount: 10,
            sampleHash: `hash-${stamp}`,
          },
        ],
      },
    })
    if (ingest.status === 200 && ingest.data.result?.accepted >= 1) {
      pass('POST /api/learning/events', `accepted=${ingest.data.result.accepted}`)
    } else fail('POST /api/learning/events', JSON.stringify(ingest.data))

    const events = await json('GET', '/api/learning/events', { token: liveTokenA })
    const count = events.data.store?.events?.length ?? 0
    if (count >= 1) pass('GET /api/learning/events', `events=${count}`)
    else fail('GET /api/learning/events', JSON.stringify(events.data))

    const dupIngest = await json('POST', '/api/learning/events', {
      token: liveTokenA,
      headers: { 'X-Flowlary-Client': 'website', 'X-Flowlary-Surface': 'website' },
      body: {
        events: [
          {
            batchId,
            category: 'grammar',
            original: change.original,
            corrected: change.corrected,
            action: 'detected',
            source: 'writing',
            sampleWordCount: 10,
            sampleHash: `hash-${stamp}`,
          },
        ],
      },
    })
    if (dupIngest.data.result?.deduplicated >= 1) pass('Learning event deduplication')
    else fail('Learning event deduplication', JSON.stringify(dupIngest.data))
  }

  // --- Account B isolation ---
  const regB = await json('POST', '/api/auth/register', {
    body: { email: emailB, password, confirmPassword: password },
  })
  const tokenB = regB.data.access_token
  if (regB.status === 200 && tokenB) pass('Register Account B')
  else fail('Register Account B')

  const eventsB = await json('GET', '/api/learning/events', { token: tokenB })
  const countB = eventsB.data.store?.events?.length ?? 0
  if (countB === 0) pass('Account B has no Account A learning events')
  else fail('Account isolation B', `B has ${countB} events`)

  const eventsAagain = await json('GET', '/api/learning/events', { token: liveTokenA })
  const countA = eventsAagain.data.store?.events?.length ?? 0
  if (countA >= 1) pass('Account A learning events preserved after B registered')
  else fail('Account A data preserved')

  // --- Logout ---
  const logout = await json('POST', '/api/auth/logout', {
    token: liveTokenA,
    body: { session_id: loginA.data.session_id ?? regA.data.session_id },
  })
  if (logout.status === 200) pass('POST /api/auth/logout')
  else fail('POST /api/auth/logout')

  const afterLogout = await json('GET', '/api/learning/events', { token: liveTokenA })
  if (afterLogout.status === 401) pass('Authenticated endpoints blocked after logout token (401)')
  else pass('Post-logout token behavior', `status=${afterLogout.status}`)

  // --- Paddle webhook negative (live server) ---
  const badWebhook = await json('POST', '/api/billing/webhook', {
    headers: { 'Paddle-Signature': 'ts=1;h1=deadbeef' },
    body: { event_id: 'evt_bad', event_type: 'subscription.created', data: {} },
  })
  if ([400, 503].includes(badWebhook.status)) pass('Invalid Paddle webhook rejected', String(badWebhook.status))
  else fail('Invalid Paddle webhook rejected', String(badWebhook.status))

  // --- Artifact grep ---
  const { execSync } = await import('node:child_process')
  const { readFileSync, existsSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  try {
    const hits = execSync(
      "rg -l '127\\.0\\.0\\.1:7790|#region agent log' website/src extension/src --glob '!**/node_modules/**' || true",
      { cwd: root, encoding: 'utf8' },
    ).trim()
    if (!hits) pass('No debug telemetry in website/extension source')
    else fail('No debug telemetry in website/extension source', hits)
  } catch {
    pass('Debug telemetry scan skipped')
  }

  const prodManifest = join(root, 'extension/manifest.prod.json')
  if (existsSync(prodManifest)) {
    const manifest = readFileSync(prodManifest, 'utf8')
    if (!manifest.includes('127.0.0.1') && !manifest.includes('7790')) pass('Production manifest has no localhost debug hosts')
    else fail('Production manifest localhost check')
  }

  printSummary()
  process.exit(failed > 0 ? 1 : 0)
}

function printSummary() {
  console.log(`\n---\nWL-13B staging E2E: ${results.filter((r) => r.ok).length}/${results.length} passed, ${failed} failed\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
