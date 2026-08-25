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
import { flowlaryStorage, getEntitlement, resolveEntitlementStatus } from '../storage/index.ts'
import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import {
  buildFlowlaryApiHeaders,
  ensureInstallAuth,
  resolveEntitlementHeader,
} from '../config/auth.ts'

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
  if (status === 401 || status === 403) return 'license'
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
      const entitlement = resolveEntitlementStatus(await getEntitlement(flowlaryStorage))
      const auth = await ensureInstallAuth(flowlaryStorage)
      const response = await fetch(`${FLOWLARY_API_BASE}/api/ai/translation`, {
        method: 'POST',
        headers: buildFlowlaryApiHeaders(auth, resolveEntitlementHeader(entitlement)),
        body: JSON.stringify({
          text: message.text,
          source_language: message.sourceLanguage,
          target_language: message.targetLanguage,
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

      const body = (await response.json()) as { translation?: unknown; ok?: boolean }
      const translation =
        typeof body.translation === 'string'
          ? body.translation
          : typeof body === 'object' && body !== null && 'translation' in body
            ? (body as { translation?: unknown }).translation
            : undefined
      if (!isValidAiResponseLength(translation) || !String(translation).trim()) {
        return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'invalid-response' }
      }

      const normalized = String(translation).trim()
      cache.setWithL2(cacheKey, normalized, 'TRANSLATE', CACHE_TTL_MS.TRANSLATE)
      return {
        type: 'TRANSLATE_TEXT_RESULT',
        ok: true,
        translation: normalized,
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
