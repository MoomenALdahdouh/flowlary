import {
  CORRECTION_DEFAULTS,
  isValidAiResponseLength,
  validateCorrectionResponse,
  buildCacheKey,
  CACHE_TTL_MS,
  hashCorrectionContext,
  normalizeCacheText,
  enrichCorrectionResponseWithExplanations,
  type CorrectionResponse,
  type CorrectRequestContext,
} from '@flowlary/shared'
import {
  getCacheMetrics,
  getCorrectCoalescer,
  getFlowlaryCache,
} from '../storage/cache/index.ts'
import { stateManager } from '../core/state/StateManager.ts'
import { getEntitlementService } from '../entitlement/service.ts'
import { flowlaryStorage } from '../storage/index.ts'
import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import { prepareManagedAiRequest } from '../config/auth.ts'
import { markApiHealthOk } from '../config/apiHealth.ts'
import { maybeSyncServerEntitlement } from '../config/accountAuth.ts'
import { isCorrectionAiReady } from '../features/correction/readiness.ts'
import { activeAccountContext } from '../storage/activeAccountContext.ts'

const inflight = new Map<string, AbortController>()

function truncateForCorrection(text: string): string {
  if (text.length <= CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS) return text
  const slice = text.slice(-CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS)
  const boundary = slice.search(/[.!?]\s/)
  if (boundary > 0 && boundary < slice.length / 2) {
    return slice.slice(boundary + 1).trimStart()
  }
  return slice
}

async function callManagedCorrectionOnce(
  text: string,
  context: CorrectRequestContext | undefined,
  signal?: AbortSignal,
  mode?: string,
): Promise<{ data: CorrectionResponse; model: string }> {
  const headers = await prepareManagedAiRequest(flowlaryStorage)
  let res: Response
  try {
    res = await fetch(`${FLOWLARY_API_BASE}/api/ai/correction`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text,
        fieldType: context?.fieldType,
        previousText: context?.previousText,
        mode,
      }),
      signal,
    })
  } catch {
    throw new Error('network')
  }

  if (!res.ok) {
    let code: string | undefined
    try {
      const errBody = (await res.json()) as { error?: { code?: string } }
      code = errBody.error?.code
    } catch {
      /* ignore parse failures */
    }
    if (res.status === 401 || code === 'AI_AUTH_FAILED') throw new Error('auth_failed')
    if (res.status === 429 || code === 'AI_RATE_LIMITED') throw new Error('rate_limited')
    if (code === 'AI_ENTITLEMENT_DENIED' || res.status === 403) {
      throw new Error(code === 'AI_ENTITLEMENT_DENIED' ? 'entitlement_denied' : 'usage_exhausted')
    }
    if (
      code === 'AI_UNAVAILABLE' ||
      code === 'AI_PROVIDER_ERROR' ||
      code === 'AI_TIMEOUT' ||
      code === 'AI_INVALID_RESPONSE'
    ) {
      throw new Error(code)
    }
    throw new Error(`gateway_http_${res.status}`)
  }

  markApiHealthOk()

  const json = (await res.json()) as {
    ok?: boolean
    data?: CorrectionResponse
    model?: string
    error?: { code?: string }
  }
  if (!json.ok || !json.data) {
    const code = json.error?.code
    if (code === 'AI_RATE_LIMITED') throw new Error('rate_limited')
    if (code === 'AI_AUTH_FAILED') throw new Error('auth_failed')
    if (code === 'AI_ENTITLEMENT_DENIED') throw new Error('entitlement_denied')
    throw new Error('invalid_response')
  }
  return { data: json.data, model: json.model ?? CORRECTION_DEFAULTS.GROQ_MODEL_DEFAULT }
}

export type CorrectTextMessage = {
  type: 'CORRECT_TEXT'
  requestId: string
  text: string
  fieldType?: string
  previousText?: string
  mode?: string
}

export type CorrectTextResponse =
  | {
      type: 'CORRECT_TEXT_RESULT'
      ok: true
      requestId: string
      data: CorrectionResponse
      timing?: { backendMs?: number; model?: string }
    }
  | {
      type: 'CORRECT_TEXT_RESULT'
      ok: false
      requestId: string
      error: string
      aborted?: boolean
    }

function correctionCacheKey(
  text: string,
  context: CorrectRequestContext | undefined,
  accountId: string | null,
): string {
  return buildCacheKey({
    operation: 'CORRECT',
    text: normalizeCacheText('CORRECT', text),
    contextHash: hashCorrectionContext(context),
    accountId,
  })
}

function deliverCorrectionResponse(data: CorrectionResponse): CorrectionResponse {
  try {
    return enrichCorrectionResponseWithExplanations(data)
  } catch {
    return data
  }
}

export async function handleCorrectText(message: CorrectTextMessage): Promise<CorrectTextResponse> {
  const { requestId, text, fieldType, previousText, mode } = message
  const settings = stateManager.correction

  if (!isCorrectionAiReady(settings)) {
    return {
      type: 'CORRECT_TEXT_RESULT',
      ok: false,
      requestId,
      error: 'consent_required',
    }
  }

  await maybeSyncServerEntitlement(flowlaryStorage)

  const feature = mode === 'practice' ? 'practice' : 'correction'
  const entitlement = await getEntitlementService(flowlaryStorage).canUseFeature(feature)
  if (!entitlement.allowed) {
    return {
      type: 'CORRECT_TEXT_RESULT',
      ok: false,
      requestId,
      error:
        entitlement.reason === 'account_required'
          ? 'account_required'
          : entitlement.reason === 'usage_exhausted'
            ? 'usage_exhausted'
            : 'entitlement_denied',
    }
  }

  const trimmed = text.trim()
  if (!trimmed) {
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'empty' }
  }

  const context: CorrectRequestContext = {
    fieldType: fieldType as CorrectRequestContext['fieldType'],
    previousText,
  }
  const accountSnapshot = activeAccountContext.snapshot()
  const cache = getFlowlaryCache()
  await cache.initialize()
  const cacheKey = correctionCacheKey(trimmed, context, accountSnapshot.accountId)
  const cached = await cache.getWithL2<CorrectionResponse>(cacheKey)
  if (cached) {
    if (!activeAccountContext.matches(accountSnapshot)) {
      return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'account_changed' }
    }
    getCacheMetrics().ai_requests_avoided += 1
    return {
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId,
      data: deliverCorrectionResponse(cached),
      timing: { backendMs: 0 },
    }
  }

  inflight.get(requestId)?.abort()
  const controller = new AbortController()
  inflight.set(requestId, controller)

  const coalescer = getCorrectCoalescer()
  try {
    return await coalescer.run(cacheKey, async () => {
      const again = await cache.getWithL2<CorrectionResponse>(cacheKey)
      if (again) {
        if (!activeAccountContext.matches(accountSnapshot)) {
          return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'account_changed' }
        }
        getCacheMetrics().ai_requests_avoided += 1
        return {
          type: 'CORRECT_TEXT_RESULT',
          ok: true,
          requestId,
          data: deliverCorrectionResponse(again),
          timing: { backendMs: 0 },
        }
      }

      getCacheMetrics().ai_requests_correct += 1
      const segment = truncateForCorrection(trimmed)
      let lastError: unknown

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const started = Date.now()
          const result = await callManagedCorrectionOnce(segment, context, controller.signal, mode)
          if (!activeAccountContext.matches(accountSnapshot)) {
            return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'account_changed' }
          }
          cache.setWithL2(cacheKey, result.data, 'CORRECT', CACHE_TTL_MS.CORRECT)
          return {
            type: 'CORRECT_TEXT_RESULT',
            ok: true,
            requestId,
            data: deliverCorrectionResponse(result.data),
            timing: { backendMs: Date.now() - started, model: result.model },
          }
        } catch (err) {
          lastError = err
          if (err instanceof DOMException && err.name === 'AbortError') {
            return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'aborted', aborted: true }
          }
          if (err instanceof Error) {
            if (err.message === 'rate_limited') {
              return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'rate_limited' }
            }
            if (
              err.message === 'auth_failed' ||
              err.message === 'account_required' ||
              err.message === 'entitlement_denied' ||
              err.message === 'usage_exhausted' ||
              err.message === 'network' ||
              err.message === 'auth_register_failed' ||
              err.message === 'auth_register_invalid' ||
              err.message === 'AI_UNAVAILABLE' ||
              err.message === 'AI_PROVIDER_ERROR' ||
              err.message === 'AI_TIMEOUT' ||
              err.message === 'AI_INVALID_RESPONSE' ||
              err.message === 'invalid_response'
            ) {
              return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: err.message }
            }
          }
        }
      }

      if (lastError instanceof Error && lastError.message.startsWith('gateway_http_')) {
        return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'network' }
      }
      return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'invalid_response' }
    })
  } finally {
    inflight.delete(requestId)
  }
}

export function cancelCorrectRequest(requestId: string): void {
  inflight.get(requestId)?.abort()
  inflight.delete(requestId)
}

export function resetCorrectHandlerForTests(): void {
  getCorrectCoalescer().reset()
  inflight.clear()
}
