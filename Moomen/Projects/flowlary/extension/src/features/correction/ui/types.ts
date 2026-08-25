import type { CorrectionResponse } from '@flowlary/shared'

export type CardState = 'hidden' | 'idle' | 'analyzing' | 'ready' | 'error'

/** Metadata bound to a visible suggestion for stale verification before accept. */
export type CorrectionSuggestionBinding = {
  remoteRequestId: string
  debouncerGeneration: number
  fieldGeneration: number
  segment: string
  requestedFullText: string
  response: CorrectionResponse
}
