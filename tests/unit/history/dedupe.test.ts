import { describe, expect, it } from 'vitest'
import { isDuplicateHistoryEntry } from '../../../extension/src/storage/history/dedupe.ts'
import type { HistoryEntry } from '@flowlary/shared'

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: '1',
    operation: 'TRANSLATE',
    timestamp: 1_000,
    sourceText: 'hello',
    resultText: 'مرحبا',
    domain: 'example.com',
    ...overrides,
  }
}

describe('history deduplication', () => {
  it('treats duplicate events inside the window as duplicates', () => {
    const existing = [entry({ timestamp: 1_000 })]
    const candidate = entry({ id: '2', timestamp: 1_500 })
    expect(isDuplicateHistoryEntry(existing, candidate)).toBe(true)
  })

  it('allows legitimate repeated corrections outside the window', () => {
    const existing = [entry({ operation: 'CORRECT', timestamp: 1_000 })]
    const candidate = entry({
      operation: 'CORRECT',
      id: '2',
      timestamp: 10_000,
      sourceText: 'hello',
      resultText: 'Hello!',
    })
    expect(isDuplicateHistoryEntry(existing, candidate)).toBe(false)
  })

  it('allows different results for the same source', () => {
    const existing = [entry({ resultText: 'first' })]
    const candidate = entry({ id: '2', resultText: 'second', timestamp: 1_100 })
    expect(isDuplicateHistoryEntry(existing, candidate)).toBe(false)
  })

  it('uses operation, domain, source, and result in the dedupe key', () => {
    const existing = [entry({ domain: 'a.com' })]
    const candidate = entry({ id: '2', domain: 'b.com', timestamp: 1_100 })
    expect(isDuplicateHistoryEntry(existing, candidate)).toBe(false)
  })
})
