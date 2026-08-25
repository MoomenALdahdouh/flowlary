import { describe, expect, it } from 'vitest'
import { extractWritingContext } from '../../../extension/src/features/correction/segment.ts'

describe('segment extraction', () => {
  it('uses last paragraph in multi-paragraph text', () => {
    const text = 'First paragraph.\n\nSecond paragraph with more text.'
    expect(extractWritingContext(text)).toBe('Second paragraph with more text.')
  })

  it('returns full short single paragraph', () => {
    const text = 'Short english draft.'
    expect(extractWritingContext(text)).toBe(text)
  })
})
