import type { HistoryEntry, HistoryOperation } from '@flowlary/shared'

export function operationLabel(operation: HistoryOperation): string {
  switch (operation) {
    case 'CORRECT':
      return 'Writing correction'
    case 'TRANSLATE':
      return 'Translation'
    case 'FIX_LAYOUT':
      return 'Layout fix'
    default:
      return operation
  }
}

export function formatHistoryTimestamp(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}

export function truncateHistoryText(text: string, max = 120): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export function historyMetaLine(entry: HistoryEntry): string | null {
  const parts: string[] = []
  if (entry.metadata?.mode) {
    parts.push(entry.metadata.mode === 'live' ? 'Live' : entry.metadata.mode === 'manual' ? 'Manual' : 'Automatic')
  }
  if (entry.metadata?.sourceLanguage && entry.metadata?.targetLanguage) {
    parts.push(`${entry.metadata.sourceLanguage} → ${entry.metadata.targetLanguage}`)
  }
  if (entry.domain) parts.push(entry.domain)
  return parts.length > 0 ? parts.join(' · ') : null
}
