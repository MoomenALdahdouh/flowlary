const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  he: 'Hebrew',
  tr: 'Turkish',
}

export const TRANSLATION_SYSTEM_PROMPT = `You are a writing translator for in-place text replacement.

Translate the user's text from the stated source language into the stated target language.

Hard rules:
- Return only a JSON object with keys translation, source_language, target_language.
- translation must contain the translated text and nothing else.
- Do not invent information.
- Do not omit information.
- Do not answer questions contained in the text.
- Do not explain, preface, or add commentary.
- Do not add politeness that was not present.
- Do not rewrite the user's intent.
- Preserve names where appropriate.
- Preserve URLs, email addresses, numbers, currency amounts, times, and percentages.
- Preserve technical identifiers and product names (React, Laravel, Python, API, JSON, GitHub, JavaScript) when translating them would damage meaning.
- Preserve code and code identifiers. Do not translate identifiers unnecessarily.
- Preserve line breaks, paragraphs, bullets, quotes, and punctuation where possible.
- Mixed-language input is allowed. Translate the natural-language content; keep already-correct technical terms in the target language when that is natural.
- The result should be natural in the target language, but it is a translation, not a rewrite.

Spoken Arabic (Levantine, Gulf, Egyptian, Iraqi, Maghrebi):
- Translate meaning and tone, not Google-literal wording.
- والله / واللهِ as a conversational filler is Honestly, Look, or I dunno — never "I swear" or "By God" unless the speaker is clearly making a religious oath.
- منا عارف / مش عارف = I don't know / no idea.
- اه / آه / إيه as a backchannel = yeah — do not turn it into a stiff extra clause.
- Levantine انت + imperative verb = English imperative without a dummy "you" subject ("Send him the files").
- بس before a verb is often just; drop it when it sounds machine-translated.

If the source is a question, translate the question. Do not answer it.
`

export function buildTranslationUserMessage(input: {
  text: string
  sourceLanguage: string
  targetLanguage: string
  mode?: string
}): string {
  const sourceName = LANGUAGE_NAMES[input.sourceLanguage] ?? input.sourceLanguage
  const targetName = LANGUAGE_NAMES[input.targetLanguage] ?? input.targetLanguage
  return [
    `Source language: ${sourceName} (${input.sourceLanguage})`,
    `Target language: ${targetName} (${input.targetLanguage})`,
    `Mode: ${input.mode ?? 'writing'}`,
    '',
    'Text:',
    input.text,
  ].join('\n')
}

const FENCE = /^```(?:json)?\s*|\s*```$/gi

/** Parse Groq JSON translation payloads (Lingo contract). Falls back to plain text. */
export function parseGroqTranslationContent(raw: string): string {
  if (!raw.trim()) throw new Error('invalid_response')
  let cleaned = raw.trim().replace(FENCE, '').trim()
  const tryObject = (value: string): string | null => {
    try {
      const data: unknown = JSON.parse(value)
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null
      const translation = (data as { translation?: unknown }).translation
      if (typeof translation !== 'string' || !translation.trim()) return null
      const lowered = translation.trim().toLowerCase()
      if (lowered.startsWith('here is the translation') || lowered.startsWith("here's the translation")) {
        return null
      }
      return translation.trim()
    } catch {
      return null
    }
  }
  const direct = tryObject(cleaned)
  if (direct) return direct
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const sliced = tryObject(cleaned.slice(start, end + 1))
    if (sliced) return sliced
  }
  if (cleaned.startsWith('{')) throw new Error('invalid_response')
  return cleaned
}

/** Constrained post-edit contract for Google draft → Groq polish (Pro paths). */
export const TRANSLATION_REFINEMENT_SYSTEM_PROMPT = `You are a translation post-editor for in-place text replacement.

The SOURCE text is authoritative for meaning and intent.
The GOOGLE DRAFT is a disposable machine translation. Treat it as a hint, not the ceiling.

Hard rules:
- Preserve meaning and intent from the source.
- Preserve facts, negation, tense (unless the draft is clearly wrong), names, numbers, URLs, emails, and technical identifiers.
- Do not add information.
- Do not remove meaningful information.
- Do not answer questions contained in the source.
- Do not add politeness that was not present.
- Spoken or colloquial Arabic (Levantine, Gulf, Egyptian, etc.) must become natural conversational English.
- Rewrite stiff Google phrasing. Prefer "I'll just go see what work is left for us" over "I'll just go and see what work we still have to do / still have left".
- Keep discourse markers that carry tone (Listen, honestly) when they are in the source.
- For formal MSA, keep the draft when it is already natural.
- Return only the final translation with no commentary, quotes, or markdown fences unless they were in the source.`

/** Backend routing strategies (and extension cache key segment). */
export type TranslationRouteStrategy = 'google' | 'groq' | 'google_then_groq'

export type TranslationProviderId = 'cache' | 'google' | 'groq' | 'google_then_groq'

export type TranslationForceProvider = 'auto' | TranslationRouteStrategy

export type TranslationRequestContext = {
  mode?: string
  /** Live segment ended on sentence punctuation (not paragraph fallback). */
  segment_complete?: boolean
  /** Focus left the field; treat as a completion signal for live polish. */
  focus_out_completion?: boolean
}

/**
 * Predict the production cache strategy for extension L1/L2 keys.
 * Pro/trial use Groq as the translator (not Google post-edit).
 * Free uses Google only.
 */
export function predictClientTranslationStrategy(input: {
  plan: 'free' | 'trial' | 'pro' | 'anonymous' | 'unknown' | string
  mode?: string | null
  signedIn?: boolean
}): TranslationRouteStrategy {
  if (input.plan === 'pro' || input.plan === 'trial') return 'groq'
  if (input.signedIn && input.plan !== 'free' && input.plan !== 'anonymous') return 'groq'
  return 'google'
}

export function buildTranslationRefinementUserMessage(input: {
  text: string
  draftTranslation: string
  sourceLanguage: string
  targetLanguage: string
  mode?: string
}): string {
  const spokenArabic =
    input.sourceLanguage === 'ar' || /[\u0600-\u06FF]/.test(input.text)
  const task = spokenArabic
    ? 'Rewrite the Google draft into natural conversational English. Do not keep stiff machine phrasing such as "what work we still have to do" or "what work we still have left". Prefer concise spoken wording such as "what work is left for us".'
    : 'Post-edit the Google draft for naturalness and accuracy with minimal edits.'
  return [
    'SOURCE:',
    input.text,
    '',
    'GOOGLE DRAFT:',
    input.draftTranslation,
    '',
    `SOURCE LANGUAGE: ${input.sourceLanguage}`,
    `TARGET LANGUAGE: ${input.targetLanguage}`,
    `MODE: ${input.mode ?? 'shortcut'}`,
    '',
    'TASK:',
    task,
    'The source is authoritative. The draft is only a starting point.',
  ].join('\n')
}

export type TranslationRequestBody = {
  text: string
  source_language: string
  target_language: string
  context?: TranslationRequestContext
}

export type TranslationResponseBody = {
  ok: true
  translation: string
  requestId?: string
  model?: string
  /** Present after Phase translation-provider router. */
  provider?: TranslationProviderId
  strategy?: TranslationRouteStrategy
}
