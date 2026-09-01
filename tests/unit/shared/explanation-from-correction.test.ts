import { describe, expect, it } from 'vitest'
import {
  assertRuleExplanationInvariants,
  buildExplanationFromCorrectionChange,
  type CorrectionChange,
} from '@flowlary/shared'

function change(
  type: CorrectionChange['type'],
  original: string,
  corrected: string,
): CorrectionChange {
  return { type, original, corrected, start: 0, end: original.length }
}

describe('WL-4C-B correction → explanation adapter', () => {
  it('TEST 1: spelling recieved → received', () => {
    const explanation = buildExplanationFromCorrectionChange(
      change('spelling', 'recieved', 'received'),
    )

    expect(explanation.category).toBe('spelling')
    expect(explanation.source).toBe('pair')
    expect(explanation.confidence).toBe('medium')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.ruleTitle).toBeUndefined()
    expect(explanation.incorrectExample).toBe('recieved')
    expect(explanation.correctExample).toBe('received')
    assertRuleExplanationInvariants(explanation)
  })

  it('TEST 2: wording make a photo → take a photo', () => {
    const explanation = buildExplanationFromCorrectionChange(
      change('wording', 'make a photo', 'take a photo'),
    )

    expect(explanation.category).toBe('wording')
    expect(explanation.source).toBe('pair')
    expect(explanation.confidence).toBe('medium')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.ruleTitle).toBeUndefined()
    expect(explanation.summary).toContain('make a photo')
    expect(explanation.summary).toContain('take a photo')
  })

  it('TEST 3: grammar go → goes stays conservative without named rule', () => {
    const explanation = buildExplanationFromCorrectionChange(change('grammar', 'go', 'goes'))

    expect(explanation.category).toBe('grammar')
    expect(['pair', 'fallback']).toContain(explanation.source)
    expect(['low', 'uncertain']).toContain(explanation.confidence)
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.ruleTitle).toBeUndefined()
    expect(explanation.summary.toLowerCase()).not.toContain('subject')
    expect(explanation.summary.toLowerCase()).not.toContain('agreement')
  })

  it('TEST 4: ambiguous grammar get → got has no named rule', () => {
    const explanation = buildExplanationFromCorrectionChange(change('grammar', 'get', 'got'))

    expect(explanation.confidence).toBe('uncertain')
    expect(explanation.source).toBe('fallback')
    expect(explanation.ruleId).toBeUndefined()
    expect(explanation.summary).toContain('could not be identified confidently')
  })

  it('TEST 5: layout uses keyboard input terminology', () => {
    const explanation = buildExplanationFromCorrectionChange(
      change('layout', 'lvpfh', 'hello'),
    )

    expect(explanation.category).toBe('layout')
    expect(explanation.source).toBe('pair')
    expect(explanation.summary.toLowerCase()).toContain('keyboard input')
    expect(explanation.summary.toLowerCase()).not.toContain('grammar rule')
    expect(explanation.practiceTargetId).toBeUndefined()
  })

  it('TEST 6: preserves valid WL-4B practice target exactly', () => {
    const explanation = buildExplanationFromCorrectionChange(
      change('spelling', 'recieved', 'received'),
      { practiceTargetId: 'spelling:recieved' },
    )

    expect(explanation.practiceTargetId).toBe('spelling:recieved')
  })

  it('TEST 7: no practice target without options', () => {
    const explanation = buildExplanationFromCorrectionChange(
      change('spelling', 'recieved', 'received'),
    )

    expect(explanation.practiceTargetId).toBeUndefined()
  })

  it('TEST 8: adapter never generates trusted_rule source', () => {
    const cases: CorrectionChange[] = [
      change('grammar', 'He go', 'He goes'),
      change('grammar', 'go', 'goes'),
      change('wording', 'make a photo', 'take a photo'),
    ]

    for (const item of cases) {
      const explanation = buildExplanationFromCorrectionChange(item)
      expect(explanation.source).not.toBe('trusted_rule')
      expect(explanation.ruleId).toBeUndefined()
    }
  })

  it('TEST 9: no pair explanation receives HIGH confidence', () => {
    const cases: CorrectionChange[] = [
      change('spelling', 'recieved', 'received'),
      change('wording', 'make a photo', 'take a photo'),
      change('grammar', 'go', 'goes'),
      change('layout', 'lvpfh', 'hello'),
    ]

    for (const item of cases) {
      const explanation = buildExplanationFromCorrectionChange(item)
      expect(explanation.confidence).not.toBe('high')
    }
  })

  it('TEST 10: same input produces identical output', () => {
    const input = change('spelling', 'recieved', 'received')
    const options = { practiceTargetId: 'spelling:recieved' }
    const first = buildExplanationFromCorrectionChange(input, options)
    const second = buildExplanationFromCorrectionChange(input, options)

    expect(second).toEqual(first)
  })

  it('TEST 11: works without surrounding sentence context', () => {
    const explanation = buildExplanationFromCorrectionChange(
      change('grammar', 'go', 'goes'),
    )

    expect(explanation.incorrectExample).toBe('go')
    expect(explanation.correctExample).toBe('goes')
    expect(explanation.summary).not.toContain('He ')
  })

  it('TEST 12: malformed input is rejected', () => {
    expect(() =>
      buildExplanationFromCorrectionChange({
        type: 'spelling',
        original: '',
        corrected: 'received',
        start: 0,
        end: 0,
      }),
    ).toThrow(/invalid_correction_pair/)

    expect(() =>
      buildExplanationFromCorrectionChange({
        type: 'spelling',
        original: 'recieved',
        corrected: 'recieved',
        start: 0,
        end: 8,
      }),
    ).toThrow(/invalid_correction_pair/)

    expect(() =>
      buildExplanationFromCorrectionChange(
        change('spelling', 'recieved', 'received'),
        { practiceTargetId: 'grammar:recieved' },
      ),
    ).toThrow(/invalid_practice_target_id/)

    expect(() =>
      buildExplanationFromCorrectionChange(change('layout', 'lvpfh', 'hello'), {
        practiceTargetId: 'layout:lvpfh',
      }),
    ).toThrow(/layout_practice_target_not_allowed/)
  })

  describe('invariant properties', () => {
    const samples: CorrectionChange[] = [
      change('spelling', 'recieved', 'received'),
      change('wording', 'make a photo', 'take a photo'),
      change('grammar', 'go', 'goes'),
      change('grammar', 'get', 'got'),
      change('layout', 'lvpfh', 'hello'),
    ]

    it('never creates trusted_rule explanations', () => {
      for (const item of samples) {
        const explanation = buildExplanationFromCorrectionChange(item)
        expect(explanation.source).not.toBe('trusted_rule')
        expect(explanation.ruleId).toBeUndefined()
        expect(explanation.ruleTitle).toBeUndefined()
      }
    })

    it('never assigns HIGH confidence', () => {
      for (const item of samples) {
        const explanation = buildExplanationFromCorrectionChange(item)
        expect(explanation.confidence).not.toBe('high')
      }
    })

    it('layout summaries never frame English grammar', () => {
      const explanation = buildExplanationFromCorrectionChange(
        change('layout', 'lvpfh', 'hello'),
      )
      expect(explanation.category).toBe('layout')
      expect(explanation.summary.toLowerCase()).toContain('keyboard')
      expect(explanation.summary.toLowerCase()).not.toMatch(/\bgrammar\b/)
    })
  })
})
