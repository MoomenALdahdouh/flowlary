export const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator. Translate the user's text accurately while preserving meaning, tone, names, numbers, URLs, and formatting. Do not add commentary. Return only the translated text with no quotes or markdown fences unless they were in the source.`

/** Used when Pro refinement runs after a Google draft translation. */
export const TRANSLATION_REFINEMENT_SYSTEM_PROMPT = `You refine machine translations. Given the source text and a draft translation, improve fluency and accuracy while preserving meaning, tone, names, numbers, URLs, and formatting. Return only the refined translation with no commentary, quotes, or markdown fences.`

/** Backend routing strategies (and extension cache key segment). */
export type TranslationRouteStrategy = 'google' | 'groq' | 'google_then_groq'

export type TranslationProviderId = 'cache' | 'google' | 'groq' | 'google_then_groq'

export type TranslationForceProvider = 'auto' | TranslationRouteStrategy

/**
 * Predict the production cache strategy for extension L1/L2 keys.
 * Matches backend routing when Google Translate is enabled.
 * When Google is disabled server-side, the backend may use `groq` instead —
 * a cold miss is acceptable; writes use the strategy returned by the API.
 */
export function predictClientTranslationStrategy(input: {
  plan: 'free' | 'trial' | 'pro' | 'anonymous' | 'unknown' | string
  mode?: string | null
}): TranslationRouteStrategy {
  const isPro = input.plan === 'pro' || input.plan === 'trial'
  if (isPro && input.mode !== 'live') return 'google_then_groq'
  return 'google'
}

export type TranslationRequestBody = {
  text: string
  source_language: string
  target_language: string
  context?: { mode?: string }
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
