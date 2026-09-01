export const CORRECTION_DEFAULTS = {
  DEBOUNCE_MS: 120,
  WORD_BOUNDARY_DEBOUNCE_MS: 45,
  SENTENCE_BOUNDARY_DEBOUNCE_MS: 30,
  DIRECT_DEBOUNCE_MS: 90,
  DIRECT_WORD_BOUNDARY_DEBOUNCE_MS: 25,
  DIRECT_SENTENCE_BOUNDARY_DEBOUNCE_MS: 20,
  MIN_CHARS: 8,
  MIN_WORDS: 3,
  /** @deprecated Field-length gate removed — use extractWritingContext() bounds instead. */
  MAX_ASSIST_CHARS: 250,
  MAX_CORRECTION_CHARS: 2000,
  CACHE_LIMIT: 50,
  GROQ_MODEL_DEFAULT: 'openai/gpt-oss-20b',
} as const

export type ChangeType = 'spelling' | 'grammar' | 'wording' | 'layout'

export type CorrectionChange = {
  type: ChangeType
  original: string
  corrected: string
  start: number
  end: number
}

export type CorrectionResponse = {
  originalText: string
  correctedText: string
  changes: CorrectionChange[]
  /** Optional educational metadata — same order as `changes` (WL-4C-D+). */
  explanations?: import('../explanation/index.ts').RuleExplanation[]
}

export type CorrectRequestContext = {
  previousText?: string
  fieldType?: 'textarea' | 'text' | 'contenteditable' | 'other'
}

export const CORRECTION_SYSTEM_PROMPT = `Correct English spelling, grammar, punctuation, and obvious word-usage mistakes. Preserve meaning, tone, contractions, proper nouns, URLs, emails, code, numbers, and quoted text. Do not rewrite for style or add facts. If the text is already correct or is not English writing, return identical originalText and correctedText with empty changes. Return one JSON object only with keys originalText, correctedText, and changes. Each change must use keys type, original, corrected, start, end (not suggestion). Change types: spelling, grammar, wording. start/end are exclusive-end offsets in originalText. Prefer the smallest grammatical edit.

Good: "I want to go library tomorrow because I need study." → "I want to go to the library tomorrow because I need to study."
Bad: rewriting that into "I intend to visit the library tomorrow because I need to study."`

const TYPE_MAP: Record<string, ChangeType> = {
  spelling: 'spelling',
  grammar: 'grammar',
  wording: 'wording',
  punctuation: 'grammar',
  typo: 'spelling',
  style: 'wording',
  word: 'wording',
}

export function coerceCorrectionPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed
  const obj = parsed as Record<string, unknown>
  const changes = Array.isArray(obj.changes)
    ? obj.changes.map((item) => {
        if (!item || typeof item !== 'object') return item
        const change = item as Record<string, unknown>
        const corrected =
          typeof change.corrected === 'string'
            ? change.corrected
            : typeof change.suggestion === 'string'
              ? change.suggestion
              : change.corrected
        const rawType = typeof change.type === 'string' ? change.type.toLowerCase() : ''
        const type = TYPE_MAP[rawType] ?? 'grammar'
        const { suggestion: _suggestion, ...rest } = change
        return { ...rest, type, corrected }
      })
    : obj.changes
  return { ...obj, changes }
}

export function validateCorrectionResponse(
  parsed: unknown,
  sourceText: string,
): CorrectionResponse | null {
  const coerced = coerceCorrectionPayload(parsed)
  if (!coerced || typeof coerced !== 'object') return null
  const obj = coerced as Record<string, unknown>
  if (typeof obj.correctedText !== 'string') return null
  if (!Array.isArray(obj.changes)) return null

  const changes: CorrectionChange[] = []
  for (const item of obj.changes) {
    if (!item || typeof item !== 'object') continue
    const change = item as Record<string, unknown>
    if (
      typeof change.original !== 'string' ||
      typeof change.corrected !== 'string' ||
      typeof change.start !== 'number' ||
      typeof change.end !== 'number'
    ) {
      continue
    }
    const type = TYPE_MAP[String(change.type ?? '').toLowerCase()] ?? 'grammar'
    if (change.end < change.start || change.end > sourceText.length) continue
    changes.push({
      type,
      original: change.original,
      corrected: change.corrected,
      start: change.start,
      end: change.end,
    })
  }

  return {
    originalText: sourceText,
    correctedText: obj.correctedText,
    changes,
  }
}
