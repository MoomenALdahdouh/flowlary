import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CorrectionCard, HOST_ATTR } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import type { CorrectionSuggestionBinding } from '../../../extension/src/features/correction/ui/types.ts'
import type { RuleExplanation } from '@flowlary/shared'

vi.mock('../../../extension/src/popup/openDashboard.ts', () => ({
  openDashboard: vi.fn(),
}))

vi.mock('../../../extension/src/popup/i18n/localeStorage.ts', () => ({
  readUiLocale: vi.fn(async () => 'en'),
}))

vi.mock('../../../extension/src/features/correction/explainLocalizeClient.ts', () => ({
  presentExplanationForLocale: vi.fn((explanation: RuleExplanation) => explanation),
  needsAiExplanationLocalization: () => false,
  requestExplanationLocalization: vi.fn(async () => null),
  mergeLocalizedFields: vi.fn((explanation: RuleExplanation) => explanation),
}))

async function flushPanel(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const sampleBinding = (): CorrectionSuggestionBinding => ({
  remoteRequestId: 'req-1',
  debouncerGeneration: 1,
  fieldGeneration: 1,
  segment: 'I recieve your email.',
  requestedFullText: 'I recieve your email.',
  response: {
    originalText: 'I recieve your email.',
    correctedText: 'I receive your email.',
    changes: [{ type: 'spelling', original: 'recieve', corrected: 'receive', start: 2, end: 9 }],
  },
})

describe('CorrectionCard', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    document.body.innerHTML = '<textarea id="t" style="width:400px;height:160px"></textarea>'
  })

  it('stays out of the document until the field has text', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
    expect(card.getState()).toBe('hidden')
  })

  it('appears on first text and stays inserted after the input', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.ensureVisible('I')

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    expect(host).toBeTruthy()
    expect(host.previousElementSibling).toBe(ta)
    expect(host.style.position).not.toBe('fixed')
    expect(card.getState()).toBe('idle')

    card.ensureVisible('I recive')
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBe(host)
    expect(card.getState()).toBe('idle')
  })

  it('keeps an error visible instead of mirroring the uncorrected text', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.ensureVisible('hell there I can not se you')
    card.setError('Open the extension icon and tap I agree')
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    expect(card.getState()).toBe('error')
    expect(host.shadowRoot?.textContent ?? '').toContain('I agree')
  })

  it('does not remove the row when a request starts or text is already correct', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.ensureVisible('I recive')
    const host = document.querySelector(`[${HOST_ATTR}]`)
    card.setAnalyzing()
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBe(host)
    expect(card.getState()).toBe('analyzing')
    expect(host!.shadowRoot!.querySelector('.dots')).toBeTruthy()

    card.setReady({
      remoteRequestId: 'x',
      debouncerGeneration: 1,
      fieldGeneration: 1,
      segment: 'I want to go to the library tomorrow.',
      requestedFullText: 'I want to go to the library tomorrow.',
      response: {
        originalText: 'I want to go to the library tomorrow.',
        correctedText: 'I want to go to the library tomorrow.',
        changes: [],
      },
    })
    expect(card.getState()).toBe('idle')
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBe(host)
  })

  it('keeps character highlights while the user keeps typing', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady(sampleBinding())

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    const marks = [...host.shadowRoot!.querySelectorAll('.mark')].map((el) => el.textContent)
    expect(marks.join('')).toBe('e')
    expect(card.getState()).toBe('ready')

    card.ensureVisible('I recieve your email. more text')
    expect(card.getState()).toBe('ready')
    expect([...host.shadowRoot!.querySelectorAll('.mark')].map((el) => el.textContent)).toEqual(marks)

    card.setAnalyzing()
    expect(card.getState()).toBe('ready')
    expect(host.shadowRoot!.querySelector('.mark')).toBeTruthy()
    expect(host.shadowRoot!.querySelector('.dots')).toBeTruthy()
  })

  it('colors only the characters the model changed', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady({
      remoteRequestId: 'x',
      debouncerGeneration: 1,
      fieldGeneration: 1,
      segment: 'I recive you emai',
      requestedFullText: 'I recive you emai',
      response: {
        originalText: 'I recive you emai',
        correctedText: 'I receive your email',
        changes: [
          { type: 'spelling', original: 'recive', corrected: 'receive', start: 2, end: 8 },
          { type: 'grammar', original: 'you', corrected: 'your', start: 9, end: 12 },
          { type: 'spelling', original: 'emai', corrected: 'email', start: 13, end: 17 },
        ],
      },
    })

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    const marks = [...host.shadowRoot!.querySelectorAll('.mark')]
    expect(marks.map((el) => el.textContent)).toEqual(['e', 'r', 'l'])
    expect(marks[0]?.className).toContain('spelling')
    expect(marks[1]?.className).toContain('grammar')
    expect(marks[2]?.className).toContain('spelling')
  })

  it('puts the row back after the field when the field is wrapped', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.ensureVisible('I do nor need')

    const wrap = document.createElement('div')
    ta.parentElement!.insertBefore(wrap, ta)
    wrap.appendChild(ta)
    card.reattach()

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    expect(host.previousElementSibling).toBe(ta)
    expect(card.isVisible()).toBe(true)
  })

  it('mirrors host chrome and does not mutate the input', () => {
    document.body.innerHTML = `
      <textarea id="t" style="
        width:400px;height:160px;background:#ffffff;color:#111827;
        border:2px solid rgb(37, 99, 235);border-radius:10px;padding:12px;
        font-family:Georgia, serif;font-size:16px;
      "></textarea>
    `
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.ensureVisible('I recive')

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    const row = host.shadowRoot!.querySelector('.row') as HTMLElement
    expect(row.style.borderTopLeftRadius).toBe('10px')
    expect(row.style.borderBottomLeftRadius).toBe('10px')
    expect(row.style.borderColor).toContain('37')
    expect(row.style.fontFamily).toContain('Georgia')
    expect(row.style.paddingTop).toBe('12px')
    expect(host.style.marginTop).toBe('8px')
    expect(ta.style.borderBottomLeftRadius === '' || ta.style.borderBottomLeftRadius === '10px').toBe(true)
  })

  it('applies when row or Apply is clicked', () => {
    const onApply = vi.fn()
    const card = new CorrectionCard({ highlights: true, onApply, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    const binding = sampleBinding()
    card.setReady(binding)
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    const root = host.shadowRoot!.querySelector('.row') as HTMLElement
    root.click()
    expect(onApply).toHaveBeenCalledWith(binding)
    expect(host.shadowRoot?.querySelector('.apply')?.textContent).toBe('Applied')
    expect(card.isVisible()).toBe(true)

    onApply.mockClear()
    host.shadowRoot!.querySelector('.apply')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onApply).toHaveBeenCalledWith(binding)
    card.hide()
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
  })

  it('dismisses on Dismiss click', () => {
    const onDismiss = vi.fn()
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady(sampleBinding())
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    host.shadowRoot!.querySelector('.dismiss')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onDismiss).toHaveBeenCalled()
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
  })

  it('dismisses on Escape key', () => {
    const onDismiss = vi.fn()
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady(sampleBinding())
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    const root = host.shadowRoot!.querySelector('.row') as HTMLElement
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('accepts on Enter key', () => {
    const onApply = vi.fn()
    const card = new CorrectionCard({ highlights: true, onApply, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    const binding = sampleBinding()
    card.setReady(binding)
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    const root = host.shadowRoot!.querySelector('.row') as HTMLElement
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onApply).toHaveBeenCalledWith(binding)
  })

  it('opens explanation panel without applying correction', async () => {
    const onApply = vi.fn()
    const card = new CorrectionCard({ highlights: true, onApply, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    const binding = sampleBinding()
    card.setReady({
      ...binding,
      response: {
        ...binding.response,
        explanations: [
          {
            confidence: 'high',
            source: 'trusted_rule',
            category: 'spelling',
            ruleId: 'english.spelling.receive_ie_ei',
            ruleTitle: 'Receive spelling',
            summary: 'Summary text',
            incorrectExample: 'recieve',
            correctExample: 'receive',
          },
        ],
      },
    })
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    host.shadowRoot!.querySelector('.explain')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPanel()
    expect(onApply).not.toHaveBeenCalled()
    expect(document.querySelector('[data-flowlary-explanation-panel]')).toBeTruthy()
  })

  it('clears explanation panel when correction is hidden', async () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady({
      ...sampleBinding(),
      response: {
        ...sampleBinding().response,
        explanations: [
          {
            confidence: 'medium',
            source: 'pair',
            category: 'spelling',
            summary: 'Summary',
            incorrectExample: 'recieve',
            correctExample: 'receive',
          },
        ],
      },
    })
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    host.shadowRoot!.querySelector('.explain')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPanel()
    expect(document.querySelector('[data-flowlary-explanation-panel]')).toBeTruthy()
    card.hide()
    expect(document.querySelector('[data-flowlary-explanation-panel]')).toBeNull()
  })

  it('still works when explanations are missing', async () => {
    const onApply = vi.fn()
    const card = new CorrectionCard({ highlights: true, onApply, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady(sampleBinding())
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    host.shadowRoot!.querySelector('.explain')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPanel()
    expect(document.querySelector('[data-flowlary-explanation-panel]')).toBeTruthy()
    host.shadowRoot!.querySelector('.apply')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onApply).toHaveBeenCalled()
  })
})
