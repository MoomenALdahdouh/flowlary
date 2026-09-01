/** Sentence-island linguistic review. The model may propose span edits, never writes. */

export const WRITING_REVIEW_CONTRACT_VERSION = '1'
export const WRITING_REVIEW_MAX_SNIPPET = 400
export const WRITING_REVIEW_MAX_CONTEXT = 160
export const WRITING_REVIEW_MAX_EDITS = 8
export const WRITING_REVIEW_MAX_PROPOSED = 80

export const WRITING_REVIEW_SYSTEM_PROMPT = `You review one English writing island for correctness only. You are a reviewer, not a writer and not the final authority. Return one JSON object with keys verdict, ambiguityClass, reasonCode, and edits. verdict must be no_change, edits, uncertain, or preserve_all. ambiguityClass and reasonCode must each be a single snake_case token of 1-64 characters using only letters, digits, underscore, dot, colon, or hyphen. edits is an array of objects with keys start, end, original, proposed, kind, confidence. start is inclusive and end is exclusive, both relative to the supplied snippet only. original must equal snippet.slice(start, end). kind must be spelling, grammar, punctuation, or layout_suspect. confidence must be high, medium, or low. Prefer the smallest bounded correction. Do not rewrite the entire field. Do not polish style, tone, or wording. Do not change the user's meaning. Do not translate. Preserve Arabic, English, intentional Arabic/English mixing, names, slang, technical tokens, URLs, emails, JWTs, API keys, and code. Never invent a keyboard-layout mapping: layout_suspect is allowed only when proposed is the exact physical-key remap of original, never a paraphrase. If the island is already correct, mixed, unfinished, not English writing, or you are unsure, return verdict no_change or preserve_all with an empty edits array. Never include write, html, replacement of the whole field, DOM operations, or commands.`

const SAFE_CODE = /^[a-zA-Z0-9_.:-]{1,64}$/
const FORBIDDEN_KEY = /(replacement|write|html|mutation|command|dom|inputvalue|setrangetext|execcommand)/i
const ALLOWED_ROOT = new Set(['verdict', 'ambiguityClass', 'reasonCode', 'edits'])
const ALLOWED_EDIT = new Set(['start', 'end', 'original', 'proposed', 'kind', 'confidence'])
const VERDICTS = new Set(['no_change', 'edits', 'uncertain', 'preserve_all'])
const KINDS = new Set(['spelling', 'grammar', 'punctuation', 'layout_suspect'])
const CONFIDENCE = new Set(['high', 'medium', 'low'])

export type WritingReviewVerdict = 'no_change' | 'edits' | 'uncertain' | 'preserve_all'
export type WritingReviewEditKind =
  | 'spelling'
  | 'grammar'
  | 'punctuation'
  | 'layout_suspect'
export type WritingReviewConfidence = 'high' | 'medium' | 'low'

export type WritingReviewEdit = {
  start: number
  end: number
  original: string
  proposed: string
  kind: WritingReviewEditKind
  confidence: WritingReviewConfidence
}

export type WritingReviewResponse = {
  verdict: WritingReviewVerdict
  ambiguityClass: string
  reasonCode: string
  edits: WritingReviewEdit[]
}

export type WritingReviewPacket = {
  cycleId: string
  snippet: string
  contextBefore?: string
  contextAfter?: string
  allowedKinds: WritingReviewEditKind[]
}

export type WritingReviewParseFailure = {
  ok: false
  reason: 'malformed' | 'forbidden_field' | 'span_mismatch' | 'overlap' | 'limit'
}

export type WritingReviewParseSuccess = {
  ok: true
  value: WritingReviewResponse
}

export function parseWritingReviewContent(
  content: string | null | undefined,
  snippet: string,
): WritingReviewParseSuccess | WritingReviewParseFailure {
  if (!content?.trim()) return { ok: false, reason: 'malformed' }
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'malformed' }
  }
  const value = parsed as Record<string, unknown>
  const keys = Object.keys(value)
  if (keys.some((key) => FORBIDDEN_KEY.test(key) || !ALLOWED_ROOT.has(key))) {
    return { ok: false, reason: 'forbidden_field' }
  }
  if (
    typeof value.verdict !== 'string'
    || !VERDICTS.has(value.verdict)
    || typeof value.ambiguityClass !== 'string'
    || typeof value.reasonCode !== 'string'
    || !SAFE_CODE.test(value.ambiguityClass)
    || !SAFE_CODE.test(value.reasonCode)
    || !Array.isArray(value.edits)
  ) {
    return { ok: false, reason: 'malformed' }
  }
  if (value.edits.length > WRITING_REVIEW_MAX_EDITS) return { ok: false, reason: 'limit' }

  const edits: WritingReviewEdit[] = []
  for (const item of value.edits) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, reason: 'malformed' }
    }
    const edit = item as Record<string, unknown>
    if (Object.keys(edit).some((key) => FORBIDDEN_KEY.test(key) || !ALLOWED_EDIT.has(key))) {
      return { ok: false, reason: 'forbidden_field' }
    }
    if (
      typeof edit.start !== 'number'
      || typeof edit.end !== 'number'
      || !Number.isInteger(edit.start)
      || !Number.isInteger(edit.end)
      || typeof edit.original !== 'string'
      || typeof edit.proposed !== 'string'
      || typeof edit.kind !== 'string'
      || !KINDS.has(edit.kind)
      || typeof edit.confidence !== 'string'
      || !CONFIDENCE.has(edit.confidence)
    ) {
      return { ok: false, reason: 'malformed' }
    }
    if (edit.start < 0 || edit.end < edit.start || edit.end > snippet.length) {
      return { ok: false, reason: 'span_mismatch' }
    }
    if (edit.original !== snippet.slice(edit.start, edit.end)) {
      return { ok: false, reason: 'span_mismatch' }
    }
    if (edit.proposed.length > WRITING_REVIEW_MAX_PROPOSED) return { ok: false, reason: 'limit' }
    if (edit.proposed === edit.original) continue
    edits.push({
      start: edit.start,
      end: edit.end,
      original: edit.original,
      proposed: edit.proposed,
      kind: edit.kind as WritingReviewEditKind,
      confidence: edit.confidence as WritingReviewConfidence,
    })
  }

  edits.sort((a, b) => a.start - b.start)
  for (let i = 1; i < edits.length; i += 1) {
    if (edits[i]!.start < edits[i - 1]!.end) return { ok: false, reason: 'overlap' }
  }

  const verdict = value.verdict as WritingReviewVerdict
  if (verdict === 'edits' && edits.length === 0) return { ok: false, reason: 'malformed' }
  if (verdict !== 'edits' && edits.length > 0) {
    return {
      ok: true,
      value: {
        verdict: 'edits',
        ambiguityClass: value.ambiguityClass,
        reasonCode: value.reasonCode,
        edits,
      },
    }
  }

  return {
    ok: true,
    value: {
      verdict,
      ambiguityClass: value.ambiguityClass,
      reasonCode: value.reasonCode,
      edits: verdict === 'edits' ? edits : [],
    },
  }
}

export const WRITING_REVIEW_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'ambiguityClass', 'reasonCode', 'edits'],
  properties: {
    verdict: { type: 'string' },
    ambiguityClass: { type: 'string' },
    reasonCode: { type: 'string' },
    edits: {
      type: 'array',
      maxItems: WRITING_REVIEW_MAX_EDITS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['start', 'end', 'original', 'proposed', 'kind', 'confidence'],
        properties: {
          start: { type: 'integer' },
          end: { type: 'integer' },
          original: { type: 'string' },
          proposed: { type: 'string' },
          kind: { type: 'string' },
          confidence: { type: 'string' },
        },
      },
    },
  },
} as const
