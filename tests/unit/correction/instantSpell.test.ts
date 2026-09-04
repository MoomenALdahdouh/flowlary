import { describe, expect, it } from 'vitest'
import { applyIdleEnglishRepair, applyInstantSpelling } from '../../../extension/src/features/correction/instantSpell.ts'

describe('instantSpell', () => {
  it('fixes known typos on word boundary', () => {
    expect(applyInstantSpelling('hello hwo ')).toBe('Hello, how ')
  })

  it('does not fix incomplete trailing token unless known typo', () => {
    expect(applyInstantSpelling('hello typ')).toBe('Hello typ')
    expect(applyInstantSpelling('hello hwo')).toBe('Hello, how')
  })

  it('does not auto-replace short ambiguous tokens fo/ot/im', () => {
    expect(applyInstantSpelling('fo ')).toBe('fo ')
    expect(applyInstantSpelling('ot ')).toBe('ot ')
    expect(applyInstantSpelling('im ')).toBe('im ')
  })

  it('fixes leftover learner typos and greeting context', () => {
    expect(applyInstantSpelling('if you nee help ')).toBe('if you need help ')
    expect(applyInstantSpelling('I can hel ')).toBe('I can help ')
    expect(applyInstantSpelling('hell hwo are yuo')).toBe('Hello, how are you?')
  })

  it('idle repair includes the last word so let me now becomes know', () => {
    expect(applyInstantSpelling('Let me now')).toBe('Let me now')
    expect(applyIdleEnglishRepair('Let me now')).toBe('Let me know.')
    expect(applyIdleEnglishRepair('hell hwo are yuo are yuo comming or not let me now')).toBe(
      'Hello, how are you? Are you coming or not? Let me know.',
    )
  })
})
