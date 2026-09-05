import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExplanationPanel } from '../../../extension/src/features/correction/ui/ExplanationPanel.ts'
import type { CorrectionSuggestionBinding } from '../../../extension/src/features/correction/ui/types.ts'
import type { RuleExplanation } from '@flowlary/shared'
import { resetCorrectionExplainStringCache } from '../../../extension/src/features/correction/ui/explanationStrings.ts'

vi.mock('../../../extension/src/popup/openDashboard.ts', () => ({
  openDashboard: vi.fn(),
}))

vi.mock('../../../extension/src/popup/i18n/localeStorage.ts', () => ({
  readUiLocale: vi.fn(async () => 'en'),
  peekUiLocale: vi.fn(() => 'en'),
}))

vi.mock('../../../extension/src/features/correction/explainLocalizeClient.ts', () => ({
  presentExplanationForLocale: vi.fn((explanation: RuleExplanation) => explanation),
  needsAiExplanationLocalization: () => false,
  requestExplanationLocalization: vi.fn(async () => null),
  mergeLocalizedFields: vi.fn((explanation: RuleExplanation) => explanation),
}))

import { readUiLocale } from '../../../extension/src/popup/i18n/localeStorage.ts'
import { presentExplanationForLocale } from '../../../extension/src/features/correction/explainLocalizeClient.ts'
import { resolveLocalizedPresentation } from '@flowlary/shared'

async function flushPanel(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function binding(
  changes: CorrectionSuggestionBinding['response']['changes'],
  explanations?: RuleExplanation[],
): CorrectionSuggestionBinding {
  return {
    remoteRequestId: 'req-1',
    debouncerGeneration: 1,
    fieldGeneration: 1,
    segment: 'sample',
    requestedFullText: 'sample',
    response: {
      originalText: 'sample',
      correctedText: 'fixed',
      changes,
      explanations,
    },
  }
}

describe('ExplanationPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetCorrectionExplainStringCache()
    vi.mocked(readUiLocale).mockResolvedValue('en')
    vi.mocked(presentExplanationForLocale).mockImplementation((explanation, locale) =>
      resolveLocalizedPresentation(explanation, locale ?? 'en'),
    )
  })

  it('renders trusted spelling explanation', async () => {
    const panel = new ExplanationPanel()
    const explanation: RuleExplanation = {
      confidence: 'high',
      source: 'trusted_rule',
      category: 'spelling',
      ruleId: 'english.spelling.receive_ie_ei',
      ruleTitle: 'Receive spelling',
      summary: "The verb 'receive' is written with 'ei' after the c.",
      why: 'Common English spelling pattern.',
      incorrectExample: 'recieve',
      correctExample: 'receive',
    }
    panel.show(
      binding(
        [{ type: 'spelling', original: 'recieve', corrected: 'receive', start: 0, end: 7 }],
        [explanation],
      ),
    )
    await flushPanel()

    const host = document.querySelector('[data-flowlary-explanation-panel]') as HTMLElement
    expect(host).toBeTruthy()
    expect(host.shadowRoot?.textContent).toContain('Receive spelling')
    expect(host.shadowRoot?.textContent).toContain('recieve')
    expect(host.shadowRoot?.textContent).toContain('receive')
  })

  it('localizes trusted rule presentation for Arabic UI while keeping English examples', async () => {
    vi.mocked(readUiLocale).mockResolvedValue('ar')
    const panel = new ExplanationPanel()
    const explanation: RuleExplanation = {
      confidence: 'high',
      source: 'trusted_rule',
      category: 'spelling',
      ruleId: 'english.spelling.receive_ie_ei',
      ruleTitle: 'Receive spelling',
      summary: "The verb 'receive' is written with 'ei' after the c.",
      why: 'Common English spelling pattern.',
      incorrectExample: 'recieve',
      correctExample: 'receive',
    }
    panel.show(
      binding(
        [{ type: 'spelling', original: 'recieve', corrected: 'receive', start: 0, end: 7 }],
        [explanation],
      ),
    )
    await flushPanel()

    const host = document.querySelector('[data-flowlary-explanation-panel]') as HTMLElement
    const text = host.shadowRoot?.textContent ?? ''
    expect(text).toContain('لماذا هذا التغيير؟')
    expect(text).toContain('تهجئة receive')
    expect(text).toContain('recieve')
    expect(text).toContain('receive')
    expect(host.dir).toBe('rtl')
  })

  it('does not show grammar rule title for fallback grammar explanation', async () => {
    const panel = new ExplanationPanel()
    const explanation: RuleExplanation = {
      confidence: 'uncertain',
      source: 'fallback',
      category: 'grammar',
      summary: "This grammar correction changed 'go' to 'goes', but the exact rule could not be identified confidently.",
      incorrectExample: 'go',
      correctExample: 'goes',
    }
    panel.show(binding([{ type: 'grammar', original: 'go', corrected: 'goes', start: 0, end: 2 }], [explanation]))
    await flushPanel()

    const text = document.querySelector('[data-flowlary-explanation-panel]')!.shadowRoot!.textContent ?? ''
    expect(text.toLowerCase()).not.toContain('subject')
    expect(text.toLowerCase()).not.toContain('agreement')
    expect(text).not.toContain('Rule:')
  })

  it('maps multiple changes to explanations by index', async () => {
    const panel = new ExplanationPanel()
    const explanations: RuleExplanation[] = [
      {
        confidence: 'high',
        source: 'trusted_rule',
        category: 'spelling',
        ruleId: 'english.spelling.receive_ie_ei',
        ruleTitle: 'Receive spelling',
        summary: 'First summary',
        incorrectExample: 'recieve',
        correctExample: 'receive',
      },
      {
        confidence: 'uncertain',
        source: 'fallback',
        category: 'grammar',
        summary: 'Second summary',
        incorrectExample: 'go',
        correctExample: 'goes',
      },
    ]
    panel.show(
      binding(
        [
          { type: 'spelling', original: 'recieve', corrected: 'receive', start: 0, end: 7 },
          { type: 'grammar', original: 'go', corrected: 'goes', start: 8, end: 10 },
        ],
        explanations,
      ),
    )
    await flushPanel()

    const text = document.querySelector('[data-flowlary-explanation-panel]')!.shadowRoot!.textContent ?? ''
    expect(text).toContain('Change 1')
    expect(text).toContain('Change 2')
    expect(text).toContain('First summary')
    expect(text).toContain('Second summary')
  })

  it('shows unavailable message for misaligned explanations', async () => {
    const panel = new ExplanationPanel()
    panel.show(
      binding([{ type: 'spelling', original: 'a', corrected: 'b', start: 0, end: 1 }], []),
    )
    await flushPanel()
    const text = document.querySelector('[data-flowlary-explanation-panel]')!.shadowRoot!.textContent ?? ''
    expect(text).toContain('not available')
  })

  it('closes and returns focus to trigger', async () => {
    const panel = new ExplanationPanel()
    const trigger = document.createElement('button')
    trigger.textContent = 'Explain'
    document.body.appendChild(trigger)
    trigger.focus()

    panel.show(
      binding(
        [{ type: 'spelling', original: 'recieve', corrected: 'receive', start: 0, end: 7 }],
        [
          {
            confidence: 'medium',
            source: 'pair',
            category: 'spelling',
            summary: 'Summary',
            incorrectExample: 'recieve',
            correctExample: 'receive',
          },
        ],
      ),
      trigger,
    )
    await flushPanel()
    panel.hide()
    expect(document.querySelector('[data-flowlary-explanation-panel]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('escapes HTML in explanation text', async () => {
    const panel = new ExplanationPanel()
    panel.show(
      binding(
        [{ type: 'spelling', original: '<bad>', corrected: 'safe', start: 0, end: 5 }],
        [
          {
            confidence: 'medium',
            source: 'pair',
            category: 'spelling',
            summary: '<script>alert(1)</script>',
            incorrectExample: '<bad>',
            correctExample: 'safe',
          },
        ],
      ),
    )
    await flushPanel()
    const host = document.querySelector('[data-flowlary-explanation-panel]') as HTMLElement
    expect(host.shadowRoot?.querySelector('script')).toBeNull()
    expect(host.shadowRoot?.textContent).toContain('<script>alert(1)</script>')
  })

  it('shows practice button only when practiceTargetId exists', async () => {
    const panel = new ExplanationPanel()
    panel.show(
      binding(
        [{ type: 'spelling', original: 'definately', corrected: 'definitely', start: 0, end: 10 }],
        [
          {
            confidence: 'high',
            source: 'trusted_rule',
            category: 'spelling',
            ruleId: 'english.spelling.definitely_not_a',
            ruleTitle: 'Definitely spelling',
            summary: 'Summary',
            incorrectExample: 'definately',
            correctExample: 'definitely',
            practiceTargetId: 'spelling:definately',
          },
        ],
      ),
    )
    await flushPanel()
    expect(
      document.querySelector('[data-flowlary-explanation-panel]')!.shadowRoot!.querySelector('.practice'),
    ).toBeTruthy()
  })
})
