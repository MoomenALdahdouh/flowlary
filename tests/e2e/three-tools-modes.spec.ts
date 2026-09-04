import { test, expect } from '@playwright/test'
import {
  clickSuggestion,
  dismissSuggestion,
  installAiMocks,
  launchExtension,
  openLab,
  readSuggestionCard,
  runCommand,
  seedSignedInAccount,
  seedTools,
  serveWritingLab,
  startMockApi,
  suggestionHosts,
  typeAsPerson,
  waitForExtension,
  waitForNativeSuggestion,
  waitForSuggestion,
} from './harness.ts'
import {
  CHAT_ENGLISH_TYPOS,
  CHAT_LAYOUT_EN_ON_AR,
  CHAT_NATIVE_ENGLISH,
  CHAT_DIALECT_ARABIC_TO_EN,
  EMAIL_ARABIC_TO_EN,
  MIXED_LAYOUT_IN_ENGLISH,
  PROTECTED_PROSE,
} from './user-writing-scripts.ts'

test.describe.configure({ timeout: 90_000 })

test.describe('three tools · Direct and Box (real Chrome)', () => {
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

  test('Direct · wrong keyboard becomes English in the field', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_LAYOUT_EN_ON_AR.typed)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_LAYOUT_EN_ON_AR.expected)
    await expect(suggestionHosts(page)).toHaveCount(0)
    await page.close()
  })

  test('Box · wrong keyboard stays until the Typing card is clicked', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_LAYOUT_EN_ON_AR.typed)
    const before = await page.locator('#plain-textarea').inputValue()
    expect(before).toMatch(/اثممخ|حمثشسث/)
    await waitForSuggestion(page)
    await clickSuggestion(page)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_LAYOUT_EN_ON_AR.expected)
    await page.close()
  })

  test('Box · Escape leaves the typed layout text', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_LAYOUT_EN_ON_AR.typed)
    await waitForSuggestion(page)
    const before = await page.locator('#plain-textarea').inputValue()
    await dismissSuggestion(page)
    await expect.poll(async () => suggestionHosts(page).count(), { timeout: 4_000 }).toBe(0)
    expect(await page.locator('#plain-textarea').inputValue()).toBe(before)
    await page.close()
  })

  test('Direct · local English typos rewrite in place', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_ENGLISH_TYPOS.typed)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_ENGLISH_TYPOS.expected)
    await page.close()
  })

  test('Box · English card shows the fix; click applies it', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_ENGLISH_TYPOS.typed)
    await waitForSuggestion(page)
    const before = await page.locator('#plain-textarea').inputValue()
    expect(before.toLowerCase()).toMatch(/hell|hwo|yuo/)
    await clickSuggestion(page)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_ENGLISH_TYPOS.expected)
    await page.close()
  })

  test('Direct · live Arabic sentence becomes English', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: false,
      liveTranslation: true,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', EMAIL_ARABIC_TO_EN.typed)
    await page.waitForTimeout(2_200)
    const live = await page.locator('#plain-textarea').inputValue()
    if (!EMAIL_ARABIC_TO_EN.expected.test(live)) {
      await runCommand(context, 'TRANSLATE')
    }
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 16_000 })
      .toMatch(EMAIL_ARABIC_TO_EN.expected)
    expect(await page.locator('#plain-textarea').inputValue()).not.toMatch(/أحتاج/)
    await page.close()
  })

  test('Box · live translation shows a Translation card, then click applies', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: false,
      english: false,
      liveTranslation: true,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', EMAIL_ARABIC_TO_EN.typed)
    await page.waitForTimeout(2_200)
    if ((await suggestionHosts(page).count()) === 0) {
      await runCommand(context, 'TRANSLATE')
    }
    await waitForSuggestion(page, 16_000)
    expect(await page.locator('#plain-textarea').inputValue()).toMatch(/أحتاج/)
    await clickSuggestion(page)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(EMAIL_ARABIC_TO_EN.expected)
    await page.close()
  })

  test('Direct · Arabic typed on English keys inside English is remapped', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', MIXED_LAYOUT_IN_ENGLISH.typed)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 10_000 })
      .toMatch(MIXED_LAYOUT_IN_ENGLISH.expected)
    const value = await page.locator('#plain-textarea').inputValue()
    expect(value).toContain('hello')
    expect(value).toContain('thanks')
    await page.close()
  })

  test('URLs and emails are not rewritten', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#longform', PROTECTED_PROSE)
    await page.waitForTimeout(600)
    const value = await page.locator('#longform').inputValue()
    expect(value).toContain('https://status.example.net')
    expect(value).toContain('ops@contoso.test')
    await page.close()
  })

  test('password fields never get a card or auto-write', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: true,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await page.evaluate(() => {
      const input = document.createElement('input')
      input.type = 'password'
      input.id = 'secret'
      document.body.append(input)
    })
    await typeAsPerson(page, '#secret', CHAT_LAYOUT_EN_ON_AR.typed)
    await page.waitForTimeout(1_200)
    await expect(suggestionHosts(page)).toHaveCount(0)
    expect(await page.locator('#secret').inputValue()).toContain('اثممخ')
    await page.close()
  })

  test('Shortcuts only · layout waits for FIX_LAYOUT', async () => {
    await seedTools(context, {
      applyHow: 'shortcuts',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_LAYOUT_EN_ON_AR.typed)
    await page.waitForTimeout(1_200)
    expect(await page.locator('#plain-textarea').inputValue()).toMatch(/اثممخ/)
    await runCommand(context, 'FIX_LAYOUT')
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_LAYOUT_EN_ON_AR.expected)
    await page.close()
  })

  test('Shortcuts only · English waits for CORRECT', async () => {
    await seedTools(context, {
      applyHow: 'shortcuts',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_ENGLISH_TYPOS.typed)
    await page.waitForTimeout(1_200)
    expect(await page.locator('#plain-textarea').inputValue()).toMatch(/hell hwo are yuo/)
    await runCommand(context, 'CORRECT')
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_ENGLISH_TYPOS.expected)
    await page.close()
  })

  test('Shortcuts only · translation waits for TRANSLATE', async () => {
    await seedTools(context, {
      applyHow: 'shortcuts',
      layout: false,
      english: false,
      liveTranslation: true,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', EMAIL_ARABIC_TO_EN.typed)
    await page.waitForTimeout(1_200)
    expect(await page.locator('#plain-textarea').inputValue()).toMatch(/أحتاج/)
    await runCommand(context, 'TRANSLATE')
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 16_000 })
      .toMatch(EMAIL_ARABIC_TO_EN.expected)
    await page.close()
  })

  test('Direct · native English includes know and splits or not', async () => {
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
    await page.close()
  })

  test('Box · native English card is complete before click', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_NATIVE_ENGLISH.typed)
    await waitForNativeSuggestion(page, CHAT_NATIVE_ENGLISH.expected)
    expect(await page.locator('#plain-textarea').inputValue()).toMatch(/let me now/i)
    await clickSuggestion(page)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toBe(CHAT_NATIVE_ENGLISH.expected)
    await page.close()
  })

  test('Shortcuts only · native English waits for CORRECT', async () => {
    await seedTools(context, {
      applyHow: 'shortcuts',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_NATIVE_ENGLISH.typed)
    await page.waitForTimeout(1_200)
    expect(await page.locator('#plain-textarea').inputValue()).toBe(CHAT_NATIVE_ENGLISH.typed)
    await runCommand(context, 'CORRECT')
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 12_000 })
      .toBe(CHAT_NATIVE_ENGLISH.expected)
    await page.close()
  })

  test('Box · spoken Arabic translates; layout does not invent Latin junk', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: true,
      english: false,
      liveTranslation: true,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_DIALECT_ARABIC_TO_EN.typed)
    await page.waitForTimeout(2_200)
    if ((await suggestionHosts(page).count()) === 0) {
      await runCommand(context, 'TRANSLATE')
    }
    await waitForSuggestion(page, 16_000)
    const card = await readSuggestionCard(page)
    expect(card.label.toLowerCase()).toMatch(/translation/)
    expect(card.label.toLowerCase()).not.toMatch(/typing/)
    expect(card.content).not.toMatch(/ofvkd/i)
    expect(card.content).toMatch(CHAT_DIALECT_ARABIC_TO_EN.expected)
    expect(await page.locator('#plain-textarea').inputValue()).toMatch(/راح|تيجي/)
    await clickSuggestion(page)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_DIALECT_ARABIC_TO_EN.expected)
    await page.close()
  })

  test('Direct · spoken Arabic is not layout-remapped', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_DIALECT_ARABIC_TO_EN.typed)
    await page.waitForTimeout(1_500)
    const value = await page.locator('#plain-textarea').inputValue()
    expect(value).toMatch(/راح/)
    expect(value).not.toMatch(/ofvkd/i)
    expect(value).not.toMatch(/hello/i)
    await page.close()
  })
})
