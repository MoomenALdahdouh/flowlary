import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

const here = path.resolve(process.cwd(), 'tests/e2e')
const extensionPath = path.resolve(process.cwd(), 'extension/dist')

const COLLOQUIAL_AR =
  'والله يمكن اجي اه بس مش عارف ليش بطني بيجعني.'
const GOOGLE_DRAFT =
  "I swear I might come, but I don't know why my stomach hurts."
const POLISHED_EN =
  "Honestly, maybe I'll come, yeah, but I don't know why my stomach hurts."

type TranslationCapture = {
  text: string
  segment_complete?: boolean
  focus_out_completion?: boolean
  mode?: string
}

async function launchExtension(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-live-tr-e2e-'))
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    permissions: ['clipboard-read', 'clipboard-write'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
    ],
  })
}

async function waitForExtension(context: BrowserContext): Promise<void> {
  if (context.serviceWorkers().length > 0) return
  await context.waitForEvent('serviceworker', { timeout: 15_000 })
}

async function seedPolicy(
  context: BrowserContext,
  patch: {
    helpStyle?: 'auto' | 'suggestions' | 'shortcuts_only'
    arabicToEnglishMode?: boolean
    fixWrongTyping?: boolean
    improveEnglish?: boolean
  },
): Promise<void> {
  const worker = context.serviceWorkers()[0]
  expect(worker).toBeTruthy()
  await worker!.evaluate(async (next) => {
    await chrome.storage.local.set({
      'flowlary.settings': {
        enabled: true,
        pausedUntil: null,
        excludedDomains: [],
        version: 1,
        helpStyle: next.helpStyle ?? 'auto',
        fixWrongTyping: next.fixWrongTyping ?? true,
        improveEnglish: next.improveEnglish ?? true,
        arabicToEnglishMode: next.arabicToEnglishMode ?? false,
        polishAfterTranslate: false,
        improveEnglishAfterTranslate: false,
        _v: 1,
      },
      'flowlary.ui.firstWin': { completed: true, localSuccess: true, aiSuccess: false, _v: 1 },
      'flowlary.correction': {
        enabled: true,
        mode: 'direct',
        highlights: true,
        consentAccepted: true,
        _v: 1,
      },
      'flowlary.translation': {
        mode: 'direct',
        liveEnabled: next.arabicToEnglishMode === true,
        shortcutEnabled: true,
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        _v: 1,
      },
    })
  }, patch)
}

async function seedAccount(context: BrowserContext): Promise<void> {
  const email = `e2e-live-tr-${Date.now()}@flowlary.test`
  const password = 'E2e-browser-9f3!'
  const register = await fetch('http://127.0.0.1:8787/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!register.ok) {
    throw new Error(`register failed ${register.status}`)
  }
  const body = (await register.json()) as {
    account?: { id?: string; email?: string }
    access_token?: string
    refresh_token?: string
    expires_in?: number
    session_id?: string
  }
  const worker = context.serviceWorkers()[0]
  expect(worker).toBeTruthy()
  await worker!.evaluate(async (session) => {
    await chrome.storage.local.set({
      'flowlary.auth.accessToken': { value: session.accessToken, _v: 1 },
      'flowlary.auth.refreshToken': { value: session.refreshToken, _v: 1 },
      'flowlary.auth.sessionId': { value: session.sessionId, _v: 1 },
      'flowlary.auth.accountId': { value: session.accountId, _v: 1 },
      'flowlary.auth.accountEmail': { value: session.email, _v: 1 },
      'flowlary.auth.tokenExpiresAt': { value: session.expiresAt, _v: 1 },
    })
  }, {
    accessToken: body.access_token ?? '',
    refreshToken: body.refresh_token ?? '',
    sessionId: body.session_id ?? '',
    accountId: body.account?.id ?? '',
    email: body.account?.email ?? email,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  })
}

function installTranslationMock(context: BrowserContext, captures: TranslationCapture[]): void {
  context.route('**/api/ai/translation', async (route) => {
    const raw = route.request().postData() ?? '{}'
    let body: {
      text?: string
      context?: { mode?: string; segment_complete?: boolean; focus_out_completion?: boolean }
    } = {}
    try {
      body = JSON.parse(raw) as typeof body
    } catch {
      /* ignore */
    }
    captures.push({
      text: body.text ?? '',
      segment_complete: body.context?.segment_complete,
      focus_out_completion: body.context?.focus_out_completion,
      mode: body.context?.mode,
    })

    const polished =
      body.context?.segment_complete === true
      || body.context?.focus_out_completion === true
    const translation = polished && (body.text?.includes('والله') ?? false)
      ? POLISHED_EN
      : GOOGLE_DRAFT

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        translation,
        provider: polished ? 'google_then_groq' : 'google',
        strategy: polished ? 'google_then_groq' : 'google',
      }),
    })
  })
}

test.describe('live translation polish (browser)', () => {
  let context: BrowserContext
  let origin = ''
  let server: http.Server
  const captures: TranslationCapture[] = []

  test.beforeAll(async () => {
    const html = fs.readFileSync(path.join(here, 'fixtures/fresh-surfaces.html'))
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html)
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('no listen port')
    origin = `http://127.0.0.1:${address.port}`

    context = await launchExtension()
    await waitForExtension(context)
    installTranslationMock(context, captures)
    await seedAccount(context)
    await seedPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test.afterAll(async () => {
    await context?.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  async function openField(): Promise<{ page: Page; field: ReturnType<Page['locator']> }> {
    await seedPolicy(context, {
      helpStyle: 'auto',
      arabicToEnglishMode: true,
      fixWrongTyping: false,
      improveEnglish: false,
    })
    const page = await context.newPage()
    await page.goto(`${origin}/`)
    await page.waitForSelector('#standup')
    await page.waitForTimeout(700)
    return { page, field: page.locator('#standup') }
  }

  test('completed colloquial sentence sends segment_complete and receives polished English', async () => {
    captures.length = 0
    const { page, field } = await openField()
    await field.click()
    await field.pressSequentially(COLLOQUIAL_AR, { delay: 16 })
    await expect.poll(() => captures.length, { timeout: 16_000 }).toBeGreaterThan(0)
    expect(captures.at(-1)?.segment_complete).toBe(true)
    await expect.poll(async () => field.inputValue(), { timeout: 8_000 }).toMatch(/Honestly|maybe/i)
    const value = await field.inputValue()
    expect(value).not.toMatch(/\bI swear\b/i)
    expect(value).not.toMatch(/come\.I/i)
    expect(captures.length).toBeGreaterThan(0)
    expect(captures.some((item) => item.segment_complete === true)).toBe(true)
    await page.close()
    await seedPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test('two sequential Arabic sentences keep spacing between English parts', async () => {
    captures.length = 0
    const { page, field } = await openField()
    await field.click()
    const first = 'والله يمكن اجي اه.'
    const second = ' مش عارف ليش بطني بيجعني.'
    await field.pressSequentially(first, { delay: 16 })
    await page.waitForTimeout(1_400)
    await field.pressSequentially(second, { delay: 16 })
    await expect.poll(async () => field.inputValue(), { timeout: 16_000 }).toMatch(/stomach hurts/i)
    const value = await field.inputValue()
    expect(value).not.toMatch(/[\p{L}]\.[\p{L}]/u)
    expect(value).not.toMatch(/come\.I/i)
    await page.close()
    await seedPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test('incomplete colloquial fragment uses Google draft without polish context', async () => {
    captures.length = 0
    const { page, field } = await openField()
    await field.click()
    const fragment = 'والله يمكن اجي'
    await field.pressSequentially(fragment, { delay: 16 })
    await expect.poll(async () => field.inputValue(), { timeout: 16_000 }).toMatch(/I swear/i)
    expect(captures.some((item) => item.segment_complete === true)).toBe(false)
    await page.close()
    await seedPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })
})
