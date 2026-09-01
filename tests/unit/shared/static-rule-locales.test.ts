import { describe, expect, it } from 'vitest'
import {
  createTrustedRuleExplanation,
  getStaticTrustedRulePresentation,
  resolveLocalizedPresentation,
} from '@flowlary/shared'

describe('static trusted rule locales', () => {
  const explanation = createTrustedRuleExplanation({
    rule: { ruleId: 'english.spelling.receive_ie_ei', category: 'spelling', ruleVersion: '1.0' },
    ruleTitle: 'Receive spelling',
    summary: "The verb 'receive' is written with 'ei' after the c, not 'ie'.",
    original: 'recieve',
    corrected: 'receive',
    why: 'Common English spelling pattern.',
  })

  it('returns Arabic static copy for trusted receive rule', () => {
    const copy = getStaticTrustedRulePresentation('english.spelling.receive_ie_ei', 'ar')
    expect(copy?.ruleTitle).toContain('receive')
    const localized = resolveLocalizedPresentation(explanation, 'ar')
    expect(localized.ruleTitle).toBe(copy?.ruleTitle)
    expect(localized.incorrectExample).toBe('recieve')
    expect(localized.correctExample).toBe('receive')
    expect(localized.ruleId).toBe('english.spelling.receive_ie_ei')
  })

  it('returns Turkish static copy for trusted receive rule', () => {
    const localized = resolveLocalizedPresentation(explanation, 'tr')
    expect(localized.summary.toLowerCase()).toContain('receive')
    expect(localized.incorrectExample).toBe('recieve')
  })

  it('leaves English explanation unchanged for en locale', () => {
    const localized = resolveLocalizedPresentation(explanation, 'en')
    expect(localized.summary).toBe(explanation.summary)
  })

  it('falls back to English for unsupported locale without static copy', () => {
    const localized = resolveLocalizedPresentation(explanation, 'ru')
    expect(localized.summary).toBe(explanation.summary)
  })
})
