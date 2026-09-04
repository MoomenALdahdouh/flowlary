import type { CorrectionResponse } from '@flowlary/shared'
import type { BoxState } from '../../../core/runtime/suggestion.ts'

export type CardState = 'hidden' | 'idle' | 'analyzing' | 'ready' | 'error'

/** Metadata bound to a visible suggestion for stale verification before accept. */
export type CorrectionSuggestionBinding = {
  remoteRequestId: string
  debouncerGeneration: number
  fieldGeneration: number
  segment: string
  requestedFullText: string
  response: CorrectionResponse
  operationId?: string
  revision?: number
  fieldId?: string
  snapshotFullText?: string
  snapshotHash?: string
  range?: { start: number; end: number }
  rangeText?: string
  replacement?: string
  boxState?: BoxState
}
