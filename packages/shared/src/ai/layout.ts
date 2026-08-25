export const LAYOUT_CLASSIFIER_SYSTEM_PROMPT = `You classify whether a single word token is valid in its typed keyboard layout or should be remapped to another candidate layout. Respond with JSON only: {"kind":"VALID"} or {"kind":"LAYOUT_MISMATCH","target_layout":"<layout-id>"}. Prefer VALID when the word is a plausible word/identifier in the source layout. Use LAYOUT_MISMATCH only when the token is clearly typed on the wrong layout and maps cleanly to one candidate.`

export type LayoutClassificationRequestBody = {
  word: string
  context?: string
  source_layout: string
  candidate_layouts: string[]
}

export type LayoutClassificationResult = {
  kind: 'VALID' | 'LAYOUT_MISMATCH'
  target_layout?: string | null
}

export type LayoutClassificationResponseBody = {
  ok: true
  result: LayoutClassificationResult
  requestId?: string
  model?: string
}
