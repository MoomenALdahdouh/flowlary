/**
 * Release extension website bridge on flowlary.com (built artifacts only match production hosts).
 * Verifies ACCOUNT_IMPORT_SESSION without printing tokens.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const EXT = path.resolve(process.cwd(), 'extension/dist')
const SITE = 'https://flowlary.com/account'

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-bridge-prod-'))
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
    ],
  })

  const page = await context.newPage()
  await page.goto(`${SITE}?mode=register`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#ac-email', { timeout: 30_000 })

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
      const timer = setTimeout(() => finish(false), 5000)
      window.postMessage({ source: 'flowlary-website', type: 'bridge-ping' }, window.location.origin)
    })
  })

  const email = `e2e-bridge-prod.${Date.now()}@flowlary.com`
  const password = `E2e-Bridge-${Date.now()}aA1!`
  await page.fill('#ac-email', email)
  await page.fill('#ac-password', password)
  await page.fill('#ac-confirm-password', password)

  const importPromise = page.evaluate(() => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ received: false, ok: false }), 25_000)
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

  const websiteSession = await page.evaluate(() => {
    const raw = localStorage.getItem('flowlary.web.session')
    if (!raw) return { websiteAuthenticated: false, websiteAccountId: null }
    const parsed = JSON.parse(raw)
    return {
      websiteAuthenticated: Boolean(parsed.accountId && parsed.accessToken && parsed.refreshToken),
      websiteAccountId: parsed.accountId ?? null,
    }
  })

  const workers = context.serviceWorkers()
  const worker = workers[0]
  const extensionId = await worker.evaluate(() => chrome.runtime.id)
  const dash = await context.newPage()
  await dash.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`)
  await dash.waitForTimeout(500)
  const extensionSession = await dash.evaluate(async () => {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })
    const all = await chrome.storage.local.get('flowlary.auth.accountId')
    const authRaw = all['flowlary.auth.accountId']
    const accountId =
      typeof authRaw === 'object' && authRaw && 'value' in authRaw ? authRaw.value : authRaw
    return {
      extensionAccountId: accountId ?? null,
      signedIn: status?.account?.signedIn === true,
    }
  })

  await context.close()

  const report = {
    bridgeReady,
    sessionImported,
    websiteSession,
    extensionSession,
    accountIdsMatch:
      websiteSession.websiteAccountId &&
      extensionSession.extensionAccountId &&
      websiteSession.websiteAccountId === extensionSession.extensionAccountId,
  }
  console.log(JSON.stringify(report, null, 2))
  const pass =
    bridgeReady &&
    sessionImported.received &&
    sessionImported.ok &&
    websiteSession.websiteAuthenticated &&
    extensionSession.signedIn &&
    report.accountIdsMatch
  console.log('PRODUCTION_SITE_BRIDGE', pass ? 'PASS' : 'FAIL')
  process.exit(pass ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
