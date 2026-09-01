import { describe, expect, it } from 'vitest'
import {
  assertRuleExplanationInvariants,
  buildExplanationConfidence,
  createPairExplanation,
  createTrustedRuleExplanation,
  createUncertainExplanation,
  isValidPracticeTargetId,
  validateRuleExplanation,
  type TrustedRuleReference,
} from '@flowlary/shared'

describe('WL-4C-A explanation contract', () => {
  it('TEST 1: spelling pair recieved → received', () => {
    const explanation = createPairExplanation({
      category: 'spelling',
      original: 'recieved',
      corrected: 'received',
      practiceTargetId: 'spelling:recieved',
    })

    expect(explanation.category).toBe('spelling')
    expect(explanation.source).toBe('pair')
    expect(explanation.confidence).toBe('medium')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.ruleTitle).toBeUndefined()
    expect(explanation.incorrectExample).toBe('recieved')
    expect(explanation.correctExample).toBe('received')
    expect(explanation.summary).toContain('recieved')
    expect(explanation.summary).toContain('received')
    expect(explanation.summary.toLowerCase()).not.toContain('rule')
    expect(validateRuleExplanation(explanation)).toBe(true)
  })

  it('TEST 2: wording pair make a photo → take a photo', () => {
    const explanation = createPairExplanation({
      category: 'wording',
      original: 'make a photo',
      corrected: 'take a photo',
    })

    expect(explanation.source).toBe('pair')
    expect(explanation.confidence).toBe('medium')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.summary).toContain('make a photo')
    expect(explanation.summary).toContain('take a photo')
  })

  it('TEST 3: grammar pair go → goes stays low/uncertain without named rule', () => {
    const explanation = createPairExplanation({
      category: 'grammar',
      original: 'go',
      corrected: 'goes',
    })

    expect(explanation.source).toBe('pair')
    expect(['low', 'uncertain']).toContain(explanation.confidence)
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.ruleTitle).toBeUndefined()
    expect(explanation.summary).toContain('grammar correction')
  })

  it('TEST 4: ambiguous grammar get → got is uncertain via fallback factory', () => {
    const explanation = createUncertainExplanation({
      category: 'grammar',
      original: 'get',
      corrected: 'got',
    })

    expect(explanation.confidence).toBe('uncertain')
    expect(explanation.source).toBe('fallback')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.summary).toContain('could not be identified confidently')
  })

  it('TEST 5: layout pair is not represented as English grammar', () => {
    const explanation = createPairExplanation({
      category: 'layout',
      original: 'lvpfh',
      corrected: 'hello',
    })

    expect(explanation.category).toBe('layout')
    expect(explanation.summary.toLowerCase()).toContain('keyboard input')
    expect(explanation.summary.toLowerCase()).not.toContain('grammar rule')
    expect(explanation.confidence).toBe('medium')
  })

  it('TEST 6: trusted rule contract can be represented without real rule data', () => {
    const rule: TrustedRuleReference = {
      ruleId: 'grammar.subject_verb_agreement.v1',
      category: 'grammar',
      ruleVersion: '1',
    }

    const explanation = createTrustedRuleExplanation({
      rule,
      ruleTitle: 'Subject–Verb Agreement',
      summary: 'Third-person singular subjects often take a verb with -s.',
      original: 'He go',
      corrected: 'He goes',
    })

    expect(explanation.source).toBe('trusted_rule')
    expect(explanation.confidence).toBe('high')
    expect(explanation.ruleId).toBe(rule.ruleId)
    expect(explanation.ruleTitle).toBe('Subject–Verb Agreement')
    expect(validateRuleExplanation(explanation)).toBe(true)
  })

  it('TEST 7: trusted_rule without ruleId fails validation', () => {
    expect(() =>
      assertRuleExplanationInvariants({
        confidence: 'high',
        source: 'trusted_rule',
        category: 'grammar',
        summary: 'Summary',
        incorrectExample: 'go',
        correctExample: 'goes',
      }),
    ).toThrow(/trusted_rule_missing_identity/)
  })

  it('TEST 8: ruleTitle without ruleId fails validation', () => {
    expect(() =>
      assertRuleExplanationInvariants({
        confidence: 'medium',
        source: 'pair',
        category: 'spelling',
        ruleTitle: 'Fake rule',
        summary: 'Summary',
        incorrectExample: 'recieved',
        correctExample: 'received',
      }),
    ).toThrow(/rule_title_without_rule_id/)
  })

  it('TEST 9: practice target preserves WL-4B identity exactly', () => {
    expect(isValidPracticeTargetId('spelling:recieved', 'spelling', 'recieved')).toBe(true)
    expect(isValidPracticeTargetId('grammar:he go', 'grammar', 'He go')).toBe(true)

    expect(() =>
      createPairExplanation({
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        practiceTargetId: 'grammar:recieved',
      }),
    ).toThrow(/invalid_practice_target_id/)
  })

  it('TEST 10: malformed values are rejected', () => {
    expect(() =>
      createPairExplanation({
        category: 'spelling',
        original: '',
        corrected: 'received',
      }),
    ).toThrow(/invalid_pair_examples/)

    expect(
      validateRuleExplanation({
        confidence: 'medium',
        source: 'pair',
        category: 'spelling',
        summary: '',
        incorrectExample: 'recieved',
        correctExample: 'received',
      }),
    ).toBe(false)

    expect(buildExplanationConfidence({
      category: 'grammar',
      source: 'trusted_rule',
      original: 'go',
      corrected: 'goes',
    })).toBe('high')
  })
})
