import { describe, expect, it } from 'vitest'
import {
  applyLocalizedPresentation,
  buildExplanationLocalizeCacheKey,
  canRequestAiExplanationLocalization,
  validateExplanationLocalizeRequest,
  validateExplanationLocalizeResponse,
  createTrustedRuleExplanation,
} from '@flowlary/shared'

describe('explanation localize presentation', () => {
  const base = createTrustedRuleExplanation({
    rule: { ruleId: 'english.spelling.receive_ie_ei', category: 'spelling', ruleVersion: '1.0' },
    ruleTitle: 'Receive spelling',
    summary: "The verb 'receive' is written with 'ei'.",
    original: 'recieve',
    corrected: 'receive',
    why: 'Common pattern.',
  })

  it('applies localized fields without mutating identity or examples', () => {
    const localized = applyLocalizedPresentation(base, {
      ruleTitle: 'تهجئة receive',
      summary: 'ملخص عربي',
      why: 'سبب عربي',
    })
    expect(localized.ruleTitle).toBe('تهجئة receive')
    expect(localized.summary).toBe('ملخص عربي')
    expect(localized.why).toBe('سبب عربي')
    expect(localized.ruleId).toBe(base.ruleId)
    expect(localized.source).toBe('trusted_rule')
    expect(localized.confidence).toBe('high')
    expect(localized.category).toBe('spelling')
    expect(localized.incorrectExample).toBe('recieve')
    expect(localized.correctExample).toBe('receive')
  })

  it('builds cache key with rule version and locale', () => {
    expect(buildExplanationLocalizeCacheKey('english.spelling.receive_ie_ei', '1.0', 'ar')).toBe(
      'EXPLAIN_LOCALIZE:english.spelling.receive_ie_ei:1.0:ar',
    )
    expect(buildExplanationLocalizeCacheKey('english.spelling.receive_ie_ei', '1.0', 'tr')).not.toBe(
      buildExplanationLocalizeCacheKey('english.spelling.receive_ie_ei', '1.0', 'ar'),
    )
  })

  it('allows AI localization only for trusted high rules in non-English locale', () => {
    expect(canRequestAiExplanationLocalization(base, 'ar')).toBe(true)
    expect(canRequestAiExplanationLocalization(base, 'en')).toBe(false)
    expect(
      canRequestAiExplanationLocalization({ ...base, source: 'fallback', confidence: 'uncertain' }, 'ar'),
    ).toBe(false)
  })

  it('validates Groq response and rejects identity mutations', () => {
    const request = {
      locale: 'ar' as const,
      ruleId: 'english.spelling.receive_ie_ei',
      ruleVersion: '1.0',
      ruleTitle: 'Receive spelling',
      summary: 'English summary',
    }
    expect(validateExplanationLocalizeRequest(request)).toBe(true)
    expect(
      validateExplanationLocalizeResponse(
        { ruleTitle: 'عنوان', summary: 'ملخص', why: 'سبب' },
        request,
      ),
    ).toEqual({ ruleTitle: 'عنوان', summary: 'ملخص', why: 'سبب' })
    expect(
      validateExplanationLocalizeResponse(
        { ruleTitle: 'عنوان', summary: 'ملخص', ruleId: 'other', source: 'trusted_rule' },
        request,
      ),
    ).toBeNull()
  })
})
