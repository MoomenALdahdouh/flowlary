import { expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { applyLocalEnglishRepair } from '../../packages/shared/src/correction/localEnglishRepair.ts'

const here = path.resolve(process.cwd(), 'tests/e2e')
const extensionPath = path.resolve(process.cwd(), 'extension/dist')

function mockEnglishTranslation(text: string): string {
  if (/فاتورة|الرجاء إرسال/.test(text)) return 'Please send the invoice today.'
  if (/سأتأخر|الاجتماع/.test(text)) return 'I will be half an hour late to the meeting.'
  if (/موعد/.test(text)) return 'Can you confirm the Thursday appointment?'
  if (/تقرير|أحتاج|هل يمكنك/.test(text)) return 'I need the final report before noon.'
  if (/راح|تيجي|خبرني|استناك|اطلع/.test(text)) {
    return 'If you are coming, let me know before you come because I will wait for you before I leave.'
  }
  if (/[\u0600-\u06FF]/.test(text)) return 'If you are coming, let me know before you come.'
  return 'Hello from translation.'
}

export type ApplyHow = 'direct' | 'box' | 'shortcuts'

export type ToolSeed = {
  applyHow: ApplyHow
  layout: boolean
  english: boolean
  liveTranslation: boolean
}

export async function launchExtension(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-tools-e2e-'))
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
    ],
  })
}

export async function waitForExtension(context: BrowserContext): Promise<void> {
  if (context.serviceWorkers().length > 0) return
  await context.waitForEvent('serviceworker', { timeout: 15_000 })
}

export async function serveWritingLab(): Promise<{ server: http.Server; origin: string }> {
  const html = fs.readFileSync(path.join(here, 'fixtures/writing-lab.html'))
  const frameHtml = fs.readFileSync(path.join(here, 'fixtures/frame-composer.html'))
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/'
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(url.startsWith('/frame') ? frameHtml : html)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('lab server failed to bind')
  return { server, origin: `http://127.0.0.1:${address.port}` }
}

const E2E_ACCOUNT_ID = 'e2eacct01'
const E2E_INSTALL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const E2E_INSTALL_TOKEN = 'ab'.repeat(32)

export async function seedSignedInAccount(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0]
  expect(worker).toBeTruthy()
  await worker!.evaluate(async (auth) => {
    const now = Date.now()
    await chrome.storage.local.set({
      'flowlary.auth.installId': { value: auth.installId, _v: 1 },
      'flowlary.auth.installToken': { value: auth.installToken, _v: 1 },
      'flowlary.auth.accessToken': { value: auth.accessToken, _v: 1 },
      'flowlary.auth.refreshToken': { value: auth.refreshToken, _v: 1 },
      'flowlary.auth.sessionId': { value: auth.sessionId, _v: 1 },
      'flowlary.auth.accountId': { value: auth.accountId, _v: 1 },
      'flowlary.auth.accountEmail': { value: auth.email, _v: 1 },
      'flowlary.auth.tokenExpiresAt': { value: String(now + 86_400_000), _v: 1 },
      'flowlary.auth.accountPlan': { value: 'trial', _v: 1 },
      'flowlary.auth.serverEntitlement': {
        plan: 'trial',
        isPro: false,
        inTrial: true,
        studentProActive: false,
        studentProExpiresAt: null,
        trialEndsAt: now + 86_400_000,
        remainingMs: 40,
        creditsRemaining: 40,
        creditsUsed: 0,
        dailyLimit: 40,
        resetAt: now + 86_400_000,
        monthlyCreditsUsed: 0,
        monthlySoftCap: null,
        monthlyResetAt: null,
        capabilities: [
          'ai.correction',
          'ai.translation',
          'ai.liveTranslation',
          'keyboard.unlimited',
          'speedbox.unlimited',
        ],
        billingAvailable: false,
        subscriptionStatus: null,
        cancelAtPeriodEnd: false,
        paymentFailed: false,
        currentPeriodEnd: null,
        emailVerified: true,
        syncedAt: now,
      },
    })
  }, {
    installId: E2E_INSTALL_ID,
    installToken: E2E_INSTALL_TOKEN,
    accessToken: `e2e.${E2E_INSTALL_TOKEN}`,
    refreshToken: `e2e-refresh.${E2E_INSTALL_TOKEN}`,
    sessionId: 'e2esession01',
    accountId: E2E_ACCOUNT_ID,
    email: 'e2e@flowlary.test',
  })
}

export async function seedTools(context: BrowserContext, seed: ToolSeed): Promise<void> {
  const worker = context.serviceWorkers()[0]
  expect(worker).toBeTruthy()
  const helpStyle =
    seed.applyHow === 'box' ? 'suggestions' : seed.applyHow === 'shortcuts' ? 'shortcuts_only' : 'auto'
  const mode = seed.applyHow === 'box' ? 'box' : 'direct'
  await worker!.evaluate(async (next) => {
    const accountRaw = await chrome.storage.local.get('flowlary.auth.accountId')
    const accountWrapped = accountRaw['flowlary.auth.accountId'] as { value?: string } | string | undefined
    const accountId =
      typeof accountWrapped === 'string'
        ? accountWrapped
        : typeof accountWrapped?.value === 'string'
          ? accountWrapped.value
          : ''
    const correction = {
      enabled: next.english,
      mode: next.mode,
      highlights: true,
      consentAccepted: true,
      _v: 1,
    }
    const translation = {
      mode: next.mode,
      liveEnabled: next.liveTranslation && next.helpStyle !== 'shortcuts_only',
      shortcutEnabled: true,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      _v: 1,
    }
    const layout = {
      mode: next.mode,
      autoEnabled: next.layout && next.helpStyle !== 'shortcuts_only',
      manualConversionEnabled: true,
      directShortcutEnabled: true,
      sourceLayout: 'en-US-qwerty',
      targetLayouts: ['ar-101'],
      _v: 1,
    }
    const payload: Record<string, unknown> = {
      'flowlary.settings': {
        enabled: true,
        pausedUntil: null,
        excludedDomains: [],
        version: 1,
        helpStyle: next.helpStyle,
        fixWrongTyping: next.layout,
        improveEnglish: next.english,
        arabicToEnglishMode: next.liveTranslation,
        polishAfterTranslate: false,
        improveEnglishAfterTranslate: false,
        aiAdvisorEnabled: false,
        aiWritingReviewEnabled: false,
        _v: 1,
      },
      'flowlary.ui.firstWin': { completed: true, localSuccess: true, aiSuccess: false, _v: 1 },
      'flowlary.correction': correction,
      'flowlary.translation': translation,
      'flowlary.layout': layout,
    }
    if (accountId) {
      payload[`flowlary.account.${accountId}.correction`] = correction
      payload[`flowlary.account.${accountId}.translation`] = translation
      payload[`flowlary.account.${accountId}.layout`] = layout
    }
    await chrome.storage.local.set(payload)
  }, {
    helpStyle,
    mode,
    layout: seed.layout,
    english: seed.english,
    liveTranslation: seed.liveTranslation,
  })
}

export async function startMockApi(): Promise<http.Server | null> {
  const server = http.createServer((req, res) => {
    const url = req.url ?? ''
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => {
      let text = ''
      try {
        text = String((JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { text?: string }).text ?? '')
      } catch {
        /* ignore */
      }
      res.setHeader('content-type', 'application/json')
      res.setHeader('access-control-allow-origin', '*')
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }
      if (url.startsWith('/health')) {
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true }))
        return
      }
      if (url.startsWith('/api/account/entitlement')) {
        const now = Date.now()
        res.writeHead(200)
        res.end(
          JSON.stringify({
            entitlement: {
              plan: 'trial',
              isPro: false,
              inTrial: true,
              remainingMs: 40,
              creditsRemaining: 40,
              creditsUsed: 0,
              dailyLimit: 40,
              resetAt: now + 86_400_000,
              capabilities: [
                'ai.correction',
                'ai.translation',
                'ai.liveTranslation',
                'keyboard.unlimited',
                'speedbox.unlimited',
              ],
              emailVerified: true,
            },
          }),
        )
        return
      }
      if (url.startsWith('/api/auth/refresh')) {
        res.writeHead(200)
        res.end(
          JSON.stringify({
            access_token: `e2e.${'ab'.repeat(32)}`,
            refresh_token: `e2e-refresh.${'ab'.repeat(32)}`,
            expires_in: 86400,
            session_id: 'e2esession01',
          }),
        )
        return
      }
      if (url.startsWith('/api/auth/register')) {
        res.writeHead(200)
        res.end(
          JSON.stringify({
            install_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            token: 'ab'.repeat(32),
          }),
        )
        return
      }
      if (url.startsWith('/api/ai/translation') || url.startsWith('/api/translate')) {
        const translation = mockEnglishTranslation(text)
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true, translation, provider: 'google', strategy: 'google' }))
        return
      }
      if (url.startsWith('/api/ai/correction')) {
        const correctedText = applyLocalEnglishRepair(text)
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true, originalText: text, correctedText, changes: [] }))
        return
      }
      res.writeHead(404)
      res.end(JSON.stringify({ error: { code: 'NOT_FOUND' } }))
    })
  })
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(8787, '127.0.0.1', () => resolve())
    })
    return server
  } catch (error) {
    server.close()
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code === 'EADDRINUSE') {
      console.warn('E2E mock API: 127.0.0.1:8787 is already in use; using whatever is listening.')
      return null
    }
    throw error
  }
}

export function installAiMocks(context: BrowserContext): void {
  context.route('**/api/ai/translation', async (route) => {
    const raw = route.request().postData() ?? '{}'
    let text = ''
    try {
      text = String((JSON.parse(raw) as { text?: string }).text ?? '')
    } catch {
      /* ignore */
    }
    const translation = mockEnglishTranslation(text)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        translation,
        provider: 'google',
        strategy: 'google',
      }),
    })
  })

  context.route('**/api/ai/correction', async (route) => {
    const raw = route.request().postData() ?? '{}'
    let text = ''
    try {
      text = String((JSON.parse(raw) as { text?: string }).text ?? '')
    } catch {
      /* ignore */
    }
    const correctedText = applyLocalEnglishRepair(text)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        originalText: text,
        correctedText,
        changes: [],
      }),
    })
  })
}

export async function openLab(context: BrowserContext, origin: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`${origin}/`)
  await page.waitForSelector('#plain-textarea')
  await page.waitForTimeout(800)
  return page
}

export async function typeAsPerson(page: Page, selector: string, text: string): Promise<void> {
  const field = page.locator(selector)
  await field.click()
  await field.pressSequentially(text, { delay: 22 })
}

export async function fieldText(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value
    return (el.textContent ?? '').replace(/\u00a0/g, ' ')
  })
}

export async function readSuggestionCard(page: Page): Promise<{
  label: string
  hint: string
  content: string
  legend: string
}> {
  return page.evaluate(() => {
    const hosts = [...document.querySelectorAll('[data-flowlary-suggestion-host]')]
    for (const host of hosts) {
      const root = (host as HTMLElement).shadowRoot
      const card = root?.querySelector('.card.ready')
      if (!card) continue
      const content = (root.querySelector('.content') as HTMLElement | null)?.innerText ?? ''
      const legend = (root.querySelector('.legend') as HTMLElement | null)?.innerText ?? ''
      return {
        label: (root.querySelector('.label')?.textContent ?? '').trim(),
        hint: (root.querySelector('.hint')?.textContent ?? '').trim(),
        content: content.replace(/\s+/g, ' ').trim(),
        legend: legend.replace(/\s+/g, ' ').trim(),
      }
    }
    return { label: '', hint: '', content: '', legend: '' }
  })
}

export async function waitForNativeSuggestion(page: Page, expected: string, timeout = 12_000): Promise<void> {
  await waitForSuggestion(page, timeout)
  await expect
    .poll(async () => (await readSuggestionCard(page)).content, { timeout })
    .toContain(expected)
}

export function suggestionHosts(page: Page) {
  return page.locator('[data-flowlary-suggestion-host]')
}

export async function waitForSuggestion(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const hosts = [...document.querySelectorAll('[data-flowlary-suggestion-host]')]
      return hosts.some((host) => {
        const card = (host as HTMLElement).shadowRoot?.querySelector('.card')
        return card && !card.hasAttribute('hidden') && card.classList.contains('ready')
      })
    },
    { timeout },
  )
}

export async function clickSuggestion(page: Page): Promise<void> {
  const clicked = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll('[data-flowlary-suggestion-host]')]
    for (const host of hosts) {
      const card = (host as HTMLElement).shadowRoot?.querySelector('.card.ready') as HTMLElement | null
      if (!card) continue
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }))
      card.click()
      return true
    }
    return false
  })
  if (!clicked) throw new Error('ready suggestion card missing')
}

export async function dismissSuggestion(page: Page): Promise<void> {
  await page.locator('[data-flowlary-suggestion-host]').evaluate((host) => {
    const card = (host as HTMLElement).shadowRoot?.querySelector('.card') as HTMLElement | null
    if (!card) throw new Error('suggestion card missing')
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
}

export async function runCommand(
  context: BrowserContext,
  operation: 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT',
): Promise<unknown> {
  const worker = context.serviceWorkers()[0]
  expect(worker).toBeTruthy()
  return worker!.evaluate(async (op) => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (!tab?.id) throw new Error('no active tab')
    return chrome.tabs.sendMessage(tab.id, { type: 'RUN_COMMAND', operation: op })
  }, operation)
}
