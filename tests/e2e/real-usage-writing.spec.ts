import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  LAYOUT_AR_ON_EN,
  LAYOUT_EN_ON_AR,
  LOCAL_ENGLISH_TYPOS,
  MIXED_PRESERVE,
  PROTECTED_IN_PROSE,
  TRANSLATE_ARABIC,
} from './real-usage-examples.ts'
import { CHAT_ENGLISH_TYPOS } from './user-writing-scripts.ts'
import { installAiMocks, seedSignedInAccount, startMockApi } from './harness.ts'

const here = path.resolve(process.cwd(), 'tests/e2e')
const extensionPath = path.resolve(process.cwd(), 'extension/dist')
const fixtureUrl = pathToFileURL(path.join(here, 'fixtures/real-surfaces.html')).href

async function launchExtension(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-real-e2e-'))
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

async function seedWritingPolicy(
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
    const settings = {
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
    }
    const firstWin = { completed: true, localSuccess: true, aiSuccess: false, _v: 1 }
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
      'flowlary.settings': settings,
      'flowlary.ui.firstWin': firstWin,
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

async function readLogicalText(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let out = ''
    let node: Node | null
    while ((node = walker.nextNode())) out += node.data
    return out.replace(/\u00a0/g, ' ')
  })
}

async function openSurfaces(context: BrowserContext): Promise<Page> {
  const page = await context.newPage()
  await page.goto(fixtureUrl)
  await page.waitForSelector('#chat')
  await page.waitForTimeout(600)
  return page
}

async function dispatchOnActiveTab(
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

test.describe('real everyday writing (new corpus)', () => {
  let context: BrowserContext
  let apiServer: Awaited<ReturnType<typeof startMockApi>>

  test.beforeAll(async () => {
    apiServer = await startMockApi()
    context = await launchExtension()
    await waitForExtension(context)
    await seedSignedInAccount(context)
    installAiMocks(context)
    await seedWritingPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test.afterAll(async () => {
    await context?.close()
    if (apiServer) {
      await new Promise<void>((resolve) => apiServer!.close(() => resolve()))
    }
  })

  test('chat: English typed on Arabic keyboard remaps thanks / later / morning', async () => {
    const page = await openSurfaces(context)
    const field = page.locator('#chat')
    await field.click()
    const sample = LAYOUT_EN_ON_AR[0]!
    await field.pressSequentially(sample.typed, { delay: 22 })
    await expect.poll(async () => field.inputValue(), { timeout: 6_000 }).toMatch(sample.expected)
    await page.close()
  })

  test('rich composer: contenteditable remaps English typed on Arabic keyboard', async () => {
    const page = await openSurfaces(context)
    const field = page.locator('#composer')
    await field.click()
    await page.keyboard.type(LAYOUT_EN_ON_AR[0]!.typed, { delay: 22 })
    await expect.poll(async () => readLogicalText(page, '#composer'), { timeout: 6_000 })
      .toMatch(LAYOUT_EN_ON_AR[0]!.expected)
    await page.close()
  })

  test('subject: longer English-on-Arabic sequences remap', async () => {
    const page = await openSurfaces(context)
    const field = page.locator('#subject')
    await field.click()
    const sample = LAYOUT_EN_ON_AR[4]!
    await field.pressSequentially(sample.typed, { delay: 22 })
    await expect.poll(async () => field.inputValue(), { timeout: 6_000 }).toMatch(sample.expected)
    await page.close()
  })

  test('email: Arabic typed on English keyboard remaps everyday phrases', async () => {
    const page = await openSurfaces(context)
    const field = page.locator('#email')
    await field.click()
    const sample = LAYOUT_AR_ON_EN[0]!
    await field.pressSequentially(sample.typed, { delay: 22 })
    await expect.poll(async () => field.inputValue(), { timeout: 6_000 }).toMatch(sample.expected)
    await page.close()
  })

  test('comment: local English writing errors auto-fix after space', async () => {
    const page = await openSurfaces(context)
    const field = page.locator('#comment')
    await field.click()
    for (const sample of LOCAL_ENGLISH_TYPOS) {
      await field.fill('')
      await field.pressSequentially(sample.typed, { delay: 16 })
      await expect.poll(async () => field.inputValue(), { timeout: 5_000 }).toMatch(sample.expected)
    }
    await page.close()
  })

  test('notes: intentional mixed bilingual is not remapped into garbage', async () => {
    const page = await openSurfaces(context)
    const field = page.locator('#notes')
    await field.click()
    for (const sample of MIXED_PRESERVE) {
      await field.fill('')
      await field.pressSequentially(`${sample} `, { delay: 12 })
      await page.waitForTimeout(700)
      const value = await field.inputValue()
      expect(value).toContain(sample.slice(0, 8))
      expect(value).not.toMatch(/فاشىنس|سثث غخع|لخخي ةخ/)
    }
    await page.close()
  })

  test('search: protected tokens in prose stay intact', async () => {
    const page = await openSurfaces(context)
    const field = page.locator('#notes')
    await field.click()
    await field.pressSequentially(PROTECTED_IN_PROSE, { delay: 10 })
    await page.waitForTimeout(500)
    const value = await field.inputValue()
    expect(value).toContain('https://status.example.net')
    expect(value).toContain('ops@contoso.test')
    expect(value).toContain('ORDER-88421')
    await page.close()
  })

  test('paste of wrong-keyboard English does not auto-remap', async () => {
    const page = await openSurfaces(context)
    const field = page.locator('#chat')
    await field.click()
    const blob = LAYOUT_EN_ON_AR[0]!.typed
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text)
    }, blob)
    await field.focus()
    const paste = process.platform === 'darwin' ? 'Meta+v' : 'Control+v'
    await page.keyboard.press(paste)
    await page.waitForTimeout(800)
    expect(await field.inputValue()).toContain('فاشىنس')
    expect(await field.inputValue()).not.toMatch(/thanks so much/i)
    await page.close()
  })

  test('shortcuts_only never auto-remaps layout or typos', async () => {
    await seedWritingPolicy(context, { helpStyle: 'shortcuts_only' })
    const page = await openSurfaces(context)
    const field = page.locator('#chat')
    await field.click()
    await field.pressSequentially(LAYOUT_EN_ON_AR[1]!.typed, { delay: 20 })
    await page.waitForTimeout(900)
    expect(await field.inputValue()).toContain('سثث')
    expect(await field.inputValue()).not.toMatch(/see you later/i)
    await field.fill('')
    await field.pressSequentially(LOCAL_ENGLISH_TYPOS[0]!.typed, { delay: 14 })
    await page.waitForTimeout(700)
    expect(await field.inputValue()).toContain('recieve')
    await page.close()
    await seedWritingPolicy(context, { helpStyle: 'auto' })
  })

  test('FIX_LAYOUT shortcut remaps a completed wrong-keyboard sentence', async () => {
    await seedWritingPolicy(context, { helpStyle: 'shortcuts_only' })
    const page = await openSurfaces(context)
    const field = page.locator('#email')
    await field.click()
    await field.pressSequentially(LAYOUT_EN_ON_AR[2]!.typed.trim(), { delay: 20 })
    await dispatchOnActiveTab(context, 'FIX_LAYOUT')
    await expect.poll(async () => field.inputValue(), { timeout: 6_000 }).toMatch(LAYOUT_EN_ON_AR[2]!.expected)
    await page.close()
    await seedWritingPolicy(context, { helpStyle: 'auto' })
  })

  test('CORRECT shortcut applies a local writing error via the command path', async () => {
    await seedWritingPolicy(context, { helpStyle: 'shortcuts_only' })
    const page = await openSurfaces(context)
    const field = page.locator('#comment')
    await field.click()
    await field.pressSequentially(CHAT_ENGLISH_TYPOS.typed, { delay: 14 })
    await dispatchOnActiveTab(context, 'CORRECT')
    await expect.poll(async () => field.inputValue(), { timeout: 8_000 }).toMatch(CHAT_ENGLISH_TYPOS.expected)
    await page.close()
    await seedWritingPolicy(context, { helpStyle: 'auto' })
  })

  test('translation session turns Arabic office prose into English', async () => {
    await seedWritingPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: true })
    const page = await openSurfaces(context)
    const field = page.locator('#notes')
    await field.click()
    const sample = TRANSLATE_ARABIC[0]!
    await field.pressSequentially(sample.source, { delay: 18 })
    await expect
      .poll(async () => field.inputValue(), { timeout: 12_000 })
      .toMatch(sample.expectEnglish)
    const value = await field.inputValue()
    expect(value).not.toMatch(/أحتاج التقرير/)
    await page.close()
    await seedWritingPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test('TRANSLATE shortcut translates a selected Arabic sentence', async () => {
    await seedWritingPolicy(context, { helpStyle: 'shortcuts_only', arabicToEnglishMode: true })
    const page = await openSurfaces(context)
    const field = page.locator('#email')
    await field.click()
    const sample = TRANSLATE_ARABIC[1]!
    await field.pressSequentially(sample.source.trim(), { delay: 16 })
    await field.press('Meta+a')
    await dispatchOnActiveTab(context, 'TRANSLATE')
    await expect
      .poll(async () => field.inputValue(), { timeout: 12_000 })
      .toMatch(sample.expectEnglish)
    await page.close()
    await seedWritingPolicy(context, { helpStyle: 'auto', arabicToEnglishMode: false })
  })

  test('Speed Box opens from the command path on a real compose field', async () => {
    const page = await openSurfaces(context)
    await page.locator('#chat').click()
    await dispatchOnActiveTab(context, 'SPEED_BOX')
    await expect(page.locator('#flowlary-speed-box')).toBeVisible({ timeout: 4_000 })
    await page.close()
  })
})
