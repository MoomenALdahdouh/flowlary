import { canTranslateRequest } from '../features/translation/eligibility.ts'
import type { LanguageCode, TranslationMode } from '../features/translation/types.ts'
import { createMemoryCacheCoordinator } from '@flowlary/shared'

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_TRANSLATION_API_URL?: string } }).env
    ?.VITE_TRANSLATION_API_URL ?? 'http://127.0.0.1:8004'

const memoryCache = createMemoryCacheCoordinator(60_000)

export type TranslateTextRequest = {
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
  | { type: 'TRANSLATE_TEXT_ERROR'; ok: false; code: string }

function mapHttpFailure(status: number): string {
  if (status === 403 || status === 503) return 'license'
  if (status === 429) return 'rate-limited'
  return 'upstream'
}

export async function handleTranslateText(
  message: TranslateTextRequest,
): Promise<TranslateTextResponse> {
  const blocked = canTranslateRequest({
    sourceLanguage: message.sourceLanguage,
    targetLanguage: message.targetLanguage,
    text: message.text,
    mode: message.mode,
  })
  if (blocked && !blocked.ok) {
    return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: blocked.code }
  }

  const cacheKey = memoryCache.buildKey({
    operation: 'TRANSLATE',
    text: message.text,
    sourceLanguage: message.sourceLanguage,
    targetLanguage: message.targetLanguage,
  })
  const cached = memoryCache.get<string>(cacheKey)
  if (cached) {
    return {
      type: 'TRANSLATE_TEXT_RESULT',
      ok: true,
      translation: cached,
      sourceLanguage: message.sourceLanguage,
      targetLanguage: message.targetLanguage,
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_language: message.sourceLanguage,
        target_language: message.targetLanguage,
        text: message.text,
        context: { mode: message.mode },
      }),
    })

    if (!response.ok) {
      return {
        type: 'TRANSLATE_TEXT_ERROR',
        ok: false,
        code: response.status === 0 ? 'network' : mapHttpFailure(response.status),
      }
    }

    const body = (await response.json()) as { translation?: unknown }
    if (typeof body.translation !== 'string' || !body.translation.trim()) {
      return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'invalid-response' }
    }

    memoryCache.set(cacheKey, body.translation)
    return {
      type: 'TRANSLATE_TEXT_RESULT',
      ok: true,
      translation: body.translation,
      sourceLanguage: message.sourceLanguage,
      targetLanguage: message.targetLanguage,
    }
  } catch {
    return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'network' }
  }
}
