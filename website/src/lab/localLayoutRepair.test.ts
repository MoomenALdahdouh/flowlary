import { describe, expect, it } from 'vitest'
import { mergeLayoutAndCorrection, repairKeyboardLayoutLocally } from './localLayoutRepair.ts'

const TYPED = 'مرحبا hello how are you are you ؤخةةهىل خق ىخف نعم hkh rh]l hghk'
const FIXED = 'مرحبا hello how are you are you comming or not نعم انا قادم الان'

describe('Writing Lab local keyboard repair', () => {
  it('repairs the reported bilingual keyboard-mix sentence', () => {
    const result = repairKeyboardLayoutLocally(TYPED)
    expect(result.text).toBe(FIXED)
    expect(result.changes.some((change) => change.corrected === 'comming or not')).toBe(true)
    expect(result.changes.some((change) => change.corrected === 'انا قادم الان')).toBe(true)
  })

  it('keeps intentional mixed product English', () => {
    const text = 'أنا عملت deploy لكن فيه error'
    expect(repairKeyboardLayoutLocally(text).text).toBe(text)
  })

  it('merges local layout with a later English correction', () => {
    const layout = repairKeyboardLayoutLocally(TYPED)
    const merged = mergeLayoutAndCorrection(TYPED, layout, {
      originalText: layout.text,
      correctedText: layout.text.replace('comming', 'coming'),
      changes: [
        { type: 'spelling', original: 'comming', corrected: 'coming', start: 0, end: 7 },
      ],
    })
    expect(merged.originalText).toBe(TYPED)
    expect(merged.correctedText).toContain('coming')
    expect(merged.changes.some((change) => change.type === 'layout')).toBe(true)
    expect(merged.changes.some((change) => change.type === 'spelling')).toBe(true)
  })
})
