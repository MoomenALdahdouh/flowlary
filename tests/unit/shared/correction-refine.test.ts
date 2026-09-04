import { describe, expect, it } from 'vitest'
import {
  applyLocalEnglishRepair,
  deriveCorrectionChanges,
  tightenCorrectionPair,
  validateCorrectionResponse,
} from '@flowlary/shared'

describe('tightenCorrectionPair', () => {
  it('reduces a sentence-level pair to the misspelled word', () => {
    const original = 'hell how are you are you okay if you nee help I can hel yuo'
    const corrected = 'hell how are you are you okay if you nee help I can hel you'
    expect(tightenCorrectionPair(original, corrected)).toEqual({
      original: 'yuo',
      corrected: 'you',
    })
  })
})

describe('deriveCorrectionChanges', () => {
  it('emits one change per misspelled word', () => {
    const original = 'if you nee help I can hel you'
    const corrected = 'if you need help I can help you'
    const changes = deriveCorrectionChanges(original, corrected)
    expect(changes.map((change) => `${change.original}->${change.corrected}`)).toEqual([
      'nee->need',
      'hel->help',
    ])
  })

  it('treats a missing function word as grammar on the following word', () => {
    const changes = deriveCorrectionChanges('I need study', 'I need to study')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.original).toBe('study')
    expect(changes[0]?.corrected).toBe('to study')
    expect(changes[0]?.type).toBe('grammar')
  })
})

describe('validateCorrectionResponse', () => {
  it('repairs leftover typos and records word-level changes', () => {
    const source = 'hell how are you if you nee help I can hel yuo'
    const validated = validateCorrectionResponse(
      {
        originalText: source,
        correctedText: source.replace('yuo', 'you'),
        changes: [
          {
            type: 'spelling',
            original: source,
            corrected: source.replace('yuo', 'you'),
            start: 0,
            end: source.length,
          },
        ],
      },
      source,
    )
    expect(validated).not.toBeNull()
    expect(validated!.correctedText).toContain('need')
    expect(validated!.correctedText).toContain('help')
    expect(validated!.correctedText).toMatch(/hello/i)
    expect(validated!.changes.some((change) => change.original === 'yuo' && change.corrected === 'you')).toBe(true)
    expect(validated!.changes.some((change) => change.original === 'nee' && change.corrected === 'need')).toBe(true)
    expect(validated!.changes.some((change) => change.original === 'hel' && change.corrected === 'help')).toBe(true)
  })
})

describe('applyLocalEnglishRepair', () => {
  it('fixes greeting and leftover learner typos', () => {
    expect(applyLocalEnglishRepair('hell how are you if you nee hel')).toBe(
      'Hello, how are you if you need help.',
    )
    expect(applyLocalEnglishRepair('hell hwo are yuo')).toBe('Hello, how are you?')
    expect(applyLocalEnglishRepair('hell hwo are yuo are yuo comming')).toBe(
      'Hello, how are you? Are you coming?',
    )
    expect(applyLocalEnglishRepair('Please recieve the files')).toBe('Please receive the files.')
    expect(applyLocalEnglishRepair('if you nee help ')).toBe('if you need help ')
  })

  it('fixes native English: homophones and stacked questions', () => {
    expect(
      applyLocalEnglishRepair('hell hwo are yuo are yuo comming or not let me now'),
    ).toBe('Hello, how are you? Are you coming or not? Let me know.')
    expect(applyLocalEnglishRepair('Let me now')).toBe('Let me know.')
    expect(applyLocalEnglishRepair('See you right now')).toBe('See you right now.')
  })

  it('fixes dropped-letter spellings, not only capitals', () => {
    expect(applyLocalEnglishRepair('manul testng setp guid')).toBe(
      'Manual testing setup guide.',
    )
  })

  it('restores contractions and quotation marks for spoken intent', () => {
    expect(applyLocalEnglishRepair('im so tired')).toBe("I'm so tired.")
    expect(applyLocalEnglishRepair('she said im tired')).toBe('She said, "I\'m tired."')
    expect(applyLocalEnglishRepair('He said "hello how are you')).toBe('He said, "Hello, how are you?"')
    expect(applyLocalEnglishRepair("''thanks a lot''")).toBe('"Thanks a lot."')
  })

  it('does not chop learner past tense or leave complete unfixed', () => {
    expect(applyLocalEnglishRepair('Coplete where you are stoped')).toBe(
      'Complete where you are stopped.',
    )
    expect(applyLocalEnglishRepair('complet wher yuo are stope')).toBe(
      'Complete where you are stopped.',
    )
    expect(applyLocalEnglishRepair('Please coplete the form')).toBe('Please complete the form.')
  })
})
