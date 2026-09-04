import { test, expect } from '@playwright/test'
import {
  dismissSuggestion,
  fieldText,
  installAiMocks,
  launchExtension,
  openLab,
  runCommand,
  seedSignedInAccount,
  seedTools,
  serveWritingLab,
  startMockApi,
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

test.describe('realistic host editors · local fixtures', () => {
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

  test('textarea / input / simple CE receive typing without steal or duplicate', async () => {
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
    await page.keyboard.type(typed, { delay: 18 })
    await page.waitForTimeout(900)
    expect(await page.locator('#plain-textarea').inputValue()).toBe(typed)
    expect(await page.locator('#plain-input').inputValue()).toBe(typed)
    expect(await fieldText(page, '#ce')).toContain('See you right now')
    await page.close()
  })

  test('React-like controlled input keeps user typing and accepts Direct layout', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#react-controlled', CHAT_LAYOUT_EN_ON_AR.typed)
    await expect
      .poll(async () => page.locator('#react-controlled').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_LAYOUT_EN_ON_AR.expected)
    await page.close()
  })

  test('nested and ProseMirror-like composers do not auto-write layout', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await page.locator('#ce-rich').click()
    await page.keyboard.type(CHAT_LAYOUT_EN_ON_AR.typed, { delay: 20 })
    await page.locator('#pm').click()
    await page.keyboard.type(CHAT_LAYOUT_EN_ON_AR.typed, { delay: 20 })
    await page.waitForTimeout(1_200)
    expect(await fieldText(page, '#ce-rich')).toMatch(/اثممخ/)
    expect(await fieldText(page, '#pm')).toMatch(/اثممخ/)
    await page.close()
  })

  test('same-origin iframe textarea can receive Direct layout', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    const frame = page.frameLocator('#compose-frame')
    await frame.locator('#frame-textarea').waitFor()
    await frame.locator('#frame-textarea').click()
    await frame.locator('#frame-textarea').pressSequentially(CHAT_LAYOUT_EN_ON_AR.typed, { delay: 22 })
    await expect
      .poll(async () => frame.locator('#frame-textarea').inputValue(), { timeout: 8_000 })
      .toMatch(CHAT_LAYOUT_EN_ON_AR.expected)
    await page.close()
  })

  test('replacing the editor discards in-flight work on the old node', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#dynamic-editor', CHAT_LAYOUT_EN_ON_AR.typed)
    await page.waitForTimeout(200)
    await page.locator('#replace-editor').click()
    await page.waitForTimeout(2_000)
    const next = page.locator('#dynamic-editor')
    expect(await next.inputValue()).toBe('')
    await typeAsPerson(page, '#dynamic-editor', 'keep ')
    expect(await next.inputValue()).toBe('keep ')
    await page.close()
  })

  test('selected layout span is the only range FIX_LAYOUT rewrites', async () => {
    await seedTools(context, {
      applyHow: 'shortcuts',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    const field = page.locator('#plain-textarea')
    const prefix = 'KEEP_A '
    const suffix = ' KEEP_B'
    await typeAsPerson(page, '#plain-textarea', `${prefix}${CHAT_LAYOUT_EN_ON_AR.typed.trim()}${suffix}`)
    const start = prefix.length
    const end = start + CHAT_LAYOUT_EN_ON_AR.typed.trim().length
    await field.click()
    await field.evaluate(
      (el, range) => {
        const box = el as HTMLTextAreaElement
        box.focus()
        box.setSelectionRange(range.start, range.end)
      },
      { start, end },
    )
    await runCommand(context, 'FIX_LAYOUT')
    await page.waitForTimeout(800)
    const value = await field.inputValue()
    expect(value).toContain('KEEP_A')
    expect(value).toContain('KEEP_B')
    if (/hello please/i.test(value)) {
      expect(value).not.toMatch(/اثممخ/)
    }
    await page.close()
  })

  test('stale selection cannot authorize a later Direct write of old text', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: false,
      liveTranslation: true,
    })
    await context.unroute('**/api/ai/translation')
    await context.route('**/api/ai/translation', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_400))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          translation: 'STALE_RANGE_MUST_NOT_WRITE',
          provider: 'google',
          strategy: 'google',
        }),
      })
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', 'أحتاج التقرير. ')
    await page.waitForTimeout(180)
    await typeAsPerson(page, '#plain-textarea', 'NEWER_RANGE ')
    await page.waitForTimeout(3_000)
    const value = await page.locator('#plain-textarea').inputValue()
    expect(value).toContain('NEWER_RANGE')
    expect(value).not.toBe('STALE_RANGE_MUST_NOT_WRITE')
    await context.unroute('**/api/ai/translation')
    installAiMocks(context)
    await page.close()
  })

  test('Box on textarea: Escape leaves typed text', async () => {
    await seedTools(context, {
      applyHow: 'box',
      layout: true,
      english: false,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await typeAsPerson(page, '#plain-textarea', CHAT_LAYOUT_EN_ON_AR.typed)
    await waitForSuggestion(page)
    await dismissSuggestion(page)
    await page.waitForTimeout(300)
    expect(await page.locator('#plain-textarea').inputValue()).toMatch(/اثممخ/)
    await page.close()
  })

  test('English Direct on simple CE; Arabic live translation is not per-character', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    await page.locator('#ce').click()
    await page.keyboard.type(CHAT_ENGLISH_TYPOS.typed, { delay: 20 })
    await expect
      .poll(async () => fieldText(page, '#ce'), { timeout: 8_000 })
      .toMatch(CHAT_ENGLISH_TYPOS.expected)
    await page.close()

    await seedTools(context, {
      applyHow: 'direct',
      layout: false,
      english: false,
      liveTranslation: true,
    })
    const page2 = await openLab(context, origin)
    await typeAsPerson(page2, '#plain-textarea', 'أح')
    await page2.waitForTimeout(350)
    expect(await page2.locator('#plain-textarea').inputValue()).toBe('أح')
    await typeAsPerson(page2, '#plain-textarea', EMAIL_ARABIC_TO_EN.typed.slice(2))
    await expect
      .poll(async () => page2.locator('#plain-textarea').inputValue(), { timeout: 16_000 })
      .toMatch(EMAIL_ARABIC_TO_EN.expected)
    await page2.close()
  })

  test('long session does not duplicate text or pile up boxes', async () => {
    await seedTools(context, {
      applyHow: 'direct',
      layout: true,
      english: true,
      liveTranslation: false,
    })
    const page = await openLab(context, origin)
    const line = 'See you right now. '
    const field = page.locator('#plain-textarea')
    await field.click()
    for (let i = 0; i < 12; i += 1) {
      await field.pressSequentially(line, { delay: 8 })
    }
    await page.waitForTimeout(1_000)
    const value = await field.inputValue()
    expect(value).toBe(line.repeat(12))
    const readyCards = await page.evaluate(() => {
      const hosts = [...document.querySelectorAll('[data-flowlary-suggestion-host]')]
      return hosts.filter((host) => {
        const card = (host as HTMLElement).shadowRoot?.querySelector('.card')
        return card && !card.hasAttribute('hidden') && card.classList.contains('ready')
      }).length
    })
    expect(readyCards).toBe(0)
    await page.close()
  })
})
