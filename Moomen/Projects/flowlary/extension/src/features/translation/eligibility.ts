import { isSupportedLanguage } from './languages.ts'
import type { TranslationOutcome, TranslationRequest } from './types.ts'
import { MAX_TRANSLATION_CHARS } from './types.ts'

export function normalizeTranslationText(text: string): string {
  return text.normalize('NFC')
}

export function canTranslateRequest(request: TranslationRequest): TranslationOutcome | null {
  const text = normalizeTranslationText(request.text)
  if (!text.trim()) return { ok: false, code: 'empty' }
  if (!isSupportedLanguage(request.sourceLanguage)) {
    return { ok: false, code: 'invalid-response' }
  }
  if (!isSupportedLanguage(request.targetLanguage)) {
    return { ok: false, code: 'invalid-response' }
  }
  if (request.sourceLanguage === request.targetLanguage) {
    return { ok: false, code: 'same-language' }
  }
  if (text.length > MAX_TRANSLATION_CHARS) return { ok: false, code: 'too-long' }
  return null
}
