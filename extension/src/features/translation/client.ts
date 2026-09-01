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

type ExtensionErrorResponse = {
  ok: false
  error: string
}

function isTranslateResult(response: unknown): response is TranslateTextResponse {
  if (!response || typeof response !== 'object') return false
  const type = (response as { type?: unknown }).type
  return type === 'TRANSLATE_TEXT_RESULT' || type === 'TRANSLATE_TEXT_ERROR'
}

function mapBackgroundErrorCode(code: string): TranslationOutcome extends { ok: false; code: infer C } ? C : 'invalid-response' {
  if (code === 'network' || code === 'upstream') {
    return 'translation_unavailable' as TranslationOutcome extends { ok: false; code: infer C } ? C : 'invalid-response'
  }
  return code as TranslationOutcome extends { ok: false; code: infer C } ? C : 'invalid-response'
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
    } satisfies TranslateTextMessage)) as TranslateTextResponse | ExtensionErrorResponse | undefined

    if (signal?.aborted) return { ok: false, code: 'aborted' }
    if (!response) return { ok: false, code: 'translation_unavailable' }

    if (isTranslateResult(response)) {
      if (response.type === 'TRANSLATE_TEXT_RESULT' && response.ok) {
        const translation = response.translation?.trim()
        if (!translation) return { ok: false, code: 'invalid-response' }
        return { ok: true, translation }
      }
      if (response.type === 'TRANSLATE_TEXT_ERROR') {
        return { ok: false, code: mapBackgroundErrorCode(response.code) }
      }
    }

    if ('error' in response && typeof response.error === 'string') {
      if (response.error === 'internal_error') {
        return { ok: false, code: 'translation_unavailable' }
      }
      return { ok: false, code: 'invalid-response' }
    }

    return { ok: false, code: 'translation_unavailable' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/could not establish connection|receiving end does not exist/i.test(message)) {
      return { ok: false, code: 'translation_unavailable' }
    }
    return { ok: false, code: 'translation_unavailable' }
  }
}
