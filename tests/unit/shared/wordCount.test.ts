import { describe, expect, it } from 'vitest'
import { countWords } from '@flowlary/shared'

describe('countWords', () => {
  it('counts simple sentences', () => {
    expect(countWords('Hello world.')).toBe(2)
    expect(countWords('Hello, world!')).toBe(2)
  })

  it('returns zero for empty and whitespace', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords('\n\t')).toBe(0)
  })

  it('is deterministic', () => {
    const text = 'I recieved your email yesterday.'
    expect(countWords(text)).toBe(countWords(text))
    expect(countWords(text)).toBe(5)
  })
})
