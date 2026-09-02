/**
 * Website → extension session bridge + live translation verification.
 * Uses dev extension build (flowlary.test websiteBridge matches).
 * API target: production https://api.flowlary.com (via VITE_FLOWLARY_API_URL at build time).
 */
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

const EXT = path.resolve(process.cwd(), 'extension/dist')
const SITE = 'https://flowlary.test/account'
const ARABIC = 'الرجاء إرسال الفاتورة اليوم. '

async function getServiceWorker(context) {
  for (let i = 0; i < 40; i++) {
    const workers = context.serviceWorkers()
    if (workers.length > 0) return workers[0]
    await new Promise((r) => setTimeout(r, 250))
  }
  return context.waitForEvent('serviceworker', { timeout: 20_000 })
}

async function waitForExtensionReady(context, extensionId, maxMs = 30_000) {
  const page = await context.newPage()
  const started = Date.now()
  while (Date.now() - started < maxMs) {
    try {
      await page.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`, {
        waitUntil: 'domcontentloaded',
      })
      await page.waitForTimeout(400)
      const ready = await page.evaluate(async () => {
        try {
          const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })
          return Boolean(status && typeof status === 'object')
        } catch {
          return false
        }
      })
      if (ready) {
        await page.close()
        return true
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  await page.close()
  throw new Error('extension_not_ready')
}

async function applyPreAuthSettings(context, extensionId) {
  await waitForExtensionReady(context, extensionId)
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(400)
  const result = await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ type: 'SET_CORRECTION', patch: { consentAccepted: true } })
    await chrome.runtime.sendMessage({
      type: 'SET_SETTINGS',
      patch: { enabled: true, arabicToEnglishMode: true, helpStyle: 'auto', fixWrongTyping: true },
    })
    await chrome.runtime.sendMessage({
      type: 'SET_TRANSLATION',
      patch: {
        liveEnabled: true,
        shortcutEnabled: true,
        mode: 'direct',
        sourceLanguage: 'ar',
        targetLanguage: 'en',
      },
    })
    await chrome.runtime.sendMessage({
      type: 'MARK_FIRST_WIN',
      patch: { completed: true, localSuccess: true, aiSuccess: false },
    })
    return { ok: true }
  })
  await page.close()
  return result
}

async function readExtensionSessionSafe(context, extensionId) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(400)
  const snapshot = await page.evaluate(async () => {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })
    const all = await chrome.storage.local.get(null)
    const authRaw = all['flowlary.auth.accountId']
    const accountId =
      typeof authRaw === 'object' && authRaw && 'value' in authRaw ? authRaw.value : authRaw
    const trKey = accountId ? `flowlary.account.${accountId}.translation` : null
    const corrKey = accountId ? `flowlary.account.${accountId}.correction` : null
    return {
      extensionAccountId: accountId ?? null,
      signedIn: status?.account?.signedIn === true,
      arabicToEnglishMode: status?.writingPolicy?.arabicToEnglishMode === true,
      liveEnabled: status?.translation?.liveEnabled === true,
      consentAccepted: status?.correction?.consentAccepted === true,
      helpStyle: status?.writingPolicy?.helpStyle ?? null,
      accountTranslationLive: trKey ? all[trKey]?.liveEnabled === true : null,
      accountCorrectionConsent: corrKey ? all[corrKey]?.consentAccepted === true : null,
      authPublishedBeforeAccountKeys: Boolean(
        accountId && trKey && corrKey && all[trKey] != null && all[corrKey] != null,
      ),
    }
  })
  await page.close()
  return snapshot
}

function readWebsiteSessionSafe(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('flowlary.web.session')
    if (!raw) {
      return { websiteAuthenticated: false, websiteAccountId: null, hasSessionKey: false }
    }
    try {
      const parsed = JSON.parse(raw)
      const accountId = parsed.accountId ?? null
      const hasTokens =
        typeof parsed.accessToken === 'string' &&
        typeof parsed.refreshToken === 'string' &&
        typeof parsed.sessionId === 'string'
      return {
        websiteAuthenticated: Boolean(accountId && hasTokens),
        websiteAccountId: accountId,
        hasSessionKey: true,
        emailRedacted: typeof parsed.email === 'string' ? parsed.email.replace(/(.{2}).+(@.+)/, '$1***$2') : null,
        expiresAt: parsed.expiresAt ?? null,
      }
    } catch {
      return { websiteAuthenticated: false, websiteAccountId: null, hasSessionKey: true, parseError: true }
    }
  })
}

async function registerOnWebsite(page, email, password) {
  await page.goto(`${SITE}?mode=register`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#ac-email')

  const bridgeReady = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let settled = false
      const finish = (value) => {
        if (settled) return
        settled = true
        window.removeEventListener('message', onMessage)
        clearTimeout(timer)
        resolve(value)
      }
      const onMessage = (event) => {
        const data = event.data
        if (data?.source === 'flowlary-extension' && data.type === 'bridge-ready') finish(true)
      }
      window.addEventListener('message', onMessage)
      const timer = setTimeout(() => finish(false), 3000)
      window.postMessage({ source: 'flowlary-website', type: 'bridge-ping' }, window.location.origin)
    })
  })

  await page.fill('#ac-email', email)
  await page.fill('#ac-password', password)
  await page.fill('#ac-confirm-password', password)

  const importPromise = page.evaluate(() => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ received: false, ok: false }), 20_000)
      window.addEventListener('message', function onMessage(event) {
        const data = event.data
        if (data?.source === 'flowlary-extension' && data.type === 'session-imported') {
          window.removeEventListener('message', onMessage)
          clearTimeout(timer)
          resolve({ received: true, ok: data.ok === true })
        }
      })
    })
  })

  await page.click('button.ac-submit')
  const sessionImported = await importPromise

  await page.waitForTimeout(1500)
  const websiteSession = await readWebsiteSessionSafe(page)

  return { bridgeReady, sessionImported, websiteSession }
}

async function typeArabicAndObserve(page, network) {
  const field = page.locator('#standup')
  await field.click()
  await field.fill('')
  await field.pressSequentially(ARABIC, { delay: 18 })
  await page.waitForTimeout(500)
  await field.blur()
  await page.waitForTimeout(1500)
  const final = await field.inputValue()
  const english = /invoice|send|today|please|bill|receipt/i.test(final)
  const stillArabic = final.includes('الرجاء إرسال الفاتورة')
  const posts = network.filter((n) => n.path === '/api/ai/translation')
  return {
    final: final.slice(0, 120),
    english,
    stillArabic,
    translationPosts: posts.length,
    posts,
  }
}

async function main() {
  const html = `<!doctype html><meta charset="utf-8"/><title>bridge verify</title>
<textarea id="standup" rows="5" dir="auto" style="width:90%;font-size:16px"></textarea>`
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-bridge-verify-'))
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
    ],
  })

  const network = []
  context.on('response', async (res) => {
    const u = res.url()
    if (!u.includes('api.flowlary.com')) return
    try {
      const p = new URL(u)
      network.push({ method: res.request().method(), path: p.pathname, status: res.status() })
    } catch {
      /* ignore */
    }
  })

  const worker = await getServiceWorker(context)
  const extensionId = await worker.evaluate(() => chrome.runtime.id)
  const bootPage = await context.newPage()
  await bootPage.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`, { waitUntil: 'domcontentloaded' })
  await bootPage.waitForTimeout(600)
  await bootPage.close()

  const email = `e2e-bridge.${Date.now()}@flowlary.com`
  const password = `E2e-Bridge-${Date.now()}aA1!`

  const report = {
    preAuth: null,
    websiteRegister: null,
    extensionAfterBridge: null,
    accountIdsMatch: false,
    caseA: null,
    caseB: null,
  }

  const fixtureA = await context.newPage()
  await fixtureA.goto(origin + '/')
  await fixtureA.waitForSelector('#standup')
  await fixtureA.waitForTimeout(800)

  report.preAuth = await applyPreAuthSettings(context, extensionId)

  const websitePage = await context.newPage()
  report.websiteRegister = await registerOnWebsite(websitePage, email, password)
  await websitePage.waitForTimeout(800)
  report.extensionAfterBridge = await readExtensionSessionSafe(context, extensionId)

  const webId = report.websiteRegister?.websiteSession?.websiteAccountId
  const extId = report.extensionAfterBridge?.extensionAccountId
  report.accountIdsMatch = Boolean(webId && extId && webId === extId)

  report.caseA = await typeArabicAndObserve(fixtureA, network)
  await fixtureA.close()
  await websitePage.close()

  const fixtureB = await context.newPage()
  await fixtureB.goto(origin + '/')
  await fixtureB.waitForSelector('#standup')
  await fixtureB.reload()
  await fixtureB.waitForSelector('#standup')
  await fixtureB.waitForTimeout(800)
  report.caseB = await typeArabicAndObserve(fixtureB, network)

  await context.close()
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())))

  console.log(JSON.stringify(report, null, 2))

  const passBridge =
    report.websiteRegister?.bridgeReady === true &&
    report.websiteRegister?.sessionImported?.received === true &&
    report.websiteRegister?.sessionImported?.ok === true &&
    report.websiteRegister?.websiteSession?.websiteAuthenticated === true &&
    report.accountIdsMatch === true &&
    report.extensionAfterBridge?.signedIn === true &&
    report.extensionAfterBridge?.consentAccepted === true &&
    report.extensionAfterBridge?.liveEnabled === true &&
    report.extensionAfterBridge?.arabicToEnglishMode === true

  const passA =
    report.caseA?.english && !report.caseA?.stillArabic && report.caseA?.translationPosts > 0
  const passB =
    report.caseB?.english && !report.caseB?.stillArabic && report.caseB?.translationPosts > 0

  console.log('WEBSITE_BRIDGE', passBridge ? 'PASS' : 'FAIL')
  console.log('CASE_A', passA ? 'PASS' : 'FAIL')
  console.log('CASE_B', passB ? 'PASS' : 'FAIL')
  process.exit(passBridge && passA && passB ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
