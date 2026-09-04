import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const here = path.resolve(process.cwd(), 'tests/e2e')
const extensionPath = path.resolve(process.cwd(), 'extension/dist')
const fixtureUrl = pathToFileURL(path.join(here, 'fixtures/writing-lab.html')).href

const LAYOUT_TYPED = 'اثممخ حمثشسث '
const LAYOUT_EXPECTED = /hello please/i
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'

async function launchExtension(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlary-e2e-'))
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

async function waitForExtension(context: BrowserContext): Promise<void> {
  const existing = context.serviceWorkers()
  if (existing.length > 0) return
  await context.waitForEvent('serviceworker', { timeout: 15_000 })
}

async function openLab(context: BrowserContext): Promise<Page> {
  const page = await context.newPage()
  await page.goto(fixtureUrl)
  await page.waitForSelector('#plain-textarea')
  await page.waitForTimeout(750)
  return page
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

async function keystrokeLatency(page: Page, selector: string, text: string): Promise<number[]> {
  const samples: number[] = []
  const locator = page.locator(selector)
  await locator.click()
  for (const char of text) {
    const started = Date.now()
    await locator.pressSequentially(char, { delay: 0 })
    samples.push(Date.now() - started)
  }
  return samples
}


test.describe('real Chrome extension writing', () => {
  let context: BrowserContext
  let siteServer: http.Server | undefined
  let siteOrigin = ''

  test.beforeAll(async () => {
    const labHtml = fs.readFileSync(path.join(here, 'fixtures/writing-lab.html'))
    siteServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(labHtml)
    })
    await new Promise<void>((resolve) => {
      siteServer!.listen(0, '127.0.0.1', () => resolve())
    })
    const address = siteServer.address()
    if (address && typeof address === 'object') {
      siteOrigin = `http://127.0.0.1:${address.port}`
    }
    context = await launchExtension()
    await waitForExtension(context)
  })

  test.afterAll(async () => {
    await context?.close()
    await new Promise<void>((resolve, reject) => {
      if (!siteServer) {
        resolve()
        return
      }
      siteServer.close((error) => (error ? reject(error) : resolve()))
    })
  })

  test('loads the built extension service worker', async () => {
    expect(context.serviceWorkers().length).toBeGreaterThan(0)
  })

  test('textarea: obvious layout mismatch can auto-correct', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially(LAYOUT_TYPED, { delay: 25 })
    await expect.poll(async () => field.inputValue(), { timeout: 4_000 }).toMatch(LAYOUT_EXPECTED)
    const cursor = await field.evaluate((el) => (el as HTMLTextAreaElement).selectionStart)
    expect(cursor).toBeGreaterThan(0)
    await page.close()
  })

  test('input: typing remains possible and layout can auto-correct', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-input')
    await field.click()
    await field.pressSequentially(LAYOUT_TYPED, { delay: 25 })
    await expect.poll(async () => field.inputValue(), { timeout: 4_000 }).toMatch(LAYOUT_EXPECTED)
    await page.close()
  })

  test('contenteditable: incremental second word does not glue onto the first', async () => {
    const page = await openLab(context)
    const field = page.locator('#ce')
    await field.click()
    await page.keyboard.type('اثممخ ', { delay: 25 })
    await expect.poll(async () => readLogicalText(page, '#ce'), { timeout: 4_000 }).toMatch(/^hello\s/)
    await page.keyboard.type('حمثشسث ', { delay: 25 })
    await expect.poll(async () => readLogicalText(page, '#ce'), { timeout: 4_000 }).toMatch(/hello please/i)
    expect(await readLogicalText(page, '#ce')).not.toMatch(/helloحمثشسث/)
    await page.close()
  })

  test('protected tokens stay intact', async () => {
    const page = await openLab(context)
    const field = page.locator('#longform')
    const samples = [
      `Please visit https://flowlary.com/docs today. `,
      `Email user@example.com for details. `,
      `Use ${JWT} as a token. `,
      `Key sk-abcdefghijklmnopqrstuvwxyz123456 stays. `,
    ]
    await field.click()
    for (const sample of samples) {
      await field.pressSequentially(sample, { delay: 8 })
      await page.waitForTimeout(400)
    }
    const value = await field.inputValue()
    expect(value).toContain('https://flowlary.com/docs')
    expect(value).toContain('user@example.com')
    expect(value).toContain(JWT)
    expect(value).toContain('sk-abcdefghijklmnopqrstuvwxyz123456')
    await page.close()
  })

  test('bilingual wrong-keyboard spans repair in one field', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    const typed = 'مرحبا hello how are you are you ؤخةةهىل خق ىخف نعم hkh rh]l hghk '
    await field.click()
    await field.pressSequentially(typed, { delay: 20 })
    await field.press('Space')
    await expect.poll(async () => field.inputValue(), { timeout: 8_000 }).toContain('comming or not')
    await expect.poll(async () => field.inputValue(), { timeout: 8_000 }).toContain('انا قادم الان')
    const value = await field.inputValue()
    expect(value).toContain('مرحبا')
    expect(value).toContain('hello')
    expect(value).toContain('نعم')
    expect(value).not.toContain('ؤخةةهىل')
    expect(value).not.toMatch(/\bhkh\b/)
    await page.close()
  })

  test('English on Arabic keyboard inside Arabic repairs', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially('مرحبا اثممخ حمثشسث نعم ', { delay: 20 })
    await field.press('Space')
    await expect.poll(async () => field.inputValue(), { timeout: 8_000 }).toMatch(/hello\s+please/i)
    expect(await field.inputValue()).toContain('مرحبا')
    expect(await field.inputValue()).toContain('نعم')
    await page.close()
  })

  test('Arabic on English keyboard inside English repairs', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially('hello hkh rh]l hghk thanks ', { delay: 20 })
    await field.press('Space')
    await expect.poll(async () => field.inputValue(), { timeout: 8_000 }).toContain('انا قادم الان')
    expect(await field.inputValue()).toContain('hello')
    expect(await field.inputValue()).toContain('thanks')
    await page.close()
  })

  test('mixed Arabic/English technical text is not layout-destroyed', async () => {
    const page = await openLab(context)
    const field = page.locator('#mixed')
    const text = 'أرسل لي الـ API key اليوم. راجع https://example.com و user@example.com '
    await field.click()
    await field.pressSequentially(text, { delay: 12 })
    await page.waitForTimeout(800)
    const value = await field.inputValue()
    expect(value).toContain('API')
    expect(value).toContain('https://example.com')
    expect(value).toContain('user@example.com')
    expect(value).toContain('أرسل')
    await page.close()
  })

  test('rapid typing, space, enter, tab, paste, selection, and cursor stay usable', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    const latencies = await keystrokeLatency(page, '#plain-textarea', 'hello ')
    const p95 = [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95) - 1] ?? 0
    expect(p95).toBeLessThan(250)

    await field.press('Enter')
    await field.pressSequentially('second line', { delay: 10 })
    await field.press('Tab')
    await field.fill('')
    await field.pressSequentially('select this word', { delay: 10 })
    await field.press('Shift+ArrowLeft')
    await field.press('Shift+ArrowLeft')
    await field.press('Shift+ArrowLeft')
    await field.press('Backspace')
    await field.press('Meta+a')
    await page.evaluate(async () => {
      const el = document.querySelector('#plain-textarea') as HTMLTextAreaElement
      el.focus()
      el.value = ''
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: '', inputType: 'insertFromPaste' }))
    })
    await field.pressSequentially('pasted English text stays ', { delay: 8 })
    await page.waitForTimeout(400)
    const value = await field.inputValue()
    expect(value.toLowerCase()).toContain('pasted english text stays')
    await page.close()
  })

  test('pause after a completed English sentence still preserves the typed words', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially('hello there friend. ', { delay: 12 })
    await page.waitForTimeout(1_200)
    expect(await field.inputValue()).toMatch(/hello there friend/i)
    await page.close()
  })

  test('undo after layout auto-write still leaves the field usable', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially(LAYOUT_TYPED, { delay: 25 })
    await expect.poll(async () => field.inputValue(), { timeout: 4_000 }).toMatch(LAYOUT_EXPECTED)
    await field.press('Meta+z')
    await field.pressSequentially(' more', { delay: 10 })
    expect(await field.inputValue()).toContain('more')
    await page.close()
  })

  test('a longer session keeps typing responsive across several sentences', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    const sentences = [
      'First sentence stays here. ',
      'Second sentence follows along. ',
      'Third sentence closes the session. ',
    ]
    for (const sentence of sentences) {
      await field.pressSequentially(sentence, { delay: 8 })
      await page.waitForTimeout(200)
    }
    const value = await field.inputValue()
    expect(value).toContain('First sentence')
    expect(value).toContain('Third sentence')
    await page.close()
  })

  test('stale typing after a correction does not lock the field', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially(LAYOUT_TYPED, { delay: 20 })
    await page.waitForTimeout(400)
    await field.pressSequentially(' extra words after correction', { delay: 8 })
    await page.waitForTimeout(600)
    const value = await field.inputValue()
    expect(value).toContain('extra words after correction')
    await page.close()
  })

  test('offline mode still allows typing', async () => {
    const page = await openLab(context)
    await context.setOffline(true)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially('offline typing still works ', { delay: 10 })
    expect(await field.inputValue()).toContain('offline typing still works')
    await context.setOffline(false)
    await page.close()
  })

  test('page reload keeps the extension active', async () => {
    const page = await openLab(context)
    await page.reload()
    await page.waitForSelector('#plain-textarea')
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially('reload still types ', { delay: 10 })
    expect(await field.inputValue()).toContain('reload still types')
    await page.close()
  })

  test('shows a correction cue and keeps typing independent of network', async () => {
    const page = await openLab(context)
    await context.setOffline(true)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially(LAYOUT_TYPED, { delay: 25 })
    await expect.poll(async () => field.inputValue(), { timeout: 4_000 }).toMatch(LAYOUT_EXPECTED)
    await expect(page.locator('.fl-correction-flash')).toHaveCount(1)
    await field.pressSequentially('https://flowlary.com user@example.com ', { delay: 8 })
    const value = await field.inputValue()
    expect(value).toContain('https://flowlary.com')
    expect(value).toContain('user@example.com')
    await context.setOffline(false)
    await page.close()
  })

  test('intended mixed Arabic+English is not layout-destroyed while typing', async () => {
    const page = await openLab(context)
    const field = page.locator('#mixed')
    const intended = 'مرحبا hello are you comming or not نعم انا فادم الان '
    await field.click()
    await field.pressSequentially(intended, { delay: 12 })
    await page.waitForTimeout(900)
    const value = await field.inputValue()
    expect(value).toContain('مرحبا')
    expect(value).toContain('hello')
    expect(value).toContain('comming')
    expect(value).toContain('نعم')
    expect(value).toContain('فادم')
    expect(value).not.toContain('ؤخةةهىل')
    expect(value).not.toMatch(/\bhkh\b/)
    await page.close()
  })

  test('unfinished wrong-keyboard word is not rewritten before Space', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially('ؤخةةهىل', { delay: 20 })
    await page.waitForTimeout(400)
    expect(await field.inputValue()).toBe('ؤخةةهىل')
    await field.pressSequentially(' ', { delay: 20 })
    await page.waitForTimeout(1_200)
    // Isolated token after Space still must not fight the user. Sequence evidence
    // (mixed/bilingual sentences) can remap this glyph; a lone word must not.
    expect(await field.inputValue()).toMatch(/ؤخةةهىل/)
    await page.close()
  })

  test('popup exposes site and AI controls after first run', async () => {
    const worker = context.serviceWorkers()[0]
    expect(worker).toBeTruthy()
    await worker!.evaluate(async () => {
      await chrome.storage.local.set({
        'flowlary.ui.firstWin': { completed: true, localSuccess: true, aiSuccess: true, _v: 1 },
      })
    })
    const extensionId = worker!.url().split('/')[2]
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`)
    await expect(page.getByRole('button', { name: /pause on this site|resume on this site/i })).toHaveCount(0)
    await expect(page.getByText(/open a regular website/i)).toHaveCount(0)
    await expect(page.getByText(/help in fields/i)).toBeVisible()
    await expect(page.getByRole('switch', { name: /extension active/i })).toBeVisible()
    await expect(page.getByText(/ai checks today/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /layout/i })).toBeVisible()
    await page.close()
  })

  test('http page: search-style input can receive layout help', async () => {
    const page = await context.newPage()
    await page.goto(siteOrigin)
    const field = page.locator('#plain-input')
    await field.click()
    await field.pressSequentially(LAYOUT_TYPED, { delay: 25 })
    await expect.poll(async () => field.inputValue(), { timeout: 4_000 }).toMatch(LAYOUT_EXPECTED)
    await page.close()
  })

  test('user site exception stops writes on that host and removing it restores them', async () => {
    const worker = context.serviceWorkers()[0]
    expect(worker).toBeTruthy()
    await worker!.evaluate(async () => {
      const current = (await chrome.storage.local.get('flowlary.settings'))['flowlary.settings'] as
        | Record<string, unknown>
        | undefined
      await chrome.storage.local.set({
        'flowlary.settings': {
          ...(current ?? { enabled: true, pausedUntil: null, version: 1 }),
          excludedDomains: ['127.0.0.1'],
          _v: 1,
        },
      })
    })
    await new Promise((resolve) => setTimeout(resolve, 400))
    const page = await context.newPage()
    await page.goto(siteOrigin)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially(LAYOUT_TYPED, { delay: 25 })
    await page.waitForTimeout(900)
    expect(await field.inputValue()).toContain('اثممخ')
    expect(await field.inputValue()).not.toMatch(LAYOUT_EXPECTED)
    await page.close()

    await worker!.evaluate(async () => {
      const current = (await chrome.storage.local.get('flowlary.settings'))['flowlary.settings'] as
        | Record<string, unknown>
        | undefined
      await chrome.storage.local.set({
        'flowlary.settings': {
          ...(current ?? { enabled: true, pausedUntil: null, version: 1 }),
          excludedDomains: [],
          _v: 1,
        },
      })
    })
    await new Promise((resolve) => setTimeout(resolve, 400))
    const again = await context.newPage()
    await again.goto(siteOrigin)
    const search = again.locator('#plain-textarea')
    await search.click()
    await search.pressSequentially(LAYOUT_TYPED, { delay: 25 })
    await expect.poll(async () => search.inputValue(), { timeout: 4_000 }).toMatch(LAYOUT_EXPECTED)
    await again.close()
  })

  test('popup first-run explains value and can start writing', async () => {
    const worker = context.serviceWorkers()[0]
    expect(worker).toBeTruthy()
    await worker!.evaluate(async () => {
      await chrome.storage.local.set({
        'flowlary.ui.firstWin': { completed: false, localSuccess: false, aiSuccess: false, _v: 1 },
      })
    })
    const extensionId = worker!.url().split('/')[2]
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`)
    const firstWin = page.locator('.fl-first-win')
    await firstWin.waitFor({ state: 'visible', timeout: 2_500 }).catch(() => undefined)
    if (await firstWin.isVisible()) {
      await expect(page.getByText(/wrong keyboard/i).first()).toBeVisible()
      await page.getByRole('button', { name: /start writing|recommended defaults|use recommended/i }).first().click()
    }
    await expect(page.locator('.fl-popup .fl-title')).toHaveText(/flowlary/i)
    await expect(page.locator('.fl-assistant-daily, .fl-section-label, .fl-first-win').first()).toBeVisible({ timeout: 12_000 })
    await page.close()
  })

  test('realistic sequence: prose, layout error, URL, email, then reload', async () => {
    const page = await openLab(context)
    const field = page.locator('#longform')
    await field.click()
    await field.pressSequentially('hello world this is a test. ', { delay: 8 })
    await field.pressSequentially(LAYOUT_TYPED, { delay: 20 })
    await expect.poll(async () => field.inputValue(), { timeout: 4_000 }).toMatch(/hello please/i)
    await field.pressSequentially('See https://example.com and user@example.com API_TOKEN ', { delay: 8 })
    const before = await field.inputValue()
    expect(before).toContain('https://example.com')
    expect(before).toContain('user@example.com')
    await page.reload()
    await page.waitForSelector('#longform')
    await page.locator('#longform').click()
    await page.locator('#longform').pressSequentially('still typing after reload ', { delay: 10 })
    expect(await page.locator('#longform').inputValue()).toContain('still typing after reload')
    await page.close()
  })

  test('paste does not auto-remap a wrong-keyboard blob', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.evaluate((el) => {
      const field = el as HTMLTextAreaElement
      field.focus()
      field.value = 'اثممخ حمثشسث '
      field.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: 'اثممخ حمثشسث ',
        inputType: 'insertFromPaste',
      }))
    })
    await page.waitForTimeout(900)
    expect(await field.inputValue()).toContain('اثممخ')
    expect(await field.inputValue()).not.toMatch(LAYOUT_EXPECTED)
    await page.close()
  })

  test('ChatGPT-style paste (paste event + insertText) does not show the Typing box', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.evaluate((el) => {
      const field = el as HTMLTextAreaElement
      field.focus()
      field.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))
      field.value = 'اثممخ حمثشسث '
      field.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: 'اثممخ حمثشسث ',
        inputType: 'insertText',
      }))
    })
    await page.waitForTimeout(900)
    expect(await field.inputValue()).toContain('اثممخ')
    expect(await field.inputValue()).not.toMatch(LAYOUT_EXPECTED)
    const boxes = await page.locator('[data-flowlary-suggestion-host]').count()
    expect(boxes).toBe(0)
    await page.close()
  })

  test('nested composer does not auto-write layout', async () => {
    const page = await openLab(context)
    const field = page.locator('#ce-rich')
    await field.click()
    await field.pressSequentially('اثممخ ', { delay: 25 })
    await page.waitForTimeout(600)
    const text = await readLogicalText(page, '#ce-rich')
    expect(text).toContain('اثممخ')
    expect(text).not.toMatch(/^hello\s/)
    await page.close()
  })

  test('mixed English island is not rewritten into a monolingual field after a pause', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially('مرحبا hello are you comming or not نعم انا قادم الان. ', { delay: 18 })
    await page.waitForTimeout(1_200)
    const value = await field.inputValue()
    expect(value).toContain('مرحبا')
    expect(value).toContain('نعم')
    expect(value).not.toMatch(/^hello are you coming/i)
    await page.close()
  })

  test('rapid unfinished English is not consumed by a late review', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    await field.pressSequentially('hel', { delay: 8 })
    await field.pressSequentially('lo there friend are you comm', { delay: 8 })
    const mid = await field.inputValue()
    expect(mid.endsWith('comm')).toBe(true)
    await page.waitForTimeout(200)
    expect(await field.inputValue()).toBe(mid)
    await page.close()
  })

  test('protected tokens stay intact after sentence completion', async () => {
    const page = await openLab(context)
    const field = page.locator('#plain-textarea')
    await field.click()
    const typed = `see ${JWT} and sk-abcdefghijklmnopqrstuvwxyz123456 please. `
    await field.pressSequentially(typed, { delay: 10 })
    await page.waitForTimeout(1_000)
    const value = await field.inputValue()
    expect(value).toContain(JWT)
    expect(value).toContain('sk-abcdefghijklmnopqrstuvwxyz123456')
    await page.close()
  })
})
