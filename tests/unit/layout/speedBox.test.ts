import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { createSpeedBox } from '../../../extension/src/features/layout/speedBox.ts'
import type { SpeedBoxProfile } from '../../../extension/src/features/layout/speedBox.ts'
import { loadSpeedBoxStrings, resetSpeedBoxStringCache } from '../../../extension/src/features/layout/speedBoxStrings.ts'
import * as writeGate from '../../../extension/src/core/writeGate/writeGate.ts'

function profile(overrides: Partial<SpeedBoxProfile> = {}): SpeedBoxProfile {
  return {
    sourceLayout: 'en-US-qwerty',
    enabledLayouts: ['en-US-qwerty', 'ar-101'],
    manualConversionEnabled: true,
    sourceLanguage: 'en',
    targetLanguage: 'ar',
    correctionEnabled: true,
    correctionConsentAccepted: true,
    translationEnabled: true,
    correctionMode: 'direct',
    translationMode: 'direct',
    layoutMode: 'direct',
    ...overrides,
  }
}

function host(): HTMLElement {
  const node = document.getElementById('flowlary-speed-box')
  if (!node) throw new Error('Speed Box host missing')
  return node
}

function root(): ShadowRoot {
  const shadow = host().shadowRoot
  if (!shadow) throw new Error('Speed Box shadow missing')
  return shadow
}

describe('Speed Box modes', () => {
  let box: ReturnType<typeof createSpeedBox>

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    box?.destroy()
    document.body.innerHTML = ''
    vi.useRealTimers()
    resetSpeedBoxStringCache()
    vi.mocked(chrome.storage.local.get).mockResolvedValue({})
  })

  it('opens with layout and language selects defaulted from settings', () => {
    box = createSpeedBox({ getProfile: () => profile() })
    expect(box.open()).toBe(true)
    expect((root().querySelector('[data-flowlary="speed-pair-layout"]') as HTMLElement).hidden).toBe(
      false,
    )
    expect((root().querySelector('[data-flowlary="speed-source"]') as HTMLSelectElement).value).toBe(
      'en-US-qwerty',
    )
    expect((root().querySelector('[data-flowlary="speed-target"]') as HTMLSelectElement).value).toBe(
      'ar-101',
    )
    expect(root().querySelector('[data-flowlary="speed-run"]')).toBeNull()
  })

  it('shows language selects in Translate mode', () => {
    box = createSpeedBox({ getProfile: () => profile() })
    box.open()
    ;(root().querySelector('[data-mode="translate"]') as HTMLButtonElement).click()
    expect((root().querySelector('[data-flowlary="speed-pair-translate"]') as HTMLElement).hidden).toBe(
      false,
    )
    expect(
      (root().querySelector('[data-flowlary="speed-lang-source"]') as HTMLSelectElement).value,
    ).toBe('en')
    expect(
      (root().querySelector('[data-flowlary="speed-lang-target"]') as HTMLSelectElement).value,
    ).toBe('ar')
  })

  it('swaps languages and re-runs translate', async () => {
    const translate = vi.fn(async () => ({ ok: true as const, translation: 'hello' }))
    box = createSpeedBox({ getProfile: () => profile(), translate })
    box.open()
    ;(root().querySelector('[data-mode="translate"]') as HTMLButtonElement).click()
    const input = root().querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement
    input.value = 'مرحبا'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    ;(root().querySelector('[data-flowlary="speed-swap-lang"]') as HTMLButtonElement).click()
    await vi.advanceTimersByTimeAsync(420)
    expect(
      (root().querySelector('[data-flowlary="speed-lang-source"]') as HTMLSelectElement).value,
    ).toBe('ar')
    expect(translate).toHaveBeenCalledWith('مرحبا', 'ar', 'en', expect.any(AbortSignal))
  })

  it('remaps layout instantly as you type', () => {
    box = createSpeedBox({ getProfile: () => profile() })
    box.open()
    const input = root().querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement
    input.value = 'lvpfh'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(input.value).toBe('مرحبا')
  })

  it('auto-translates after typing without a run button', async () => {
    const translate = vi.fn(async () => ({ ok: true as const, translation: 'مرحبا' }))
    box = createSpeedBox({
      getProfile: () => profile({ translationMode: 'box' }),
      translate,
    })
    box.open()
    ;(root().querySelector('[data-mode="translate"]') as HTMLButtonElement).click()
    const input = root().querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement
    input.value = 'Hello'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(420)
    expect(translate).toHaveBeenCalledWith('Hello', 'en', 'ar', expect.any(AbortSignal))
    expect(root().querySelector('[data-flowlary="speed-result-text"]')?.textContent).toBe('مرحبا')
  })

  it('auto-fixes after typing without a run button', async () => {
    const correct = vi.fn(async () => ({
      type: 'CORRECT_TEXT_RESULT' as const,
      ok: true as const,
      requestId: 'req',
      data: {
        originalText: 'I has a cat',
        correctedText: 'I have a cat',
        changes: [{ type: 'grammar', original: 'has', corrected: 'have' }],
      },
    }))
    box = createSpeedBox({
      getProfile: () => profile({ correctionMode: 'box' }),
      correct,
    })
    box.open()
    ;(root().querySelector('[data-mode="fix"]') as HTMLButtonElement).click()
    const input = root().querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement
    input.value = 'I has a cat'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(420)
    expect(correct).toHaveBeenCalled()
    expect(root().querySelector('[data-flowlary="speed-result-text"]')?.textContent).toBe(
      'I have a cat',
    )
    expect(root().querySelector('[data-flowlary="speed-result-text"] .mark.grammar')).toBeTruthy()
  })

  it('inserts on Enter when opened from a field', () => {
    box = createSpeedBox({ getProfile: () => profile() })
    const field = document.createElement('textarea')
    field.value = 'hello lvpfh there'
    document.body.append(field)
    field.focus()
    field.setSelectionRange(6, 11)
    box.open()
    const input = root().querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement
    expect(input.value).toBe('مرحبا')
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    expect(field.value).toBe('hello مرحبا there')
    expect(box.isOpen()).toBe(false)
  })

  it('inserts into the page field through the Write Gate', () => {
    const gate = vi.spyOn(writeGate, 'commitWriteTransaction')
    box = createSpeedBox({ getProfile: () => profile() })
    const field = document.createElement('textarea')
    field.value = 'hello lvpfh there'
    document.body.append(field)
    field.focus()
    field.setSelectionRange(6, 11)
    box.open()
    const input = root().querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    expect(gate).toHaveBeenCalled()
    const args = gate.mock.calls[0]
    expect(args?.[0]).toBe(field)
    expect(args?.[3]).toBe('مرحبا')
    expect(args?.[4]).toMatchObject({
      trigger: 'manual_box',
      auto: false,
      capability: 'layout',
    })
    expect(field.value).toBe('hello مرحبا there')
    gate.mockRestore()
  })

  it('blocks Fix when AI consent is missing', async () => {
    box = createSpeedBox({
      getProfile: () => profile({ correctionConsentAccepted: false }),
    })
    box.open()
    ;(root().querySelector('[data-mode="fix"]') as HTMLButtonElement).click()
    const input = root().querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement
    input.value = 'I has a cat'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(420)
    expect(root().querySelector('[data-flowlary="speed-status"]')?.textContent).toContain(
      'Enable Flowlary AI',
    )
  })

  it('closes on Escape from inside the overlay', () => {
    box = createSpeedBox({ getProfile: () => profile() })
    box.open()
    expect(box.isOpen()).toBe(true)
    root().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(box.isOpen()).toBe(false)
  })

  it('uses Arabic copy and RTL when the UI locale is Arabic', async () => {
    vi.useRealTimers()
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      [STORAGE_KEYS.uiLocale]: { value: 'ar', _v: 1 },
    })
    await loadSpeedBoxStrings()
    box = createSpeedBox({ getProfile: () => profile() })
    box.open()
    expect(host().getAttribute('dir')).toBe('rtl')
    expect(host().getAttribute('lang')).toBe('ar')
    expect(root().querySelector('#fl-speed-title')?.textContent).toBe('صندوق السرعة')
    expect(root().querySelector('[data-mode="fix"] [data-flowlary="speed-mode-label"]')?.textContent).toBe(
      'تصحيح',
    )
    expect((root().querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement).placeholder).toBe(
      'اكتب أو الصق…',
    )
  })
})
