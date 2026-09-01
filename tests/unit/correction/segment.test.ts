import { describe, expect, it } from 'vitest'
import { CORRECTION_DEFAULTS } from '@flowlary/shared'
import { extractWritingContext } from '../../../extension/src/features/correction/segment.ts'
import {
  isEligibleForCorrection,
  shouldShowEnglishAssistant,
} from '../../../extension/src/features/correction/language.ts'

describe('segment extraction', () => {
  it('uses last paragraph in multi-paragraph text', () => {
    const text = 'First paragraph.\n\nSecond paragraph with more text.'
    expect(extractWritingContext(text)).toBe('Second paragraph with more text.')
  })

  it('returns full short single paragraph', () => {
    const text = 'Short english draft.'
    expect(extractWritingContext(text)).toBe(text)
  })

  it('bounds long single-paragraph drafts to recent window', () => {
    const paragraph = `${'Word '.repeat(400)}end.`
    const segment = extractWritingContext(paragraph)
    expect(segment.length).toBeLessThanOrEqual(CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS)
    expect(segment.length).toBeLessThanOrEqual(480)
    expect(segment).toMatch(/end\.$/)
  })

  it('bounds very long documents without returning the entire field', () => {
    const doc = Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1}. ${'token '.repeat(80)}`).join('\n\n')
    expect(doc.length).toBeGreaterThan(10_000)
    const segment = extractWritingContext(doc)
    expect(segment.length).toBeLessThanOrEqual(CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS)
    expect(segment).not.toBe(doc)
    expect(segment).toMatch(/Paragraph 50\./)
  })
})

describe('long-field correction eligibility', () => {
  const longEnglish = `${'I am writing a longer email message today. '.repeat(120)}Thanks.`

  it('allows assistant on bounded segment from long fields', () => {
    const segment = extractWritingContext(longEnglish)
    expect(segment.length).toBeLessThanOrEqual(CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS)
    expect(shouldShowEnglishAssistant(segment)).toBe(true)
    expect(isEligibleForCorrection(segment)).toBe(true)
  })

  it('does not require the entire document to fit assist bounds', () => {
    expect(longEnglish.length).toBeGreaterThan(250)
    expect(longEnglish.length).toBeGreaterThan(CORRECTION_DEFAULTS.MAX_ASSIST_CHARS)
    const segment = extractWritingContext(longEnglish)
    expect(isEligibleForCorrection(segment)).toBe(true)
  })
})
