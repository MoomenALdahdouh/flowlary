import { describe, expect, it } from 'vitest'
import { correctEnglishToken } from '@flowlary/shared'

describe('correctEnglishToken', () => {
  it('inserts a missing letter instead of highlighting a shorter real word', () => {
    expect(correctEnglishToken('coplete')).toBe('complete')
    expect(correctEnglishToken('Coplete')).toBe('Complete')
  })

  it('does not chop stoped down to stop', () => {
    expect(correctEnglishToken('stoped')).toBe('stopped')
    expect(correctEnglishToken('stop')).toBeNull()
  })

  it('still recovers dropped-letter stems and does not chop to a shorter word', () => {
    expect(correctEnglishToken('manul')).toBe('manual')
    expect(correctEnglishToken('guid')).toBe('guide')
    expect(correctEnglishToken('setp')).toBe('setup')
    expect(correctEnglishToken('setp')).not.toBe('set')
  })
})
