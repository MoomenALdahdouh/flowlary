import { test, expect } from '@playwright/test'
import {
  clickSuggestion,
  fieldText,
  installAiMocks,
  launchExtension,
  openLab,
  seedSignedInAccount,
  seedTools,
  serveWritingLab,
  startMockApi,
  suggestionHosts,
  typeAsPerson,
  waitForExtension,
  waitForSuggestion,
} from './harness.ts'
import {
  CHAT_ENGLISH_TYPOS,
  CHAT_LAYOUT_EN_ON_AR,
  EMAIL_ARABIC_TO_EN,
} from './user-writing-scripts.ts'

test.describe.configure({ timeout: 90_000 })

test.describe('runtime kernel · real Chrome', () => {
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

  test('normal English typing is not stolen or duplicated', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    const typed = 'See you right now. '
    await typeAsPerson(page, '#plain-textarea', typed)
    await typeAsPerson(page, '#plain-input', typed)
    await page.locator('#ce').click()
    await page.keyboard.type(typed, { delay: 22 })
    await page.waitForTimeout(900)
    expect(await page.locator('#plain-textarea').inputValue()).toBe(typed)
    expect(await page.locator('#plain-input').inputValue()).toBe(typed)
    expect(await fieldText(page, '#ce')).toContain('See you right now')
    await page.close()
  })

  test('live translation does not run on every Arabic character', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: false,
      liveTranslation: true,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', 'أح')
    await page.waitForTimeout(400)
    expect(await page.locator('#plain-textarea').inputValue()).toBe('أح')
    await typeAsPerson(page, '#plain-textarea', EMAIL_ARABIC_TO_EN.typed.slice(2))
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 16_000 })
      .toMatch(EMAIL_ARABIC_TO_EN.expected)
    await page.close()
  })

  test('late translation HTTP cannot overwrite newer typing', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: false,
      liveTranslation: true,
    })
    await context.unroute('**/api/ai/translation')
    await context.route('**/api/ai/translation', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_800))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          translation: 'STALE_TRANSLATION_SHOULD_NOT_COMMIT',
          provider: 'google',
          strategy: 'google',
        }),
      })
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', 'أحتاج التقرير. ')
    await page.waitForTimeout(200)
    await typeAsPerson(page, '#plain-textarea', 'NEWER_USER_TEXT ')
    await page.waitForTimeout(3_400)
    const value = await page.locator('#plain-textarea').inputValue()
    expect(value).toContain('NEWER_USER_TEXT')
    expect(value).not.toBe('STALE_TRANSLATION_SHOULD_NOT_COMMIT')
    expect(value).not.toMatch(/^STALE_TRANSLATION_SHOULD_NOT_COMMIT/)
    await context.unroute('**/api/ai/translation')
    installAiMocks(context)
    await page.close()
  })

  test('stale Box cannot apply after the snapshot changes', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_LAYOUT_EN_ON_AR.typed)
    await waitForSuggestion(page)
    await typeAsPerson(page, '#plain-textarea', 'keep اثممخ extra')
    await page.waitForTimeout(400)
    const beforeClick = await page.locator('#plain-textarea').inputValue()
    expect(beforeClick).toContain('keep')
    expect(beforeClick).toContain('اثممخ')
    try {
      await clickSuggestion(page)
    } catch {
      /* card may already be hidden */
    }
    await page.waitForTimeout(600)
    const after = await page.locator('#plain-textarea').inputValue()
    expect(after).toContain('keep')
    expect(after).toContain('extra')
    expect(after).not.toMatch(/^hello pleasekeep/i)
    await page.close()
  })

  test('composition events do not rewrite the field mid-IME', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: true,
      liveTranslation: true,
    })
    const page = await openLab(context, origin)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
      el.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: 'ね' }))
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: 'ね', inputType: 'insertCompositionText' }))
    })
    await page.waitForTimeout(500)
    await expect(suggestionHosts(page)).toHaveCount(0)
    await field.evaluate((el) => {
      const box = el as HTMLTextAreaElement
      box.value = 'ね'
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'ね' }))
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: false, data: 'ね', inputType: 'insertCompositionText' }))
    })
    await page.waitForTimeout(900)
    expect(await field.inputValue()).toBe('ね')
    await page.close()
  })

  test('Layout Direct wins over English on wrong-keyboard text', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_LAYOUT_EN_ON_AR.typed)
    await expect
      .poll(async () => page.locator('#plain-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_LAYOUT_EN_ON_AR.expected)
    const value = await page.locator('#plain-textarea').inputValue()
    expect(value).not.toMatch(/اثممخ/)
    await page.close()
  })

  test('English Direct still works when translation is off', async () => {
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
    await page.locator('#plain-textarea').press('Meta+z')
    await typeAsPerson(page, '#plain-textarea', ' more')
    expect(await page.locator('#plain-textarea').inputValue()).toContain('more')
    await page.close()
  })
})
