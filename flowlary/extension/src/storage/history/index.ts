export type {
  HistoryEntry,
  HistoryEntryMetadata,
  HistoryFieldKind,
  HistoryMode,
  HistoryOperation,
  HistoryRecordInput,
  HistoryStats,
  HistoryStoreV1,
} from './types.ts'

export {
  HISTORY_DEDUPE_WINDOW_MS,
  HISTORY_STORE_VERSION,
  MAX_HISTORY_ENTRIES,
  MAX_HISTORY_TEXT_LENGTH,
} from './types.ts'

export {
  canRecordHistory,
  fieldKindFromElement,
  isSensitiveText,
  normalizeHistoryDomain,
} from './privacy.ts'

export {
  normalizeHistoryStore,
  sanitizeHistoryEntry,
  sortHistoryEntries,
  pruneHistoryEntries,
} from './validation.ts'

export { historyDedupeKey, isDuplicateHistoryEntry } from './dedupe.ts'
export { importLegacyHistoryArrays, extractLegacyPreserve } from './legacyImport.ts'

export {
  HistoryService,
  getHistoryService,
  resetHistoryServiceForTests,
} from './service.ts'

export { recordHistory, ensureHistoryInitialized } from './record.ts'
