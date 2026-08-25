import { describe, expect, it } from 'vitest'
import {
  formatHistoryTimestamp,
  historyMetaLine,
  operationLabel,
  truncateHistoryText,
} from '../../../extension/src/popup/history.ts'
import type { HistoryEntry } from '@flowlary/shared'

describe('popup history helpers', () => {
  it('labels operations for UI', () => {
    expect(operationLabel('CORRECT')).toBe('Writing correction')
    expect(operationLabel('TRANSLATE')).toBe('Translation')
    expect(operationLabel('FIX_LAYOUT')).toBe('Layout fix')
  })

  it('formats timestamps', () => {
    expect(formatHistoryTimestamp(1_700_000_000_000)).toMatch(/\d/)
  })

  it('truncates long text', () => {
    const long = 'a'.repeat(200)
    expect(truncateHistoryText(long).endsWith('…')).toBe(true)
    expect(truncateHistoryText('short')).toBe('short')
  })

  it('builds metadata lines', () => {
    const entry: HistoryEntry = {
      id: '1',
      operation: 'TRANSLATE',
      timestamp: 1,
      sourceText: 'a',
      resultText: 'b',
      domain: 'example.com',
      metadata: { mode: 'live', sourceLanguage: 'en', targetLanguage: 'ar' },
    }
    expect(historyMetaLine(entry)).toContain('Live')
    expect(historyMetaLine(entry)).toContain('en → ar')
    expect(historyMetaLine(entry)).toContain('example.com')
  })
})
