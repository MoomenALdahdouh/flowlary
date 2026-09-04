import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CorrectionCard } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import { createSpeedBox } from '../../../extension/src/features/layout/speedBox.ts'

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
  '"><script>alert(1)</script>',
]

describe('XSS — AI output rendered as text', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    document.body.innerHTML = '<textarea id="t"></textarea>'
  })

  it('CorrectionCard does not inject executable HTML from malicious correction text', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    const card = new CorrectionCard({
      highlights: false,
      onApply: () => undefined,
      onDismiss: () => undefined,
    })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)

    for (const payload of XSS_PAYLOADS) {
      card.setReady({
        remoteRequestId: 'req-xss',
        debouncerGeneration: 1,
        fieldGeneration: 1,
        segment: 'hello',
        requestedFullText: 'hello',
        response: {
          originalText: 'hello',
          correctedText: payload,
          changes: [],
        },
      })
      const host = document.querySelector('[data-flowlary-correction-host]') as HTMLElement
      const content = host.shadowRoot?.querySelector('.content')
      expect(host.shadowRoot?.querySelector('script')).toBeNull()
      expect(content?.querySelector('img')).toBeNull()
      expect(content?.textContent).toBe(payload)
      card.hide()
    }

    expect(alertSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('CorrectionCard highlight mode uses text nodes only', () => {
    const card = new CorrectionCard({
      highlights: true,
      onApply: () => undefined,
      onDismiss: () => undefined,
    })
    const ta = document.getElementById('t') as HTMLTextAreaElement
    card.mount(ta)
    const payload = '<img src=x onerror=alert(1)>'
    card.setReady({
      remoteRequestId: 'req-xss',
      debouncerGeneration: 1,
      fieldGeneration: 1,
      segment: 'hello',
      requestedFullText: 'hello',
      response: {
        originalText: 'hello',
        correctedText: payload,
        changes: [{ type: 'spelling', original: 'hello', corrected: payload, start: 0, end: 5 }],
      },
    })
    const host = document.querySelector('[data-flowlary-correction-host]') as HTMLElement
    expect(host.shadowRoot?.querySelector('img')).toBeNull()
    expect(host.shadowRoot?.querySelector('script')).toBeNull()
  })

  it('SpeedBox renders converted output with textContent only', () => {
    const box = createSpeedBox({
      getProfile: () => ({
        sourceLayout: 'en-US-qwerty',
        enabledLayouts: ['ar-SA-arabic'],
        manualConversionEnabled: true,
      }),
    })
    box.open()
    const host = document.getElementById('flowlary-speed-box')
    const input = host?.shadowRoot?.querySelector('[data-flowlary="speed-input"]') as HTMLTextAreaElement
    expect(input).toBeTruthy()
    for (const payload of XSS_PAYLOADS) {
      input.value = payload
      input.dispatchEvent(new Event('input', { bubbles: true }))
      const textEl = host?.shadowRoot?.querySelector('[data-flowlary="speed-result-text"]')
      expect(textEl?.querySelector('script')).toBeNull()
      expect(textEl?.querySelector('img')).toBeNull()
      if (textEl?.textContent) {
        expect(textEl.textContent).not.toMatch(/onerror=/)
      }
    }
    box.close()
  })
})
