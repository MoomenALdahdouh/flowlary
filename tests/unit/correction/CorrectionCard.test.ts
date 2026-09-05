import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CorrectionCard, HOST_ATTR } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import type { CorrectionSuggestionBinding } from '../../../extension/src/features/correction/ui/types.ts'

vi.mock('../../../extension/src/popup/openDashboard.ts', () => ({
  openDashboard: vi.fn(),
}))

vi.mock('../../../extension/src/popup/i18n/localeStorage.ts', () => ({
  readUiLocale: vi.fn(async () => 'en'),
  peekUiLocale: vi.fn(() => 'en'),
}))

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
    document.querySelectorAll(`[${HOST_ATTR}]`).forEach((node) => node.remove())
    document.body.innerHTML = '<textarea id="t" style="width:400px;height:160px"></textarea>'
  })

  afterEach(() => {
    document.querySelectorAll(`[${HOST_ATTR}]`).forEach((node) => node.remove())
  })

  it('stays out of the document until a suggestion is ready', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.ensureVisible('I recive')
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
    expect(card.getState()).toBe('hidden')
  })

  it('shows the Flowlary box card with English badge and click to accept', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady(sampleBinding())

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    expect(host).toBeTruthy()
    expect(host.style.position).toBe('fixed')
    const root = host.shadowRoot!
    expect(root.querySelector('.badge')?.textContent).toMatch(/english/i)
    expect(root.querySelector('.hint')?.textContent).toMatch(/click to accept/i)
    expect(root.querySelector('.card')?.classList.contains('ready')).toBe(true)
  })

  it('shows a loading card while analyzing', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setAnalyzing()
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    expect(card.getState()).toBe('analyzing')
    expect(host.shadowRoot!.querySelector('.card')?.classList.contains('loading')).toBe(true)
    expect(host.shadowRoot!.querySelector('.shimmer')).toBeTruthy()
  })

  it('keeps an error visible', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setError('Open the extension icon and tap I agree')
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    expect(card.getState()).toBe('error')
    expect(host.shadowRoot?.textContent ?? '').toContain('I agree')
  })

  it('keeps character highlights while the user keeps typing', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady(sampleBinding())

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    const marks = [...host.shadowRoot!.querySelectorAll('.mark')].map((el) => el.textContent)
    expect(marks.join('')).toBe('receive')

    card.ensureVisible('I recieve your email. more text')
    expect(card.getState()).toBe('ready')
    expect([...host.shadowRoot!.querySelectorAll('.mark')].map((el) => el.textContent)).toEqual(marks)

    card.setAnalyzing()
    expect(card.getState()).toBe('ready')
    expect(host.shadowRoot!.querySelector('.mark')).toBeTruthy()
  })

  it('applies when the card is clicked', () => {
    const onApply = vi.fn()
    const card = new CorrectionCard({ highlights: true, onApply, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    const binding = sampleBinding()
    card.setReady(binding)
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    host.shadowRoot!.querySelector('.card')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onApply).toHaveBeenCalledWith(binding)
    expect(host.shadowRoot?.querySelector('.hint')?.textContent).toBe('Applied')
    expect(card.isVisible()).toBe(true)
  })

  it('dismisses on Escape key', () => {
    const onDismiss = vi.fn()
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    card.setReady(sampleBinding())
    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    host.shadowRoot!.querySelector('.card')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    expect(onDismiss).toHaveBeenCalled()
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
  })

  it('keeps the ready suggestion after apply', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    const binding = sampleBinding()
    card.setReady(binding)
    ta.value = binding.response.correctedText
    card.retainAfterApply(ta.value, 2)
    expect(card.getState()).toBe('ready')
    expect(card.hasReadyCorrection()).toBe(true)
    expect(card.getBinding()?.requestedFullText).toBe(ta.value)
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeTruthy()
  })
})
