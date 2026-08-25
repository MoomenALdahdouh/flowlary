import { describe, expect, it } from 'vitest'
import { importLegacyHistoryArrays } from '../../../extension/src/storage/history/legacyImport.ts'

describe('legacy history import', () => {
  it('imports EWA correction history', () => {
    const entries = importLegacyHistoryArrays({
      ewa: [{ id: '1', timestamp: 100, original: 'dont', corrected: "don't" }],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.operation).toBe('CORRECT')
    expect(entries[0]?.sourceText).toBe('dont')
  })

  it('imports Layfix layout history', () => {
    const entries = importLegacyHistoryArrays({
      layfix: [{ token: 'lvpfh', replacement: 'مرحبا', ts: 200 }],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.operation).toBe('FIX_LAYOUT')
  })

  it('deduplicates legacy entries by id', () => {
    const entries = importLegacyHistoryArrays({
      ewa: [
        { id: 'dup', timestamp: 1, original: 'a', corrected: 'b' },
        { id: 'dup', timestamp: 2, original: 'c', corrected: 'd' },
      ],
    })
    expect(entries).toHaveLength(1)
  })

  it('rejects sensitive legacy entries', () => {
    const entries = importLegacyHistoryArrays({
      ewa: [{ id: '1', timestamp: 1, original: 'gsk_123456789012345678901234567890', corrected: 'x' }],
    })
    expect(entries).toHaveLength(0)
  })

  it('returns empty for missing legacy arrays', () => {
    expect(importLegacyHistoryArrays({})).toEqual([])
  })
})
