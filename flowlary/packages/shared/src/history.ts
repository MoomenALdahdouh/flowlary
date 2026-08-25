import type { OperationType } from './types.ts'

/** Supported history operations (PIPELINE deferred). */
export type HistoryOperation = Extract<OperationType, 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT'>

export type HistoryMode = 'manual' | 'automatic' | 'live'

export type HistoryFieldKind = 'textarea' | 'text' | 'contenteditable' | 'unknown'

export type HistoryEntryMetadata = {
  mode?: HistoryMode
  sourceLanguage?: string
  targetLanguage?: string
  sourceLayout?: string
  targetLayout?: string
}

export type HistoryEntry = {
  id: string
  operation: HistoryOperation
  timestamp: number
  domain?: string
  fieldKind?: HistoryFieldKind
  sourceText: string
  resultText: string
  metadata?: HistoryEntryMetadata
}

export type HistoryStoreV1 = {
  version: 1
  entries: HistoryEntry[]
  legacyImported?: boolean
}

export type HistoryStats = {
  total: number
  byOperation: Record<HistoryOperation, number>
}

export const HISTORY_STORE_VERSION = 1 as const
export const MAX_HISTORY_ENTRIES = 50
export const MAX_HISTORY_TEXT_LENGTH = 2_000
export const HISTORY_DEDUPE_WINDOW_MS = 5_000
