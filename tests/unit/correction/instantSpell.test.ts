import { describe, expect, it } from 'vitest'
import { applyInstantSpelling } from '../../../extension/src/features/correction/instantSpell.ts'

describe('instantSpell', () => {
  it('fixes known typos on word boundary', () => {
    expect(applyInstantSpelling('hello hwo ')).toBe('hello how ')
  })

  it('does not fix incomplete trailing token unless known typo', () => {
    expect(applyInstantSpelling('hello typ')).toBe('hello typ')
    expect(applyInstantSpelling('hello hwo')).toBe('hello how')
  })

  it('does not auto-replace short ambiguous tokens fo/ot/im', () => {
    expect(applyInstantSpelling('fo ')).toBe('fo ')
    expect(applyInstantSpelling('ot ')).toBe('ot ')
    expect(applyInstantSpelling('im ')).toBe('im ')
  })
})
