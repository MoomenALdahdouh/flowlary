export type LanguageCode =
  | 'en'
  | 'ar'
  | 'tr'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'ru'
  | 'zh'
  | 'ja'
  | 'ko'

export type TranslationMode = 'shortcut' | 'live'

export type TranslationRequest = {
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  text: string
  mode: TranslationMode
}

export type TranslationFailureCode =
  | 'empty'
  | 'same-language'
  | 'too-long'
  | 'protected'
  | 'network'
  | 'upstream'
  | 'invalid-response'
  | 'license'
  | 'rate-limited'
  | 'translation_unavailable'
  | 'aborted'

export type TranslationOutcome =
  | { ok: true; translation: string }
  | { ok: false; code: TranslationFailureCode }

export type TranslationTicket = {
  elementGeneration: number
  originalText: string
  start: number
  end: number
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  mode: TranslationMode
}

export type TranslateTarget = {
  start: number
  end: number
  text: string
  mode: 'selection' | 'context'
}

export const MAX_TRANSLATION_CHARS = 4_000
