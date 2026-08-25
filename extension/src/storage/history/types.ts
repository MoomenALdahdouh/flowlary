export type {
  HistoryEntry,
  HistoryEntryMetadata,
  HistoryFieldKind,
  HistoryMode,
  HistoryOperation,
  HistoryStats,
  HistoryStoreV1,
} from '@flowlary/shared'

export {
  HISTORY_DEDUPE_WINDOW_MS,
  HISTORY_STORE_VERSION,
  MAX_HISTORY_ENTRIES,
  MAX_HISTORY_TEXT_LENGTH,
} from '@flowlary/shared'

export type HistoryRecordInput = {
  operation: import('@flowlary/shared').HistoryOperation
  element: Element
  sourceText: string
  resultText: string
  mode?: import('@flowlary/shared').HistoryMode
  metadata?: import('@flowlary/shared').HistoryEntryMetadata
  timestamp?: number
}
