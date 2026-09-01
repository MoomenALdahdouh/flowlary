import { HYPOTHESIS_ADVISOR_SYSTEM_PROMPT, WRITING_REVIEW_JSON_SCHEMA, WRITING_REVIEW_SYSTEM_PROMPT, type WritingReviewPacket } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import type { ProviderHealthManager } from '../health/providerHealth.ts'
import { validateAdvisorProviderContent } from './advisorValidation.ts'
import { validateWritingReviewProviderContent } from './writingReviewValidation.ts'
import type { WritingReviewProviderResult } from './writingReviewTypes.ts'
import type {
  AdvisorPacket,
  AdvisorProviderErrorCategory,
  AdvisorProviderFailure,
  AdvisorProviderResult,
  AdvisorRequestOptions,
  AdvisorTokenUsage,
  HypothesisAdvisorProvider,
  ProviderHealthSnapshot,
} from './advisorTypes.ts'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000

const ADVISOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rankedHypothesisIds', 'ambiguityClass', 'reasonCode'],
  properties: {
    rankedHypothesisIds: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    ambiguityClass: { type: 'string' },
    reasonCode: { type: 'string' },
  },
}

function retryAfterMs(headers: Pick<Headers, 'get'>, now = Date.now()): number | undefined {
  const value = headers.get('retry-after')?.trim()
  if (!value) return undefined
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return Math.min(24 * 60 * 60 * 1000, Math.ceil(Number(value) * 1000))
  }
  const at = Date.parse(value)
  if (!Number.isFinite(at) || at <= now) return undefined
  return Math.min(24 * 60 * 60 * 1000, at - now)
}

function failure(input: {
  category: AdvisorProviderErrorCategory
  model: string
  latencyMs: number
  cooldownMs?: number
  providerRequestId?: string
}): AdvisorProviderFailure {
  return {
    ok: false,
    provider: 'gemini',
    ...input,
    retryable: (
      input.category === 'RATE_LIMITED'
      || input.category === 'QUOTA_EXHAUSTED'
      || input.category === 'TIMEOUT'
      || input.category === 'SERVER_ERROR'
      || input.category === 'PROVIDER_UNAVAILABLE'
      || input.category === 'NETWORK_ERROR'
    ),
    fallbackEligible: input.category !== 'STALE_REQUEST',
  }
}

function mergeSignals(primary: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!primary) return timeout
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([primary, timeout])
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (primary.aborted || timeout.aborted) controller.abort()
  else {
    primary.addEventListener('abort', abort, { once: true })
    timeout.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

export class GeminiAdvisorProvider implements HypothesisAdvisorProvider {
  readonly id = 'gemini'
  readonly capabilities = [
    'hypothesis_ranking',
    'writing_review',
    'structured_json',
    'id_only_output',
    'arabic',
  ] as const

  constructor(
    private readonly config: AppConfig,
    private readonly healthManager: ProviderHealthManager,
  ) {}

  get model(): string {
    return this.config.geminiAdvisorModel
  }

  get enabled(): boolean {
    return this.config.advisorEnabled && this.config.geminiAdvisorEnabled
  }

  health(): ProviderHealthSnapshot {
    return this.healthManager.snapshot(this.id)
  }

  availability() {
    const health = this.health()
    return {
      available: this.enabled && (health.cooldownUntil === undefined || health.cooldownUntil <= Date.now()),
      state: health.state,
      cooldownUntil: health.cooldownUntil,
    }
  }

  async rankHypotheses(
    packet: AdvisorPacket,
    options: AdvisorRequestOptions,
  ): Promise<AdvisorProviderResult> {
    const started = Date.now()
    if (!this.enabled) {
      return failure({
        category: 'PROVIDER_UNAVAILABLE',
        model: this.model,
        latencyMs: 0,
      })
    }
    if (options.signal?.aborted) {
      return failure({ category: 'STALE_REQUEST', model: this.model, latencyMs: 0 })
    }
    if (!this.config.geminiApiKey) {
      return failure({
        category: 'PROVIDER_UNAVAILABLE',
        model: this.model,
        latencyMs: 0,
      })
    }

    const remainingMs = Math.min(options.timeoutMs, options.deadlineAt - Date.now())
    if (remainingMs <= 0) {
      return failure({ category: 'TIMEOUT', model: this.model, latencyMs: 0 })
    }
    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), remainingMs)
    let response: Response
    try {
      const model = encodeURIComponent(this.model)
      const key = encodeURIComponent(this.config.geminiApiKey)
      response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: HYPOTHESIS_ADVISOR_SYSTEM_PROMPT }],
          },
          contents: [{
            role: 'user',
            parts: [{ text: JSON.stringify(packet) }],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: options.maxTokens,
            responseMimeType: 'application/json',
            responseJsonSchema: ADVISOR_SCHEMA,
          },
        }),
        signal: mergeSignals(options.signal, timeoutController.signal),
      })
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      return failure({
        category: aborted
          ? options.signal?.aborted ? 'STALE_REQUEST' : 'TIMEOUT'
          : 'NETWORK_ERROR',
        model: this.model,
        latencyMs: Date.now() - started,
      })
    } finally {
      clearTimeout(timer)
    }

    const latencyMs = Date.now() - started
    const requestId = response.headers.get('x-request-id')
    const providerRequestId =
      requestId && requestId.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(requestId)
        ? requestId
        : undefined

    if (!response.ok) {
      let errorText = ''
      try {
        errorText = JSON.stringify(await response.clone().json()).toLowerCase()
      } catch {
        // Status remains authoritative when the provider body is not JSON.
      }
      const quotaExhausted =
        response.status === 402 || /(quota|billing|credits?|resource_exhausted)/.test(errorText)
      if (response.status === 429) {
        return failure({
          category: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED',
          model: this.model,
          latencyMs,
          cooldownMs: retryAfterMs(response.headers) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS,
          providerRequestId,
        })
      }
      if (response.status === 401 || response.status === 403) {
        return failure({
          category: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'AUTH_FAILED',
          model: this.model,
          latencyMs,
          providerRequestId,
        })
      }
      if (response.status === 408 || response.status === 504) {
        return failure({
          category: 'TIMEOUT',
          model: this.model,
          latencyMs,
          providerRequestId,
        })
      }
      if (response.status === 400 || response.status === 404) {
        return failure({
          category: 'INVALID_REQUEST',
          model: this.model,
          latencyMs,
          providerRequestId,
        })
      }
      return failure({
        category: response.status >= 500
          ? 'SERVER_ERROR'
          : quotaExhausted ? 'QUOTA_EXHAUSTED' : 'UNKNOWN',
        model: this.model,
        latencyMs,
        providerRequestId,
      })
    }

    let json: {
      modelVersion?: string
      candidates?: Array<{
        finishReason?: string
        content?: { parts?: Array<{ text?: string }> }
      }>
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
        thoughtsTokenCount?: number
      }
    }
    try {
      json = await response.json()
    } catch {
      return failure({
        category: 'CONTRACT_FAILURE',
        model: this.model,
        latencyMs,
        providerRequestId,
      })
    }

    const candidate = json.candidates?.[0]
    const rawFinishReason = candidate?.finishReason
    const finishReason = rawFinishReason === 'MAX_TOKENS' ? 'length' : rawFinishReason
    const usage: AdvisorTokenUsage | undefined = json.usageMetadata
      ? {
          inputTokens: json.usageMetadata.promptTokenCount,
          outputTokens: json.usageMetadata.candidatesTokenCount,
          totalTokens: json.usageMetadata.totalTokenCount,
          reasoningTokens: json.usageMetadata.thoughtsTokenCount,
        }
      : undefined
    const content = candidate?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')

    return validateAdvisorProviderContent(
      content,
      new Set(packet.hypotheses.map((item) => item.id)),
      {
        provider: this.id,
        model: json.modelVersion ?? this.model,
        latencyMs,
        usage,
        finishReason,
        providerRequestId,
      },
    )
  }

  async reviewWriting(
    packet: WritingReviewPacket,
    options: AdvisorRequestOptions,
  ): Promise<WritingReviewProviderResult> {
    const started = Date.now()
    if (!this.config.writingReviewEnabled || !this.config.geminiApiKey) {
      return failure({ category: 'PROVIDER_UNAVAILABLE', model: this.model, latencyMs: 0 })
    }
    if (options.signal?.aborted) {
      return failure({ category: 'STALE_REQUEST', model: this.model, latencyMs: 0 })
    }
    if (!this.config.geminiApiKey) {
      return failure({ category: 'PROVIDER_UNAVAILABLE', model: this.model, latencyMs: 0 })
    }
    const remainingMs = Math.min(options.timeoutMs, options.deadlineAt - Date.now())
    if (remainingMs <= 0) {
      return failure({ category: 'TIMEOUT', model: this.model, latencyMs: 0 })
    }
    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), remainingMs)
    let response: Response
    try {
      const model = encodeURIComponent(this.model)
      const key = encodeURIComponent(this.config.geminiApiKey)
      response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: WRITING_REVIEW_SYSTEM_PROMPT }],
          },
          contents: [{
            role: 'user',
            parts: [{ text: JSON.stringify(packet) }],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: options.maxTokens,
            responseMimeType: 'application/json',
            responseJsonSchema: WRITING_REVIEW_JSON_SCHEMA,
          },
        }),
        signal: mergeSignals(options.signal, timeoutController.signal),
      })
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      return failure({
        category: aborted
          ? options.signal?.aborted ? 'STALE_REQUEST' : 'TIMEOUT'
          : 'NETWORK_ERROR',
        model: this.model,
        latencyMs: Date.now() - started,
      })
    } finally {
      clearTimeout(timer)
    }

    const latencyMs = Date.now() - started
    const requestId = response.headers.get('x-request-id')
    const providerRequestId =
      requestId && requestId.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(requestId)
        ? requestId
        : undefined
    if (!response.ok) {
      let errorText = ''
      try {
        errorText = JSON.stringify(await response.clone().json()).toLowerCase()
      } catch {
        // Status remains authoritative when the provider body is not JSON.
      }
      const quotaExhausted =
        response.status === 402 || /(quota|billing|credits?|resource_exhausted)/.test(errorText)
      if (response.status === 429) {
        return failure({
          category: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED',
          model: this.model,
          latencyMs,
          cooldownMs: retryAfterMs(response.headers) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS,
          providerRequestId,
        })
      }
      if (response.status === 401 || response.status === 403) {
        return failure({
          category: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'AUTH_FAILED',
          model: this.model,
          latencyMs,
          providerRequestId,
        })
      }
      if (response.status === 408 || response.status === 504) {
        return failure({ category: 'TIMEOUT', model: this.model, latencyMs, providerRequestId })
      }
      if (response.status === 400 || response.status === 404) {
        return failure({ category: 'INVALID_REQUEST', model: this.model, latencyMs, providerRequestId })
      }
      return failure({
        category: response.status >= 500
          ? 'SERVER_ERROR'
          : quotaExhausted ? 'QUOTA_EXHAUSTED' : 'UNKNOWN',
        model: this.model,
        latencyMs,
        providerRequestId,
      })
    }

    let json: {
      modelVersion?: string
      candidates?: Array<{
        finishReason?: string
        content?: { parts?: Array<{ text?: string }> }
      }>
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
        thoughtsTokenCount?: number
      }
    }
    try {
      json = await response.json()
    } catch {
      return failure({ category: 'CONTRACT_FAILURE', model: this.model, latencyMs, providerRequestId })
    }
    const candidate = json.candidates?.[0]
    const rawFinishReason = candidate?.finishReason
    const finishReason = rawFinishReason === 'MAX_TOKENS' ? 'length' : rawFinishReason
    const usage: AdvisorTokenUsage | undefined = json.usageMetadata
      ? {
          inputTokens: json.usageMetadata.promptTokenCount,
          outputTokens: json.usageMetadata.candidatesTokenCount,
          totalTokens: json.usageMetadata.totalTokenCount,
          reasoningTokens: json.usageMetadata.thoughtsTokenCount,
        }
      : undefined
    const content = candidate?.content?.parts?.map((part) => part.text ?? '').join('')
    return validateWritingReviewProviderContent(content, packet.snippet, {
      provider: this.id,
      model: json.modelVersion ?? this.model,
      latencyMs,
      usage,
      finishReason,
      providerRequestId,
    })
  }
}

export { GeminiAdvisorProvider as GeminiAdapter }
