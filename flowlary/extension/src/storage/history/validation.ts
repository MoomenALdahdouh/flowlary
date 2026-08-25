import type { HistoryEntry, HistoryOperation, HistoryStoreV1 } from './types.ts'
import {
  HISTORY_STORE_VERSION,
  MAX_HISTORY_ENTRIES,
  MAX_HISTORY_TEXT_LENGTH,
} from './types.ts'

const OPERATIONS = new Set<HistoryOperation>(['CORRECT', 'TRANSLATE', 'FIX_LAYOUT'])
const MODES = new Set(['manual', 'automatic', 'live'])
const FIELD_KINDS = new Set(['textarea', 'text', 'contenteditable', 'unknown'])

export function isValidOperation(value: unknown): value is HistoryOperation {
  return typeof value === 'string' && OPERATIONS.has(value as HistoryOperation)
}

export function sanitizeHistoryEntry(raw: unknown): HistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<HistoryEntry>
  if (typeof value.id !== 'string' || !value.id.trim()) return null
  if (!isValidOperation(value.operation)) return null
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp) || value.timestamp <= 0) {
    return null
  }
  if (typeof value.sourceText !== 'string' || typeof value.resultText !== 'string') return null
  if (!value.sourceText.trim() || !value.resultText.trim()) return null
  if (value.sourceText === value.resultText) return null
  if (
    value.sourceText.length > MAX_HISTORY_TEXT_LENGTH ||
    value.resultText.length > MAX_HISTORY_TEXT_LENGTH
  ) {
    return null
  }

  const entry: HistoryEntry = {
    id: value.id.trim(),
    operation: value.operation,
    timestamp: Math.floor(value.timestamp),
    sourceText: value.sourceText,
    resultText: value.resultText,
  }

  if (typeof value.domain === 'string' && value.domain.trim()) {
    entry.domain = value.domain.trim().toLowerCase().replace(/^www\./, '')
  }

  if (typeof value.fieldKind === 'string' && FIELD_KINDS.has(value.fieldKind)) {
    entry.fieldKind = value.fieldKind as HistoryEntry['fieldKind']
  }

  if (value.metadata && typeof value.metadata === 'object') {
    const meta = value.metadata as HistoryEntry['metadata']
    const next: NonNullable<HistoryEntry['metadata']> = {}
    if (meta?.mode && MODES.has(meta.mode)) next.mode = meta.mode
    if (typeof meta?.sourceLanguage === 'string') next.sourceLanguage = meta.sourceLanguage
    if (typeof meta?.targetLanguage === 'string') next.targetLanguage = meta.targetLanguage
    if (typeof meta?.sourceLayout === 'string') next.sourceLayout = meta.sourceLayout
    if (typeof meta?.targetLayout === 'string') next.targetLayout = meta.targetLayout
    if (Object.keys(next).length > 0) entry.metadata = next
  }

  return entry
}

export function normalizeHistoryStore(raw: unknown): HistoryStoreV1 {
  if (!raw || typeof raw !== 'object') {
    return { version: HISTORY_STORE_VERSION, entries: [] }
  }

  const value = raw as Partial<HistoryStoreV1 & { ewa?: unknown[]; layfix?: unknown[]; _v?: number }>

  if (Array.isArray(value.entries)) {
    const entries = value.entries
      .map((item) => sanitizeHistoryEntry(item))
      .filter((item): item is HistoryEntry => item != null)
    return {
      version: HISTORY_STORE_VERSION,
      entries: sortHistoryEntries(entries).slice(0, MAX_HISTORY_ENTRIES),
      legacyImported: value.legacyImported === true,
    }
  }

  return {
    version: HISTORY_STORE_VERSION,
    entries: [],
    legacyImported: false,
  }
}

export function sortHistoryEntries(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp
    return b.id.localeCompare(a.id)
  })
}

export function pruneHistoryEntries(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return sortHistoryEntries(entries).slice(0, MAX_HISTORY_ENTRIES)
}
