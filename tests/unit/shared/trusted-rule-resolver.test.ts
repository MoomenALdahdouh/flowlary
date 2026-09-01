import { describe, expect, it } from 'vitest'
import {
  assertRuleExplanationInvariants,
  assertTrustedRuleDefinition,
  assertTrustedRuleLibrary,
  createExactPairMatcher,
  resolveExplanation,
  resolveExplanationWithLibrary,
  TRUSTED_RULE_LIBRARY,
  type CorrectionChange,
  type TrustedRuleDefinition,
} from '@flowlary/shared'

function change(
  type: CorrectionChange['type'],
  original: string,
  corrected: string,
): CorrectionChange {
  return { type, original, corrected, start: 0, end: original.length }
}

describe('WL-4C-C trusted rule resolver', () => {
  it('TEST 1: known deterministic trusted spelling rule match', () => {
    const explanation = resolveExplanation(change('spelling', 'recieve', 'receive'))

    expect(explanation.source).toBe('trusted_rule')
    expect(explanation.confidence).toBe('high')
    expect(explanation.ruleId).toBe('english.spelling.receive_ie_ei')
    expect(explanation.ruleTitle).toBe('Receive spelling')
    expect(explanation.summary).toContain('receive')
    assertRuleExplanationInvariants(explanation)
  })

  it('TEST 2: same-looking correction without authoritative pair falls back', () => {
    const explanation = resolveExplanation(change('spelling', 'recieved', 'received'))

    expect(explanation.source).toBe('pair')
    expect(explanation.confidence).toBe('medium')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.ruleTitle).toBeUndefined()
  })

  it('TEST 3: grammar go → goes falls back without trusted context', () => {
    const explanation = resolveExplanation(change('grammar', 'go', 'goes'))

    expect(explanation.source).not.toBe('trusted_rule')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.summary.toLowerCase()).not.toContain('subject')
    expect(explanation.summary.toLowerCase()).not.toContain('agreement')
  })

  it('TEST 4: ambiguous grammar get → got falls back', () => {
    const explanation = resolveExplanation(change('grammar', 'get', 'got'))

    expect(explanation.source).toBe('fallback')
    expect(explanation.confidence).toBe('uncertain')
    expect(explanation.ruleId).toBeUndefined()
  })

  it('TEST 5: unknown grammar make → made falls back', () => {
    const explanation = resolveExplanation(change('grammar', 'make', 'made'))

    expect(explanation.source).not.toBe('trusted_rule')
    expect(explanation.ruleId).toBeUndefined()
    expect(['low', 'uncertain']).toContain(explanation.confidence)
  })

  it('TEST 6: layout correction always falls back', () => {
    const explanation = resolveExplanation(change('layout', 'lvpfh', 'hello'))

    expect(explanation.source).toBe('pair')
    expect(explanation.category).toBe('layout')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.summary.toLowerCase()).toContain('keyboard input')
  })

  it('TEST 7: no matching rule uses WL-4C-B pair explanation', () => {
    const explanation = resolveExplanation(change('spelling', 'mesage', 'message'))

    expect(explanation.source).toBe('pair')
    expect(explanation.confidence).toBe('medium')
    expect(explanation.ruleId).toBeUndefined()
  })

  it('TEST 8: multiple matching rules fall back instead of arbitrary selection', () => {
    const duplicateRule: TrustedRuleDefinition = {
      ruleId: 'test.duplicate.spelling',
      category: 'spelling',
      version: '1.0',
      title: 'Duplicate test rule',
      summary: 'Duplicate summary for testing.',
      why: 'Duplicate why for testing.',
      examples: [{ incorrect: 'definately', correct: 'definitely' }],
      pairs: [{ incorrect: 'definately', correct: 'definitely' }],
      match: createExactPairMatcher({
        category: 'spelling',
        pairs: [{ incorrect: 'definately', correct: 'definitely' }],
      }),
    }

    const explanation = resolveExplanationWithLibrary(
      change('spelling', 'definately', 'definitely'),
      [...TRUSTED_RULE_LIBRARY, duplicateRule],
    )

    expect(explanation.source).toBe('pair')
    expect(explanation.ruleId).toBeUndefined()
  })

  it('TEST 9: rule version is stable for same input', () => {
    const first = resolveExplanation(change('spelling', 'seperate', 'separate'))
    const second = resolveExplanation(change('spelling', 'seperate', 'separate'))

    expect(first.ruleId).toBe('english.spelling.separate_not_er')
    expect(second.ruleId).toBe(first.ruleId)
    expect(first.confidence).toBe('high')
  })

  it('TEST 10: resolver is deterministic', () => {
    const input = change('spelling', 'thier', 'their')
    expect(resolveExplanation(input)).toEqual(resolveExplanation(input))
  })

  it('TEST 11: resolver has no provider/network dependencies', () => {
    const source = resolveExplanation.toString()
    expect(source).not.toMatch(/fetch|groq|openai|axios|http/i)
  })

  it('TEST 12: practice target preserved on trusted match', () => {
    const explanation = resolveExplanation(change('spelling', 'definately', 'definitely'), {
      practiceTargetId: 'spelling:definately',
    })

    expect(explanation.source).toBe('trusted_rule')
    expect(explanation.practiceTargetId).toBe('spelling:definately')
  })

  it('TEST 13: invalid trusted rule definition rejected', () => {
    expect(() =>
      assertTrustedRuleDefinition({
        ruleId: '',
        category: 'spelling',
        version: '1.0',
        title: 'Bad',
        summary: 'Bad',
        why: 'Bad',
        examples: [],
        pairs: [],
        match: () => 'no_match',
      }),
    ).toThrow(/invalid_trusted_rule_id/)
  })

  it('TEST 14: invalid category on correction input falls back via adapter error', () => {
    expect(() =>
      resolveExplanation({
        type: 'spelling',
        original: '',
        corrected: 'receive',
        start: 0,
        end: 0,
      }),
    ).toThrow(/invalid_correction_pair/)
  })

  it('TEST 15: trusted rule explanation satisfies WL-4C-A invariants', () => {
    for (const rule of TRUSTED_RULE_LIBRARY) {
      for (const pair of rule.pairs) {
        const explanation = resolveExplanation(change(rule.category, pair.incorrect, pair.correct))
        assertRuleExplanationInvariants(explanation)
      }
    }
  })

  it('TEST 16: trusted rule must contain ruleId', () => {
    const explanation = resolveExplanation(change('spelling', 'recive', 'receive'))
    expect(explanation.ruleId).toBeTruthy()
  })

  it('TEST 17: trusted rule must have high confidence', () => {
    const explanation = resolveExplanation(change('spelling', 'recive', 'receive'))
    expect(explanation.confidence).toBe('high')
  })

  it('TEST 18: pair fallback must never have high confidence', () => {
    const fallbacks = [
      resolveExplanation(change('spelling', 'recieved', 'received')),
      resolveExplanation(change('grammar', 'go', 'goes')),
      resolveExplanation(change('wording', 'make a photo', 'take a photo')),
      resolveExplanation(change('layout', 'lvpfh', 'hello')),
    ]

    for (const explanation of fallbacks) {
      expect(explanation.confidence).not.toBe('high')
      expect(explanation.source).not.toBe('trusted_rule')
    }
  })

  describe('trusted rule negative cases', () => {
    it('does not match recieve → receive when category is grammar', () => {
      const explanation = resolveExplanation(change('grammar', 'recieve', 'receive'))
      expect(explanation.source).not.toBe('trusted_rule')
    })

    it('does not match near miss recieved → received', () => {
      const explanation = resolveExplanation(change('spelling', 'recieved', 'received'))
      expect(explanation.ruleId).toBeUndefined()
    })

    it('does not match wording pair even if phrase appears elsewhere', () => {
      const explanation = resolveExplanation(
        change('wording', 'make a photo', 'take a photo'),
      )
      expect(explanation.source).toBe('pair')
      expect(explanation.ruleId).toBeUndefined()
    })
  })

  describe('library integrity', () => {
    it('validates the production trusted rule library', () => {
      expect(() => assertTrustedRuleLibrary(TRUSTED_RULE_LIBRARY)).not.toThrow()
    })

    it('each trusted rule has unique pairs across the library', () => {
      const keys = new Set<string>()
      for (const rule of TRUSTED_RULE_LIBRARY) {
        for (const pair of rule.pairs) {
          const key = `${pair.incorrect}→${pair.correct}`
          expect(keys.has(key)).toBe(false)
          keys.add(key)
        }
      }
    })
  })
})
