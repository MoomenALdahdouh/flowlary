import { describe, expect, it } from 'vitest'
import { buildLayoutExamples, MARKETING_LAYOUT_EXAMPLE, PRIMARY_LAYOUT_EXAMPLE, repairLayoutText } from '../lib/layoutDemo.ts'

describe('layoutDemo', () => {
  it('maps hgfdj to البيت using the real engine', () => {
    expect(repairLayoutText('hgfdj')).toBe('البيت')
    expect(PRIMARY_LAYOUT_EXAMPLE.intended).toBe('البيت')
  })

  it('uses the marketing keyboard-fix example for homepage demos', () => {
    expect(MARKETING_LAYOUT_EXAMPLE.typed).toBe('lgh hgkhs')
    expect(MARKETING_LAYOUT_EXAMPLE.intended).toBe('أنا هنا')
  })

  it('builds golden examples from ARABIC_GOLDEN', () => {
    const examples = buildLayoutExamples()
    expect(examples.some((ex) => ex.typed === 'lvpfh' && ex.intended === 'مرحبا')).toBe(true)
    expect(examples.some((ex) => ex.typed === 'hgfdj')).toBe(true)
  })
})
