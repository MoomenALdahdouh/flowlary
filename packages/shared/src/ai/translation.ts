export const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator. Translate the user's text accurately while preserving meaning, tone, names, numbers, URLs, and formatting. Do not add commentary. Return only the translated text with no quotes or markdown fences unless they were in the source.`

/** Constrained post-edit contract for Google draft → Groq polish (Pro paths). */
export const TRANSLATION_REFINEMENT_SYSTEM_PROMPT = `You are a translation post-editor for in-place text replacement.

The SOURCE text is authoritative for meaning and intent.
The GOOGLE DRAFT is an editable machine translation only.
You are a POST-EDITOR, not a free translator or rewriter.

Hard rules:
- Preserve meaning and intent from the source.
- Preserve facts, negation, tense (unless the draft is clearly wrong), names, numbers, URLs, emails, and technical identifiers.
- Preserve sentence structure where reasonable; do not merge or split sentences unless required to fix a clear draft error.
- Do not add information.
- Do not remove meaningful information.
- Do not answer questions contained in the source.
- Do not add politeness that was not present.
- Prefer natural target-language wording over literal machine translation.
- Spoken or colloquial Arabic (Levantine, Gulf, Egyptian, etc.) must read as natural conversational English, not stiff NMT.
- Fix wordy or literal phrasing even when the Google draft is grammatically correct (e.g. prefer "what work is left for us" over "what work we still have to do").
- Meaningful discourse markers and fillers in the source should not be dropped unless they are truly untranslatable noise.
- Render fillers naturally in English when appropriate from context (e.g. اسمع → Listen, when it opens a sentence).
- Do not translate religious or cultural discourse markers literally when they function as conversational fillers in context.
- For formal MSA sources, make the smallest changes necessary.
- If the source is formal and the Google draft is already natural and faithful, return it unchanged.
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
 * Pro/trial may receive Groq post-edit (including conditional live polish).
 */
export function predictClientTranslationStrategy(input: {
  plan: 'free' | 'trial' | 'pro' | 'anonymous' | 'unknown' | string
  mode?: string | null
}): TranslationRouteStrategy {
  const isPro = input.plan === 'pro' || input.plan === 'trial'
  if (isPro) return 'google_then_groq'
  return 'google'
}

export function buildTranslationRefinementUserMessage(input: {
  text: string
  draftTranslation: string
  sourceLanguage: string
  targetLanguage: string
  mode?: string
}): string {
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
    input.mode === 'live'
      ? 'Post-edit the Google draft into natural conversational English. Fix literal or stiff machine phrasing from spoken Arabic. Prefer concise idiomatic wording.'
      : 'Post-edit the Google draft for naturalness and accuracy with minimal edits.',
    'The source is authoritative. The draft is editable.',
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
