import type { ClassificationResult, LayoutId } from '../layouts/types.ts'

export type CacheRecord = {
  result: ClassificationResult
  targetLayout?: LayoutId
  corrected?: string
  ts: number
}

export const WORD_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function toCacheRecord(
  result: ClassificationResult,
  extras: { corrected?: string; ts?: number } = {},
): CacheRecord {
  return {
    result,
    targetLayout: result.kind === 'LAYOUT_MISMATCH' ? result.targetLayout : undefined,
    corrected: extras.corrected,
    ts: extras.ts ?? Date.now(),
  }
}

export type HotPathDecision =
  | { kind: 'correct'; record: CacheRecord; corrected: string }
  | { kind: 'valid' }
  | { kind: 'miss' }

export function decideHotPath(
  get: (key: string) => CacheRecord | undefined,
  key: string,
): HotPathDecision {
  const record = get(key)
  if (!record) return { kind: 'miss' }
  if (record.result.kind !== 'LAYOUT_MISMATCH') return { kind: 'valid' }
  const corrected = record.corrected
  if (!corrected) return { kind: 'valid' }
  return { kind: 'correct', record, corrected }
}
