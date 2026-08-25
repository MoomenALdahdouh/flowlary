import type { HistoryEntry, HistoryOperation } from './types.ts'
import { sanitizeHistoryEntry } from './validation.ts'
import { isSensitiveText } from './privacy.ts'

type EwaLegacyItem = {
  id?: unknown
  timestamp?: unknown
  original?: unknown
  corrected?: unknown
}

type LayfixLegacyItem = {
  token?: unknown
  replacement?: unknown
  ts?: unknown
}

function mapEwaLegacy(item: EwaLegacyItem): HistoryEntry | null {
  const sourceText = typeof item.original === 'string' ? item.original : ''
  const resultText = typeof item.corrected === 'string' ? item.corrected : ''
  if (isSensitiveText(sourceText) || isSensitiveText(resultText)) return null
  const timestamp =
    typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)
      ? item.timestamp
      : Date.now()
  const id =
    typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : `legacy-ewa-${timestamp}-${sourceText.length}`
  return sanitizeHistoryEntry({
    id,
    operation: 'CORRECT' as HistoryOperation,
    timestamp,
    sourceText,
    resultText,
    metadata: { mode: 'automatic' },
  })
}

function mapLayfixLegacy(item: LayfixLegacyItem): HistoryEntry | null {
  const sourceText = typeof item.token === 'string' ? item.token : ''
  const resultText = typeof item.replacement === 'string' ? item.replacement : ''
  if (isSensitiveText(sourceText) || isSensitiveText(resultText)) return null
  const timestamp =
    typeof item.ts === 'number' && Number.isFinite(item.ts) ? item.ts : Date.now()
  const id = `legacy-layfix-${timestamp}-${sourceText}`
  return sanitizeHistoryEntry({
    id,
    operation: 'FIX_LAYOUT' as HistoryOperation,
    timestamp,
    sourceText,
    resultText,
    metadata: { mode: 'automatic' },
  })
}

export function importLegacyHistoryArrays(input: {
  ewa?: unknown[]
  layfix?: unknown[]
}): HistoryEntry[] {
  const imported: HistoryEntry[] = []
  const seen = new Set<string>()

  for (const raw of input.ewa ?? []) {
    const entry = mapEwaLegacy(raw as EwaLegacyItem)
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    imported.push(entry)
  }

  for (const raw of input.layfix ?? []) {
    const entry = mapLayfixLegacy(raw as LayfixLegacyItem)
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    imported.push(entry)
  }

  return imported
}

export function extractLegacyPreserve(raw: unknown): { ewa?: unknown[]; layfix?: unknown[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const value = raw as { ewa?: unknown; layfix?: unknown }
  return {
    ewa: Array.isArray(value.ewa) ? value.ewa : undefined,
    layfix: Array.isArray(value.layfix) ? value.layfix : undefined,
  }
}
