import { describe, expect, it } from 'vitest'
import {
  MAX_HISTORY_TEXT_LENGTH,
  sanitizeHistoryEntry,
  normalizeHistoryStore,
  sortHistoryEntries,
} from '../../../extension/src/storage/history/validation.ts'
import type { HistoryEntry } from '@flowlary/shared'

function validEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'entry-1',
    operation: 'CORRECT',
    timestamp: 1_700_000_000_000,
    sourceText: 'hello world',
    resultText: 'Hello world',
    ...overrides,
  }
}

describe('history validation', () => {
  it('accepts a valid entry', () => {
    expect(sanitizeHistoryEntry(validEntry())).toMatchObject({
      id: 'entry-1',
      operation: 'CORRECT',
    })
  })

  it('rejects invalid operation', () => {
    expect(sanitizeHistoryEntry({ ...validEntry(), operation: 'PIPELINE' })).toBeNull()
  })

  it('rejects invalid timestamp', () => {
    expect(sanitizeHistoryEntry({ ...validEntry(), timestamp: 0 })).toBeNull()
    expect(sanitizeHistoryEntry({ ...validEntry(), timestamp: Number.NaN })).toBeNull()
  })

  it('rejects empty or identical text', () => {
    expect(sanitizeHistoryEntry({ ...validEntry(), sourceText: '   ' })).toBeNull()
    expect(sanitizeHistoryEntry({ ...validEntry(), resultText: '' })).toBeNull()
    expect(sanitizeHistoryEntry({ ...validEntry(), sourceText: 'same', resultText: 'same' })).toBeNull()
  })

  it('rejects oversized text', () => {
    const long = 'a'.repeat(MAX_HISTORY_TEXT_LENGTH + 1)
    expect(sanitizeHistoryEntry({ ...validEntry(), sourceText: long })).toBeNull()
    expect(sanitizeHistoryEntry({ ...validEntry(), resultText: long })).toBeNull()
  })

  it('ignores malformed stored entries without crashing', () => {
    const store = normalizeHistoryStore({
      version: 1,
      entries: [
        validEntry(),
        { id: '', operation: 'CORRECT', timestamp: 1, sourceText: 'a', resultText: 'b' },
        null,
        'bad',
        { id: 'x', operation: 'NOPE', timestamp: 1, sourceText: 'a', resultText: 'b' },
      ],
    })
    expect(store.entries).toHaveLength(1)
  })

  it('sorts newest-first with deterministic id tie-break', () => {
    const sorted = sortHistoryEntries([
      validEntry({ id: 'a', timestamp: 100 }),
      validEntry({ id: 'c', timestamp: 200 }),
      validEntry({ id: 'b', timestamp: 200 }),
    ])
    expect(sorted.map((entry) => entry.id)).toEqual(['c', 'b', 'a'])
  })
})
