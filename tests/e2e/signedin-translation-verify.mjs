/**
 * Signed-in translation browser verification (local build against production API).
 * CASE A: fixture tab before login, no reload after auth.
 * CASE B: fixture tab after login + reload.
 */
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

const EXT = path.resolve(process.cwd(), 'extension/dist')
const ARABIC = 'الرجاء إرسال الفاتورة اليوم. '

async function getServiceWorker(context) {
  for (let i = 0; i < 40; i++) {
    const workers = context.serviceWorkers()
    if (workers.length > 0) return workers[0]
    await new Promise((r) => setTimeout(r, 250))
  }
  return context.waitForEvent('serviceworker', { timeout: 20_000 })
}

async function registerFromDashboard(context, extensionId) {
  const email = `e2e-tr.${Date.now()}@flowlary.com`
  const password = `E2e-Verify-${Date.now()}aA1!`
  const extPage = await context.newPage()
  await extPage.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`)
  await extPage.waitForTimeout(400)
  const result = await extPage.evaluate(async ({ email, password }) => {
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
    const registered = await chrome.runtime.sendMessage({ type: 'ACCOUNT_REGISTER', email, password })
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })
    return {
      signedIn: status?.account?.signedIn === true,
      arabicToEnglishMode: status?.writingPolicy?.arabicToEnglishMode === true,
      liveEnabled: status?.translation?.liveEnabled === true,
      registerError: registered?.error ?? null,
    }
  }, { email, password })
  await extPage.close()
  return result
}

async function readStorageSnapshot(worker) {
  return worker.evaluate(async () => {
    const all = await chrome.storage.local.get(null)
    const authRaw = all['flowlary.auth.accountId']
    const accountId =
      typeof authRaw === 'object' && authRaw && 'value' in authRaw ? authRaw.value : authRaw
    const trKey = accountId ? `flowlary.account.${accountId}.translation` : null
    const corrKey = accountId ? `flowlary.account.${accountId}.correction` : null
    return {
      settings: all['flowlary.settings'] ?? null,
      accountTranslation: trKey ? all[trKey] ?? null : null,
      accountCorrection: corrKey ? all[corrKey] ?? null : null,
      authAccountId: accountId ?? null,
    }
  })
}

async function layoutCanary(page) {
  const field = page.locator('#standup')
  await field.click()
  await field.fill('')
  await field.pressSequentially('صثثنثىي ', { delay: 20 })
  await page.waitForTimeout(1500)
  return (await field.inputValue()).slice(0, 40)
}

async function typeArabicAndObserve(page, network) {
  const field = page.locator('#standup')
  await field.click()
  await field.fill('')
  await field.pressSequentially(ARABIC, { delay: 18 })
  await page.waitForTimeout(500)
  await field.blur()
  await page.waitForTimeout(1200)
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
  const html = `<!doctype html><meta charset="utf-8"/><title>tr verify</title>
<textarea id="standup" rows="5" dir="auto" style="width:90%;font-size:16px"></textarea>`
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-tr-verify-'))
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

  const report = { caseA: null, caseB: null, register: null, storage: null, layoutCanary: null }

  const pageA = await context.newPage()
  await pageA.goto(origin + '/')
  await pageA.waitForSelector('#standup')
  await pageA.waitForTimeout(800)
  report.register = await registerFromDashboard(context, extensionId)
  report.storage = await readStorageSnapshot(worker)
  await pageA.waitForTimeout(600)
  report.layoutCanary = await layoutCanary(pageA)
  report.caseA = await typeArabicAndObserve(pageA, network)
  await pageA.close()

  const pageB = await context.newPage()
  await pageB.goto(origin + '/')
  await pageB.waitForSelector('#standup')
  await pageB.reload()
  await pageB.waitForSelector('#standup')
  await pageB.waitForTimeout(800)
  report.caseB = await typeArabicAndObserve(pageB, network)

  await context.close()
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())))

  console.log(JSON.stringify(report, null, 2))
  const passA =
    report.caseA?.english && !report.caseA?.stillArabic && report.caseA?.translationPosts > 0
  const passB =
    report.caseB?.english && !report.caseB?.stillArabic && report.caseB?.translationPosts > 0
  console.log('CASE_A', passA ? 'PASS' : 'FAIL')
  console.log('CASE_B', passB ? 'PASS' : 'FAIL')
  process.exit(passA && passB ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
