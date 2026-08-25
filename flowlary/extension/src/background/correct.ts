import {
  CORRECTION_DEFAULTS,
  CORRECTION_SYSTEM_PROMPT,
  validateCorrectionResponse,
  buildCacheKey,
  CACHE_TTL_MS,
  hashCorrectionContext,
  normalizeCacheText,
  type CorrectionResponse,
  type CorrectRequestContext,
} from '@flowlary/shared'
import {
  getCacheMetrics,
  getCorrectCoalescer,
  getFlowlaryCache,
} from '../storage/cache/index.ts'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

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

async function callGroqOnce(
  apiKey: string,
  text: string,
  context: CorrectRequestContext | undefined,
  signal?: AbortSignal,
): Promise<{ data: CorrectionResponse; model: string }> {
  const model = CORRECTION_DEFAULTS.GROQ_MODEL_DEFAULT
  const previousText = context?.previousText?.slice(-200)
  const userPayload = previousText
    ? { text, previousText, fieldType: context?.fieldType }
    : { text, fieldType: context?.fieldType }

  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      response_format: { type: 'json_object' },
    }),
    signal,
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('invalid_api_key')
    if (res.status === 429) throw new Error('rate_limited')
    throw new Error(`groq_http_${res.status}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('invalid_response')

  const validated = validateCorrectionResponse(JSON.parse(content), text)
  if (!validated) throw new Error('invalid_response')
  return { data: validated, model }
}

export type CorrectTextMessage = {
  type: 'CORRECT_TEXT'
  requestId: string
  text: string
  fieldType?: string
  previousText?: string
  groqApiKey: string
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

function correctionCacheKey(text: string, context?: CorrectRequestContext): string {
  return buildCacheKey({
    operation: 'CORRECT',
    text: normalizeCacheText('CORRECT', text),
    contextHash: hashCorrectionContext(context),
  })
}

export async function handleCorrectText(message: CorrectTextMessage): Promise<CorrectTextResponse> {
  const { requestId, text, fieldType, previousText, groqApiKey } = message

  if (!groqApiKey.trim()) {
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'missing_api_key' }
  }

  const trimmed = text.trim()
  if (!trimmed) {
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'empty' }
  }

  const context: CorrectRequestContext = {
    fieldType: fieldType as CorrectRequestContext['fieldType'],
    previousText,
  }
  const cache = getFlowlaryCache()
  await cache.initialize()
  const cacheKey = correctionCacheKey(trimmed, context)
  const cached = await cache.getWithL2<CorrectionResponse>(cacheKey)
  if (cached) {
    getCacheMetrics().ai_requests_avoided += 1
    return {
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId,
      data: cached,
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
        getCacheMetrics().ai_requests_avoided += 1
        return {
          type: 'CORRECT_TEXT_RESULT',
          ok: true,
          requestId,
          data: again,
          timing: { backendMs: 0 },
        }
      }

      getCacheMetrics().ai_requests_correct += 1
      const segment = truncateForCorrection(trimmed)
      let lastError: unknown

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const started = Date.now()
          const result = await callGroqOnce(groqApiKey, segment, context, controller.signal)
          cache.setWithL2(cacheKey, result.data, 'CORRECT', CACHE_TTL_MS.CORRECT)
          return {
            type: 'CORRECT_TEXT_RESULT',
            ok: true,
            requestId,
            data: result.data,
            timing: { backendMs: Date.now() - started, model: result.model },
          }
        } catch (err) {
          lastError = err
          if (err instanceof DOMException && err.name === 'AbortError') {
            return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'aborted', aborted: true }
          }
          if (err instanceof Error && (err.message === 'invalid_api_key' || err.message === 'rate_limited')) {
            return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: err.message }
          }
        }
      }

      if (lastError instanceof Error && lastError.message.startsWith('groq_http_')) {
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
