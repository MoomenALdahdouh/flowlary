import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import {
  ENGLISH_WRITING_ERRORS,
  LAYOUT_AR_TYPED_ON_EN,
  LAYOUT_EN_TYPED_ON_AR,
  MIXED_LEAVE_ALONE,
  PROTECTED_PROSE,
  TRANSLATE_OFFICE_AR,
} from './fresh-browser-corpus.ts'
import { CHAT_ENGLISH_TYPOS } from './user-writing-scripts.ts'
import { installAiMocks, seedSignedInAccount, startMockApi } from './harness.ts'

const here = path.resolve(process.cwd(), 'tests/e2e')
const extensionPath = path.resolve(process.cwd(), 'extension/dist')

async function launchExtension(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-fresh-e2e-'))
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
    improveEnglish?: boolean
    fixWrongTyping?: boolean
  },
): Promise<void> {
  const worker = context.serviceWorkers()[0]
  expect(worker).toBeTruthy()
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
      enabled: true,
      mode: next.helpStyle === 'suggestions' ? 'box' : 'direct',
      highlights: true,
      consentAccepted: true,
      _v: 1,
    }
    const translation = {
      mode: 'direct',
      liveEnabled: next.arabicToEnglishMode === true,
      shortcutEnabled: true,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      _v: 1,
    }
    const payload: Record<string, unknown> = {
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
        aiAdvisorEnabled: false,
        aiWritingReviewEnabled: false,
        _v: 1,
      },
      'flowlary.ui.firstWin': { completed: true, localSuccess: true, aiSuccess: false, _v: 1 },
      'flowlary.correction': correction,
      'flowlary.translation': translation,
    }
    if (accountId) {
      payload[`flowlary.account.${accountId}.correction`] = correction
      payload[`flowlary.account.${accountId}.translation`] = translation
    }
    await chrome.storage.local.set(payload)
  }, patch)
}

async function openSurfaces(context: BrowserContext, origin: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`${origin}/`)
  await page.waitForSelector('#reply')
  await page.waitForTimeout(700)
  return page
}

async function runCommand(
  context: BrowserContext,
  operation: 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT' | 'SPEED_BOX',
): Promise<unknown> {
  const worker = context.serviceWorkers()[0]
  expect(worker).toBeTruthy()
  return worker!.evaluate(async (op) => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (!tab?.id) throw new Error('no active tab')
    return chrome.tabs.sendMessage(tab.id, { type: 'RUN_COMMAND', operation: op })
  }, operation)
}

async function readLogicalText(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let out = ''
    let node: Node | null
    while ((node = walker.nextNode())) out += node.data
    return out.replace(/\u00a0/g, ' ')
  })
}

test.describe('fresh real-browser writing corpus', () => {
  let context: BrowserContext
  let server: http.Server
  let origin = ''
  let apiServer: Awaited<ReturnType<typeof startMockApi>>

  test.beforeAll(async () => {
    apiServer = await startMockApi()
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
    await seedSignedInAccount(context)
    installAiMocks(context)
    await seedPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test.afterAll(async () => {
    await context?.close()
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
    if (apiServer) {
      await new Promise<void>((resolve) => apiServer!.close(() => resolve()))
    }
  })

  test('ticket reply: English typed on an Arabic keyboard remaps', async () => {
    const page = await openSurfaces(context, origin)
    const field = page.locator('#reply')
    await field.click()
    const sample = LAYOUT_EN_TYPED_ON_AR[0]!
    await field.pressSequentially(sample.typed, { delay: 20 })
    // Auto-layout commits lexicon-backed spans (look/good), not every word.
    await expect.poll(async () => field.inputValue(), { timeout: 7_000 }).toMatch(/look good/i)
    await page.close()
  })

  test('ticket title: shorter wrong-keyboard English remaps in an input', async () => {
    const page = await openSurfaces(context, origin)
    const field = page.locator('#title')
    await field.click()
    const sample = LAYOUT_EN_TYPED_ON_AR[2]!
    await field.pressSequentially(sample.typed, { delay: 20 })
    await expect.poll(async () => field.inputValue(), { timeout: 7_000 }).toMatch(/is at noon/i)
    await page.close()
  })

  test('email draft: Arabic typed on an English keyboard remaps', async () => {
    const page = await openSurfaces(context, origin)
    const field = page.locator('#draft')
    await field.click()
    const sample = LAYOUT_AR_TYPED_ON_EN[0]!
    await field.pressSequentially(sample.typed, { delay: 20 })
    await expect.poll(async () => field.inputValue(), { timeout: 7_000 }).toMatch(sample.expected)
    await page.close()
  })

  test('standup: local English writing errors auto-fix after space', async () => {
    const page = await openSurfaces(context, origin)
    const field = page.locator('#standup')
    await field.click()
    for (const sample of ENGLISH_WRITING_ERRORS) {
      await field.fill('')
      await field.pressSequentially(sample.typed, { delay: 14 })
      await expect.poll(async () => field.inputValue(), { timeout: 5_000 }).toMatch(sample.expected)
    }
    await page.close()
  })

  test('standup: mixed bilingual notes are not remapped into garbage', async () => {
    const page = await openSurfaces(context, origin)
    const field = page.locator('#standup')
    await field.click()
    for (const sample of MIXED_LEAVE_ALONE) {
      await field.fill('')
      await field.pressSequentially(`${sample} `, { delay: 12 })
      await page.waitForTimeout(650)
      const value = await field.inputValue()
      expect(value).toContain(sample.slice(0, 10))
      expect(value).not.toMatch(/weekend plans|forgot my password|lunch is at/i)
    }
    await page.close()
  })

  test('standup: URLs, emails, and SKUs stay intact', async () => {
    const page = await openSurfaces(context, origin)
    const field = page.locator('#standup')
    await field.click()
    await field.pressSequentially(PROTECTED_PROSE, { delay: 10 })
    await page.waitForTimeout(500)
    const value = await field.inputValue()
    expect(value).toContain('billing@northwind.test')
    expect(value).toContain('https://pay.northwind.test/invoices/992')
    expect(value).toContain('SKU-44108')
    await page.close()
  })

  test('paste of wrong-keyboard English does not auto-remap', async () => {
    const page = await openSurfaces(context, origin)
    const field = page.locator('#reply')
    await field.click()
    const blob = LAYOUT_EN_TYPED_ON_AR[0]!.typed
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text)
    }, blob)
    await field.focus()
    const paste = process.platform === 'darwin' ? 'Meta+v' : 'Control+v'
    await page.keyboard.press(paste)
    await page.waitForTimeout(800)
    expect(await field.inputValue()).toContain('صثثنثىي')
    expect(await field.inputValue()).not.toMatch(/weekend plans/i)
    await page.close()
  })

  test('contenteditable thread auto-remaps wrong-keyboard English', async () => {
    await seedPolicy(context, { helpStyle: 'auto' })
    const page = await openSurfaces(context, origin)
    const field = page.locator('#thread')
    await field.click()
    const sample = LAYOUT_EN_TYPED_ON_AR[1]!
    await page.keyboard.type(sample.typed, { delay: 18 })
    await expect.poll(async () => readLogicalText(page, '#thread'), { timeout: 7_000 }).toMatch(/my password/i)
    expect(await readLogicalText(page, '#thread')).not.toMatch(/helloحمثشسث|forgot my حشسسصخقي/)
    await page.close()
  })

  test('shortcuts_only blocks auto layout and auto typos', async () => {
    await seedPolicy(context, { helpStyle: 'shortcuts_only' })
    const page = await openSurfaces(context, origin)
    const field = page.locator('#reply')
    await field.click()
    await field.pressSequentially(LAYOUT_EN_TYPED_ON_AR[3]!.typed, { delay: 18 })
    await page.waitForTimeout(800)
    expect(await field.inputValue()).toContain('صاثقث')
    expect(await field.inputValue()).not.toMatch(/where is the airport/i)
    await field.fill('')
    await field.pressSequentially(ENGLISH_WRITING_ERRORS[4]!.typed, { delay: 12 })
    await page.waitForTimeout(600)
    expect(await field.inputValue()).toContain('didnt')
    await page.close()
    await seedPolicy(context, { helpStyle: 'auto' })
  })

  test('FIX_LAYOUT shortcut remaps a finished wrong-keyboard sentence', async () => {
    await seedPolicy(context, { helpStyle: 'shortcuts_only' })
    const page = await openSurfaces(context, origin)
    const field = page.locator('#draft')
    await field.click()
    await field.pressSequentially(LAYOUT_EN_TYPED_ON_AR[0]!.typed.trim(), { delay: 18 })
    await runCommand(context, 'FIX_LAYOUT')
    await expect.poll(async () => field.inputValue(), { timeout: 7_000 }).toMatch(LAYOUT_EN_TYPED_ON_AR[0]!.expected)
    await page.close()
    await seedPolicy(context, { helpStyle: 'auto' })
  })

  test('CORRECT shortcut fixes a writing error on the command path', async () => {
    await seedPolicy(context, { helpStyle: 'shortcuts_only' })
    const page = await openSurfaces(context, origin)
    const field = page.locator('#standup')
    await field.click()
    await field.pressSequentially(CHAT_ENGLISH_TYPOS.typed, { delay: 12 })
    await runCommand(context, 'CORRECT')
    await expect.poll(async () => field.inputValue(), { timeout: 8_000 }).toMatch(CHAT_ENGLISH_TYPOS.expected)
    await page.close()
    await seedPolicy(context, { helpStyle: 'auto' })
  })

  test('translation session converts office Arabic to English', async () => {
    await seedPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: true })
    const page = await openSurfaces(context, origin)
    const field = page.locator('#standup')
    await field.click()
    const sample = TRANSLATE_OFFICE_AR[0]!
    await field.pressSequentially(sample.source, { delay: 16 })
    await expect.poll(async () => field.inputValue(), { timeout: 14_000 }).toMatch(sample.expectEnglish)
    expect(await field.inputValue()).not.toMatch(/الرجاء إرسال الفاتورة/)
    await page.close()
    await seedPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test('TRANSLATE shortcut translates selected Arabic', async () => {
    await seedPolicy(context, { helpStyle: 'shortcuts_only', arabicToEnglishMode: true })
    const page = await openSurfaces(context, origin)
    const field = page.locator('#draft')
    await field.click()
    const sample = TRANSLATE_OFFICE_AR[1]!
    await field.pressSequentially(sample.source, { delay: 16 })
    await runCommand(context, 'TRANSLATE')
    await expect.poll(async () => field.inputValue(), { timeout: 14_000 }).toMatch(sample.expectEnglish)
    await page.close()
    await seedPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test('Speed Box opens on the ticket reply field', async () => {
    const page = await openSurfaces(context, origin)
    await page.locator('#reply').click()
    await runCommand(context, 'SPEED_BOX')
    await expect(page.locator('#flowlary-speed-box')).toBeVisible({ timeout: 4_000 })
    await page.close()
  })
})
