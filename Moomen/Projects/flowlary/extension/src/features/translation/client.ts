import type { LanguageCode, TranslationMode, TranslationOutcome } from './types.ts'

export type TranslateTextMessage = {
  type: 'TRANSLATE_TEXT'
  text: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  mode: TranslationMode
}

export type TranslateTextResponse =
  | {
      type: 'TRANSLATE_TEXT_RESULT'
      ok: true
      translation: string
      sourceLanguage: LanguageCode
      targetLanguage: LanguageCode
    }
  | {
      type: 'TRANSLATE_TEXT_ERROR'
      ok: false
      code: string
    }

export async function requestTranslationRemote(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  signal?: AbortSignal,
  mode: TranslationMode = 'shortcut',
): Promise<TranslationOutcome> {
  if (signal?.aborted) return { ok: false, code: 'aborted' }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return { ok: false, code: 'translation_unavailable' }
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'TRANSLATE_TEXT',
      text,
      sourceLanguage,
      targetLanguage,
      mode,
    } satisfies TranslateTextMessage)) as TranslateTextResponse | undefined

    if (signal?.aborted) return { ok: false, code: 'aborted' }

    if (!response) return { ok: false, code: 'translation_unavailable' }
    if (response.type === 'TRANSLATE_TEXT_ERROR' || !response.ok) {
      const code = response.type === 'TRANSLATE_TEXT_ERROR' ? response.code : 'network'
      if (code === 'network' || code === 'upstream') {
        return { ok: false, code: 'translation_unavailable' }
      }
      return { ok: false, code: code as TranslationOutcome extends { ok: false; code: infer C } ? C : 'invalid-response' }
    }

    const translation = response.translation?.trim()
    if (!translation) return { ok: false, code: 'invalid-response' }
    return { ok: true, translation }
  } catch {
    return { ok: false, code: 'translation_unavailable' }
  }
}
