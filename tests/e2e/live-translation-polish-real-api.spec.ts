import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

const here = path.resolve(process.cwd(), 'tests/e2e')
const extensionPath = path.resolve(process.cwd(), 'extension/dist')

const LEVANTINE =
  'اسمع انت ابعتله الايمل وانا بس اروح بشوف شو باقي علينا شغل'
const GOOGLE_LITERAL = /what work we still have to do/i

type TranslationApiCapture = {
  text: string
  mode?: string
  segment_complete?: boolean
  focus_out_completion?: boolean
  provider?: string
  strategy?: string
  translation?: string
  url: string
}

async function launchExtension(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-live-tr-real-e2e-'))
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

async function seedPolicy(context: BrowserContext, arabicToEnglishMode: boolean): Promise<void> {
  const worker = context.serviceWorkers()[0]
  expect(worker).toBeTruthy()
  await worker!.evaluate(async (live) => {
    await chrome.storage.local.set({
      'flowlary.settings': {
        enabled: true,
        pausedUntil: null,
        excludedDomains: [],
        version: 1,
        helpStyle: 'auto',
        fixWrongTyping: false,
        improveEnglish: false,
        arabicToEnglishMode: live,
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
        liveEnabled: live,
        shortcutEnabled: true,
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        _v: 1,
      },
    })
  }, arabicToEnglishMode)
}

async function seedAccount(context: BrowserContext): Promise<void> {
  const email = `e2e-live-tr-real-${Date.now()}@flowlary.test`
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

function installPassthroughCapture(
  context: BrowserContext,
  captures: TranslationApiCapture[],
): void {
  void context.route('**/api/ai/translation', async (route) => {
    const request = route.request()
    const raw = request.postData() ?? '{}'
    let parsed: {
      text?: string
      context?: { mode?: string; segment_complete?: boolean; focus_out_completion?: boolean }
    } = {}
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch {
      /* ignore */
    }
    const response = await route.fetch()
    let translation: string | undefined
    let provider: string | undefined
    let strategy: string | undefined
    try {
      const json = (await response.json()) as {
        translation?: string
        provider?: string
        strategy?: string
      }
      translation = json.translation
      provider = json.provider
      strategy = json.strategy
    } catch {
      /* ignore */
    }
    captures.push({
      text: parsed.text ?? '',
      mode: parsed.context?.mode,
      segment_complete: parsed.context?.segment_complete,
      focus_out_completion: parsed.context?.focus_out_completion,
      provider,
      strategy,
      translation,
      url: request.url(),
    })
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: JSON.stringify({
        ok: true,
        translation: translation ?? '',
        provider,
        strategy,
      }),
    })
  })
}

test.describe('live translation polish (real API browser)', () => {
  test.describe.configure({ timeout: 90_000 })

  let context: BrowserContext
  let origin = ''
  let server: http.Server
  const captures: TranslationApiCapture[] = []

  test.beforeAll(async () => {
    const health = await fetch('http://127.0.0.1:8787/api/auth/register', { method: 'OPTIONS' }).catch(
      () => null,
    )
    if (!health) {
      throw new Error('Local API at http://127.0.0.1:8787 is not running. Start npm run dev:api first.')
    }

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
    installPassthroughCapture(context, captures)
    await seedAccount(context)
    await seedPolicy(context, false)
  })

  test.afterAll(async () => {
    await context?.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  async function openField(): Promise<{ page: Page; field: ReturnType<Page['locator']> }> {
    await seedPolicy(context, true)
    const page = await context.newPage()
    await page.goto(`${origin}/`)
    await page.waitForSelector('#standup')
    await page.waitForTimeout(700)
    return { page, field: page.locator('#standup') }
  }

  test('Levantine pause uses Groq polish, not Google-literal English', async () => {
    captures.length = 0
    const { page, field } = await openField()
    await field.click()
    await field.pressSequentially(LEVANTINE, { delay: 18 })
    await page.waitForTimeout(1_600)

    await expect.poll(() => captures.length, { timeout: 40_000 }).toBeGreaterThan(0)
    const last = captures.at(-1)
    expect(last, 'translation API should be called').toBeTruthy()
    expect(last!.url).toMatch(/\/api\/ai\/translation/)
    expect(last!.mode).toBe('live')
    expect(last!.provider).toBe('groq')
    expect(last!.translation ?? '').not.toMatch(GOOGLE_LITERAL)
    expect(last!.translation ?? '').toMatch(/listen/i)

    await expect.poll(async () => field.inputValue(), { timeout: 12_000 }).toMatch(/listen/i)
    const value = await field.inputValue()
    expect(value).not.toMatch(GOOGLE_LITERAL)
    expect(value).not.toMatch(/[\u0600-\u06FF]/)

    await page.close()
    await seedPolicy(context, false)
  })
})
