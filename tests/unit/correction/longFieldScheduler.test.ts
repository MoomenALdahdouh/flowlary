import { describe, expect, it } from 'vitest'
import { CORRECTION_DEFAULTS } from '@flowlary/shared'
import { extractWritingContext } from '../../../extension/src/features/correction/segment.ts'
import { shouldShowEnglishAssistant } from '../../../extension/src/features/correction/language.ts'

describe('long-field scheduler gate', () => {
  it('keeps scheduling eligible for 500-char fields via bounded segment', () => {
    const text = `${'Draft sentence number one. '.repeat(18)}Final sentence here.`
    expect(text.length).toBeGreaterThan(500)
    const segment = extractWritingContext(text)
    expect(segment.length).toBeLessThanOrEqual(CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS)
    expect(shouldShowEnglishAssistant(segment)).toBe(true)
  })

  it('keeps scheduling eligible for 5,000-char contenteditable drafts', () => {
    const text = `${'Another paragraph chunk for testing. '.repeat(140)}Done now.`
    expect(text.length).toBeGreaterThan(5_000)
    const segment = extractWritingContext(text)
    expect(segment.length).toBeLessThanOrEqual(CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS)
    expect(shouldShowEnglishAssistant(segment)).toBe(true)
  })
})
