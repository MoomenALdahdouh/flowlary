export const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator. Translate the user's text accurately while preserving meaning, tone, names, numbers, URLs, and formatting. Do not add commentary. Return only the translated text with no quotes or markdown fences unless they were in the source.`

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
}
