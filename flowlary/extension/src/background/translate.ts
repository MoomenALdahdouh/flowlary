import { canTranslateRequest } from '../features/translation/eligibility.ts'
import type { LanguageCode, TranslationMode } from '../features/translation/types.ts'
import {
  buildCacheKey,
  CACHE_TTL_MS,
  isValidAiResponseLength,
  normalizeCacheText,
} from '@flowlary/shared'
import {
  getCacheMetrics,
  getFlowlaryCache,
  getTranslateCoalescer,
} from '../storage/cache/index.ts'

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_TRANSLATION_API_URL?: string } }).env
    ?.VITE_TRANSLATION_API_URL ?? 'http://127.0.0.1:8004'

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

  const cache = getFlowlaryCache()
  await cache.initialize()
  const cacheKey = cache.buildKey({
    operation: 'TRANSLATE',
    text: normalizeCacheText('TRANSLATE', message.text),
    sourceLanguage: message.sourceLanguage,
    targetLanguage: message.targetLanguage,
  })
  const cached = await cache.getWithL2<string>(cacheKey)
  if (cached) {
    getCacheMetrics().ai_requests_avoided += 1
    return {
      type: 'TRANSLATE_TEXT_RESULT',
      ok: true,
      translation: cached,
      sourceLanguage: message.sourceLanguage,
      targetLanguage: message.targetLanguage,
    }
  }

  const coalescer = getTranslateCoalescer()
  return coalescer.run(cacheKey, async () => {
    const again = await cache.getWithL2<string>(cacheKey)
    if (again) {
      getCacheMetrics().ai_requests_avoided += 1
      return {
        type: 'TRANSLATE_TEXT_RESULT',
        ok: true,
        translation: again,
        sourceLanguage: message.sourceLanguage,
        targetLanguage: message.targetLanguage,
      }
    }

    getCacheMetrics().ai_requests_translate += 1
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
      if (!isValidAiResponseLength(body.translation) || !body.translation.trim()) {
        return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'invalid-response' }
      }

      cache.setWithL2(cacheKey, body.translation, 'TRANSLATE', CACHE_TTL_MS.TRANSLATE)
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
  }) as Promise<TranslateTextResponse>
}

export function resetTranslateHandlerForTests(): void {
  getTranslateCoalescer().reset()
}
