import { describe, expect, it } from 'vitest'
import { BRAND } from './types.ts'
import { FLOWLARY_MARK, FLOWLARY_MARK_COLORS } from './brand.ts'

describe('shared brand language', () => {
  it('keeps the product tagline and mark as the source of truth', () => {
    expect(BRAND.name).toBe('Flowlary')
    expect(BRAND.tagline).toBe('Your AI Writing Companion')
    expect(FLOWLARY_MARK.f).toContain('M9.2 7.7')
    expect(FLOWLARY_MARK.f).not.toContain('M9.2 9.4h10.1')
    expect(FLOWLARY_MARK.radius).toBe(8.5)
    expect(FLOWLARY_MARK_COLORS.accent).toBe('#14d4ea')
    expect(FLOWLARY_MARK_COLORS.onAccent).toBe('#061018')
    expect(FLOWLARY_MARK_COLORS.light.onAccent).toBe('#ffffff')
  })
})
