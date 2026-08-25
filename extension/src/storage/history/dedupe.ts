import type { HistoryEntry } from './types.ts'
import { HISTORY_DEDUPE_WINDOW_MS } from './types.ts'

export function historyDedupeKey(
  entry: Pick<HistoryEntry, 'operation' | 'sourceText' | 'resultText' | 'domain'>,
): string {
  return [entry.operation, entry.domain ?? '', entry.sourceText, entry.resultText].join('\0')
}

export function isDuplicateHistoryEntry(
  existing: readonly HistoryEntry[],
  candidate: HistoryEntry,
  windowMs = HISTORY_DEDUPE_WINDOW_MS,
): boolean {
  const key = historyDedupeKey(candidate)
  return existing.some(
    (item) =>
      historyDedupeKey(item) === key &&
      Math.abs(item.timestamp - candidate.timestamp) <= windowMs,
  )
}
