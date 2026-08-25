import { MAX_CACHE_TEXT_LENGTH } from '@flowlary/shared'
import { isSensitiveText } from '../history/privacy.ts'

export function canCacheText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed.length > MAX_CACHE_TEXT_LENGTH) return false
  return !isSensitiveText(trimmed)
}

export function canCacheValue(value: unknown): boolean {
  if (typeof value === 'string') return canCacheText(value)
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.correctedText === 'string' && !canCacheText(record.correctedText)) return false
  if (typeof record.originalText === 'string' && !canCacheText(record.originalText)) return false
  if (typeof record.translation === 'string' && !canCacheText(record.translation)) return false
  if (typeof record.result === 'object' && record.result) {
    const result = record.result as Record<string, unknown>
    if (typeof record.corrected === 'string' && !canCacheText(String(record.corrected))) return false
    if (typeof result.kind === 'string' && typeof record.corrected === 'string') {
      return canCacheText(String(record.corrected))
    }
  }
  return true
}
