import { test, expect } from '@playwright/test'
import {
  clickSuggestion,
  fieldText,
  installAiMocks,
  launchExtension,
  openLab,
  readSuggestionCard,
  runCommand,
  seedSignedInAccount,
  seedTools,
  serveWritingLab,
  startMockApi,
  typeAsPerson,
  waitForExtension,
  waitForNativeSuggestion,
} from './harness.ts'
import {
  CHAT_LET_ME_NOW,
  CHAT_NATIVE_ENGLISH,
  CHAT_RIGHT_NOW,
  MANUAL_TESTING_TYPOS,
} from './user-writing-scripts.ts'

test.describe.configure({ timeout: 90_000 })

test.describe('native English · real Chrome', () => {
  let context: Awaited<ReturnType<typeof launchExtension>>
  let origin = ''
  let server: Awaited<ReturnType<typeof serveWritingLab>>['server']
  let apiServer: Awaited<ReturnType<typeof startMockApi>>

  test.beforeAll(async () => {
    apiServer = await startMockApi()
    const lab = await serveWritingLab()
    server = lab.server
    origin = lab.origin
    context = await launchExtension()
    await waitForExtension(context)
    await seedSignedInAccount(context)
    installAiMocks(context)
  })

  test.afterAll(async () => {
    await context?.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    if (apiServer) {
      await new Promise<void>((resolve) => apiServer!.close(() => resolve()))
    }
  })

  test('Direct · textarea becomes native written English', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_NATIVE_ENGLISH.typed)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 12_000 })
      .toBe(CHAT_NATIVE_ENGLISH.expected)
    const value = await page.locator('#plain-textarea').inputValue()
    expect(value).not.toMatch(/\blet me now\b/i)
    expect(value).toMatch(/Let me know/)
    expect(value).toMatch(/or not\?/)
    await page.close()
  })

  test('Direct · let me now becomes Let me know.', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_LET_ME_NOW.typed)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 10_000 })
      .toBe(CHAT_LET_ME_NOW.expected)
    await page.close()
  })

  test('Direct · right now stays a time, not know', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_RIGHT_NOW.typed)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 10_000 })
      .toBe(CHAT_RIGHT_NOW.expected)
    expect(await page.locator('#plain-textarea').inputValue()).not.toMatch(/\bknow\b/i)
    await page.close()
  })

  test('Box · card text, teach legend, then click writes the field', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_NATIVE_ENGLISH.typed)
    await waitForNativeSuggestion(page, CHAT_NATIVE_ENGLISH.expected)
    const card = await readSuggestionCard(page)
    expect(card.label.toLowerCase()).toMatch(/english/)
    expect(card.content).toBe(CHAT_NATIVE_ENGLISH.expected)
    expect(card.content).not.toMatch(/let me now/i)
    expect(card.legend.toLowerCase()).toMatch(/spelling/)
    expect(card.legend.toLowerCase()).toMatch(/grammar/)
    expect(await page.locator('#plain-textarea').inputValue()).toBe(CHAT_NATIVE_ENGLISH.typed)
    await clickSuggestion(page)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toBe(CHAT_NATIVE_ENGLISH.expected)
    await page.close()
  })

  test('Box · input field click-to-accept', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-input', CHAT_LET_ME_NOW.typed)
    await waitForNativeSuggestion(page, CHAT_LET_ME_NOW.expected)
    await clickSuggestion(page)
    await expect
      .poll(async () => page.locator('#plain-input').inputValue(), { timeout: 8_000 })
      .toBe(CHAT_LET_ME_NOW.expected)
    await page.close()
  })

  test('Box · contenteditable click-to-accept', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#ce', CHAT_NATIVE_ENGLISH.typed)
    await waitForNativeSuggestion(page, CHAT_NATIVE_ENGLISH.expected)
    expect(await fieldText(page, '#ce')).toMatch(/let me now/i)
    await clickSuggestion(page)
    await expect.poll(async () => fieldText(page, '#ce'), { timeout: 8_000 }).toBe(CHAT_NATIVE_ENGLISH.expected)
    await page.close()
  })

  test('Shortcuts · CORRECT on longform textarea', async () => {
    await seedTools(context, {
      applyHow: 'shortcuts',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#longform', CHAT_NATIVE_ENGLISH.typed)
    await page.waitForTimeout(1_000)
    expect(await page.locator('#longform').inputValue()).toBe(CHAT_NATIVE_ENGLISH.typed)
    await runCommand(context, 'CORRECT')
    await expect
      .poll(async () => page.locator('#longform').inputValue(), { timeout: 12_000 })
      .toBe(CHAT_NATIVE_ENGLISH.expected)
    await page.close()
  })

  test('Box · dropped-letter spellings become real English', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', MANUAL_TESTING_TYPOS.typed)
    await waitForNativeSuggestion(page, MANUAL_TESTING_TYPOS.expected)
    const card = await readSuggestionCard(page)
    expect(card.content).toBe(MANUAL_TESTING_TYPOS.expected)
    expect(card.content).not.toMatch(/\b(manul|testng|setp|guid)\b/i)
    expect(card.legend.toLowerCase()).toMatch(/spelling/)
    await clickSuggestion(page)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toBe(MANUAL_TESTING_TYPOS.expected)
    await page.close()
  })
})
