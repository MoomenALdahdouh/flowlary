import { canTranslateRequest } from '../features/translation/eligibility.ts'
import type { LanguageCode, TranslationMode } from '../features/translation/types.ts'
import {
  buildCacheKey,
  CACHE_TTL_MS,
  isValidAiResponseLength,
  normalizeCacheText,
  predictClientTranslationStrategy,
} from '@flowlary/shared'
import {
  getCacheMetrics,
  getFlowlaryCache,
  getTranslateCoalescer,
} from '../storage/cache/index.ts'
import { getEntitlementService } from '../entitlement/service.ts'
import { flowlaryStorage, getEntitlement, resolveEntitlementStatus } from '../storage/index.ts'
import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import { prepareManagedAiRequest } from '../config/auth.ts'
import { maybeSyncServerEntitlement } from '../config/accountAuth.ts'
import { stateManager } from '../core/state/StateManager.ts'
import { isCorrectionAiReady } from '../features/correction/readiness.ts'
import { activeAccountContext } from '../storage/activeAccountContext.ts'

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

function mapHttpFailure(status: number, code?: string): string {
  if (code === 'AI_AUTH_FAILED' || status === 401) return 'auth_failed'
  if (code === 'AI_RATE_LIMITED' || status === 429) return 'rate_limited'
  if (code === 'AI_ENTITLEMENT_DENIED' || status === 403) return 'usage_exhausted'
  return 'upstream'
}

export async function handleTranslateText(
  message: TranslateTextRequest,
): Promise<TranslateTextResponse> {
  if (!isCorrectionAiReady(stateManager.correction)) {
    return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'consent_required' }
  }

  const blocked = canTranslateRequest({
    sourceLanguage: message.sourceLanguage,
    targetLanguage: message.targetLanguage,
    text: message.text,
    mode: message.mode,
  })
  if (blocked && !blocked.ok) {
    return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: blocked.code }
  }

  const entitlement = await getEntitlementService(flowlaryStorage).canUseFeature(
    message.mode === 'live' ? 'live_translation' : 'translation',
  )
  if (!entitlement.allowed) {
    return {
      type: 'TRANSLATE_TEXT_ERROR',
      ok: false,
      code: getEntitlementService(flowlaryStorage).errorCodeFor(entitlement) as 'entitlement_denied',
    }
  }

  const plan = resolveEntitlementStatus(await getEntitlement(flowlaryStorage))
  const translationStrategy = predictClientTranslationStrategy({
    plan,
    mode: message.mode,
  })

  const accountSnapshot = activeAccountContext.snapshot()
  const cache = getFlowlaryCache()
  await cache.initialize()
  const cacheKey = cache.buildKey({
    operation: 'TRANSLATE',
    text: normalizeCacheText('TRANSLATE', message.text),
    sourceLanguage: message.sourceLanguage,
    targetLanguage: message.targetLanguage,
    translationStrategy,
    accountId: accountSnapshot.accountId,
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
      await maybeSyncServerEntitlement(flowlaryStorage)
      const headers = await prepareManagedAiRequest(flowlaryStorage)
      const response = await fetch(`${FLOWLARY_API_BASE}/api/ai/translation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: message.text,
          source_language: message.sourceLanguage,
          target_language: message.targetLanguage,
          context: { mode: message.mode },
        }),
      })

      if (!response.ok) {
        let code: string | undefined
        try {
          const errBody = (await response.json()) as { error?: { code?: string } }
          code = errBody.error?.code
        } catch {
          /* ignore */
        }
        return {
          type: 'TRANSLATE_TEXT_ERROR',
          ok: false,
          code: response.status === 0 ? 'network' : mapHttpFailure(response.status, code),
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
      // Drop result if the active account changed mid-request (Phase 2 isolation).
      if (!activeAccountContext.matches(accountSnapshot)) {
        return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'account_changed' }
      }
      cache.setWithL2(cacheKey, normalized, 'TRANSLATE', CACHE_TTL_MS.TRANSLATE)
      return {
        type: 'TRANSLATE_TEXT_RESULT',
        ok: true,
        translation: normalized,
        sourceLanguage: message.sourceLanguage,
        targetLanguage: message.targetLanguage,
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'account_required') {
          return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'account_required' }
        }
        if (err.message === 'auth_failed') {
          return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'auth_failed' }
        }
      }
      return { type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'network' }
    }
  }) as Promise<TranslateTextResponse>
}

export function resetTranslateHandlerForTests(): void {
  getTranslateCoalescer().reset()
}
