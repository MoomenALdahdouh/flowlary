import { HYPOTHESIS_ADVISOR_SYSTEM_PROMPT, WRITING_REVIEW_SYSTEM_PROMPT, type WritingReviewPacket } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import type { ProviderHealthManager } from '../health/providerHealth.ts'
import { parseRetryAfterMs } from './groqAdvisorProvider.ts'
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

export const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000

function failure(input: {
  category: AdvisorProviderErrorCategory
  model: string
  latencyMs: number
  cooldownMs?: number
  usage?: AdvisorTokenUsage
  finishReason?: string
  providerRequestId?: string
}): AdvisorProviderFailure {
  return {
    ok: false,
    provider: 'openrouter',
    ...input,
    retryable: [
      'RATE_LIMITED',
      'QUOTA_EXHAUSTED',
      'TIMEOUT',
      'NETWORK_ERROR',
      'PROVIDER_UNAVAILABLE',
      'SERVER_ERROR',
    ].includes(input.category),
    fallbackEligible: input.category !== 'STALE_REQUEST',
  }
}

function mergedSignal(parent: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!parent) return timeout
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([parent, timeout])
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (parent.aborted || timeout.aborted) controller.abort()
  else {
    parent.addEventListener('abort', abort, { once: true })
    timeout.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

function requestId(headers: Pick<Headers, 'get'>): string | undefined {
  const value = headers.get('x-request-id') ?? headers.get('request-id')
  return safeRequestId(value)
}

function safeRequestId(value: string | null | undefined): string | undefined {
  return value && value.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(value)
    ? value
    : undefined
}

export class OpenRouterAdvisorProvider implements HypothesisAdvisorProvider {
  readonly id = 'openrouter'
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
    return this.config.openRouterAdvisorModel
  }

  get enabled(): boolean {
    return this.config.advisorEnabled
      && this.config.openRouterAdvisorEnabled
      && Boolean(this.model)
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
    if (!this.enabled || !this.config.openRouterApiKey) {
      return failure({ category: 'PROVIDER_UNAVAILABLE', model: this.model || 'unconfigured', latencyMs: 0 })
    }
    if (options.signal?.aborted) {
      return failure({ category: 'STALE_REQUEST', model: this.model, latencyMs: 0 })
    }
    const remainingMs = Math.min(options.timeoutMs, options.deadlineAt - Date.now())
    if (remainingMs <= 0) {
      return failure({ category: 'TIMEOUT', model: this.model, latencyMs: 0 })
    }

    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), remainingMs)
    let response: Response
    try {
      response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.openRouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: options.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: HYPOTHESIS_ADVISOR_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(packet) },
          ],
        }),
        signal: mergedSignal(options.signal, timeoutController.signal),
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
    const providerRequestId = requestId(response.headers)
    if (!response.ok) {
      let errorText = ''
      try {
        errorText = JSON.stringify(await response.clone().json()).toLowerCase()
      } catch {
        // Status mapping below remains deterministic.
      }
      const quotaExhausted =
        response.status === 402 || /(quota|billing|credits?|insufficient)/.test(errorText)
      if (response.status === 429) {
        return failure({
          category: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED',
          model: this.model,
          latencyMs,
          cooldownMs: parseRetryAfterMs(response.headers) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS,
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
      model?: string
      id?: string
      choices?: Array<{
        finish_reason?: string
        message?: { content?: string | null }
      }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
        cost?: number
        completion_tokens_details?: { reasoning_tokens?: number }
      }
    }
    try {
      json = await response.json()
    } catch {
      return failure({ category: 'CONTRACT_FAILURE', model: this.model, latencyMs, providerRequestId })
    }

    const choice = json.choices?.[0]
    const usage: AdvisorTokenUsage | undefined = json.usage
      ? {
          inputTokens: json.usage.prompt_tokens,
          outputTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
          reasoningTokens: json.usage.completion_tokens_details?.reasoning_tokens,
          estimatedCostUsd: json.usage.cost,
        }
      : undefined
    return validateAdvisorProviderContent(
      choice?.message?.content,
      new Set(packet.hypotheses.map((item) => item.id)),
      {
        provider: this.id,
        model: json.model ?? this.model,
        latencyMs,
        usage,
        finishReason: choice?.finish_reason,
        providerRequestId: requestId(response.headers) ?? safeRequestId(json.id),
      },
    )
  }

  async reviewWriting(
    packet: WritingReviewPacket,
    options: AdvisorRequestOptions,
  ): Promise<WritingReviewProviderResult> {
    const started = Date.now()
    if (!this.config.writingReviewEnabled || !this.config.openRouterApiKey || !this.model) {
      return failure({ category: 'PROVIDER_UNAVAILABLE', model: this.model || 'unconfigured', latencyMs: 0 })
    }
    if (options.signal?.aborted) {
      return failure({ category: 'STALE_REQUEST', model: this.model, latencyMs: 0 })
    }
    const remainingMs = Math.min(options.timeoutMs, options.deadlineAt - Date.now())
    if (remainingMs <= 0) {
      return failure({ category: 'TIMEOUT', model: this.model, latencyMs: 0 })
    }
    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), remainingMs)
    let response: Response
    try {
      response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.openRouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: options.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: WRITING_REVIEW_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(packet) },
          ],
        }),
        signal: mergedSignal(options.signal, timeoutController.signal),
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
    const providerRequestId = requestId(response.headers)
    if (!response.ok) {
      let errorText = ''
      try {
        errorText = JSON.stringify(await response.clone().json()).toLowerCase()
      } catch {
        // Status mapping below remains deterministic.
      }
      const quotaExhausted =
        response.status === 402 || /(quota|billing|credits?|insufficient)/.test(errorText)
      if (response.status === 429) {
        return failure({
          category: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED',
          model: this.model,
          latencyMs,
          cooldownMs: parseRetryAfterMs(response.headers) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS,
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
      model?: string
      id?: string
      choices?: Array<{
        finish_reason?: string
        message?: { content?: string | null }
      }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
        cost?: number
        completion_tokens_details?: { reasoning_tokens?: number }
      }
    }
    try {
      json = await response.json()
    } catch {
      return failure({ category: 'CONTRACT_FAILURE', model: this.model, latencyMs, providerRequestId })
    }
    const choice = json.choices?.[0]
    const usage: AdvisorTokenUsage | undefined = json.usage
      ? {
          inputTokens: json.usage.prompt_tokens,
          outputTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
          reasoningTokens: json.usage.completion_tokens_details?.reasoning_tokens,
          estimatedCostUsd: json.usage.cost,
        }
      : undefined
    return validateWritingReviewProviderContent(choice?.message?.content, packet.snippet, {
      provider: this.id,
      model: json.model ?? this.model,
      latencyMs,
      usage,
      finishReason: choice?.finish_reason,
      providerRequestId: requestId(response.headers) ?? safeRequestId(json.id),
    })
  }
}

export { OpenRouterAdvisorProvider as OpenRouterAdapter }
