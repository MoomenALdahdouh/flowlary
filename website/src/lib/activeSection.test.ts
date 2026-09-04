import { describe, expect, it } from 'vitest'
import { resolveActiveSectionId } from '../lib/activeSection.ts'

describe('resolveActiveSectionId', () => {
  const ids = ['agreement', 'availability', 'changes']

  it('returns the last section that has crossed the header offset', () => {
    const tops: Record<string, number> = {
      agreement: -400,
      availability: 40,
      changes: 800,
    }
    expect(resolveActiveSectionId(ids, (id) => tops[id], 112)).toBe('availability')
  })

  it('stays on the first section before anything crosses', () => {
    const tops: Record<string, number> = {
      agreement: 200,
      availability: 600,
      changes: 1200,
    }
    expect(resolveActiveSectionId(ids, (id) => tops[id], 112)).toBe('agreement')
  })

  it('skips missing sections', () => {
    expect(
      resolveActiveSectionId(ids, (id) => (id === 'agreement' ? null : id === 'availability' ? -10 : 400), 112),
    ).toBe('availability')
  })

  it('returns empty when nothing is in the document', () => {
    expect(resolveActiveSectionId(ids, () => null, 112)).toBe('')
  })
})
