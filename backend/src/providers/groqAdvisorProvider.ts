import { GROQ_CHAT_COMPLETIONS_URL, HYPOTHESIS_ADVISOR_SYSTEM_PROMPT, WRITING_REVIEW_SYSTEM_PROMPT, type WritingReviewPacket } from '@flowlary/shared'
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

const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1000

type GroqErrorBody = {
  error?: {
    code?: string
    message?: string
    type?: string
    finish_reason?: string
  }
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    completion_tokens_details?: { reasoning_tokens?: number }
  }
}

function boundedCooldown(ms: number): number | undefined {
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  return Math.min(Math.ceil(ms), MAX_COOLDOWN_MS)
}

function parseDuration(value: string): number | undefined {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return undefined
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return boundedCooldown(Number(trimmed) * 1000)
  }
  const matches = [...trimmed.matchAll(/(\d+(?:\.\d+)?)\s*(ms|s|m|h)/g)]
  if (matches.length === 0) return undefined
  let total = 0
  for (const match of matches) {
    const amount = Number(match[1])
    const unit = match[2]
    total += unit === 'h'
      ? amount * 3_600_000
      : unit === 'm'
        ? amount * 60_000
        : unit === 's'
          ? amount * 1_000
          : amount
  }
  return boundedCooldown(total)
}

export function parseRetryAfterMs(
  headers: Pick<Headers, 'get'>,
  now = Date.now(),
): number | undefined {
  const retryAfter = headers.get('retry-after')
  if (retryAfter) {
    const duration = parseDuration(retryAfter)
    if (duration) return duration
    const at = Date.parse(retryAfter)
    if (Number.isFinite(at)) return boundedCooldown(at - now)
  }

  const resetTokens = headers.get('x-ratelimit-reset-tokens')
  const resetRequests = headers.get('x-ratelimit-reset-requests')
  const durations = [resetTokens, resetRequests]
    .filter((value): value is string => Boolean(value))
    .map(parseDuration)
    .filter((value): value is number => value !== undefined)
  return durations.length > 0 ? Math.max(...durations) : undefined
}

function safeProviderRequestId(headers: Pick<Headers, 'get'>): string | undefined {
  const value = headers.get('x-request-id') ?? headers.get('request-id')
  if (!value || value.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(value)) return undefined
  return value
}

function failure(input: {
  category: AdvisorProviderErrorCategory
  model: string
  latencyMs: number
  cooldownMs?: number
  usage?: AdvisorTokenUsage
  finishReason?: string
  providerRequestId?: string
}): AdvisorProviderFailure {
  const retryable = (
    input.category === 'RATE_LIMITED'
    || input.category === 'QUOTA_EXHAUSTED'
    || input.category === 'TIMEOUT'
    || input.category === 'SERVER_ERROR'
    || input.category === 'PROVIDER_UNAVAILABLE'
    || input.category === 'NETWORK_ERROR'
  )
  return {
    ok: false,
    provider: 'groq',
    ...input,
    retryable,
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

export class GroqAdvisorProvider implements HypothesisAdvisorProvider {
  readonly id = 'groq'
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
    return this.config.groqAdvisorModel
  }

  get enabled(): boolean {
    return this.config.advisorEnabled && this.config.groqAdvisorEnabled
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
    if (!this.config.groqApiKey) {
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
      response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: options.maxTokens,
          include_reasoning: false,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: HYPOTHESIS_ADVISOR_SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify(packet),
            },
          ],
        }),
        signal: mergeSignals(options.signal, timeoutController.signal),
      })
    } catch (error) {
      clearTimeout(timer)
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
    const providerRequestId = safeProviderRequestId(response.headers)
    if (!response.ok) {
      let body: GroqErrorBody | undefined
      try {
        body = await response.json() as GroqErrorBody
      } catch {
        body = undefined
      }
      const code = body?.error?.code
      const errorText = `${code ?? ''} ${body?.error?.type ?? ''} ${body?.error?.message ?? ''}`
        .toLowerCase()
      const quotaExhausted = /(quota|billing|credits?|spend|capacity)/.test(errorText)
      const errorUsage: AdvisorTokenUsage | undefined = body?.usage
        ? {
            inputTokens: body.usage.prompt_tokens,
            outputTokens: body.usage.completion_tokens,
            totalTokens: body.usage.total_tokens,
            reasoningTokens: body.usage.completion_tokens_details?.reasoning_tokens,
          }
        : undefined
      if (response.status === 429) {
        return failure({
          category: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED',
          model: this.model,
          latencyMs,
          cooldownMs: parseRetryAfterMs(response.headers) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS,
          usage: errorUsage,
          finishReason: body?.error?.finish_reason,
          providerRequestId,
        })
      }
      if (response.status === 401 || response.status === 403) {
        return failure({
          category: 'AUTH_FAILED',
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
      if (response.status === 400 && code === 'json_validate_failed') {
        return failure({
          category: 'CONTRACT_FAILURE',
          model: this.model,
          latencyMs,
          usage: errorUsage,
          finishReason: body?.error?.finish_reason,
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
      if (response.status >= 500) {
        return failure({
          category: 'SERVER_ERROR',
          model: this.model,
          latencyMs,
          providerRequestId,
        })
      }
      return failure({
        category: 'UNKNOWN',
        model: this.model,
        latencyMs,
        providerRequestId,
      })
    }

    let json: {
      model?: string
      choices?: Array<{
        finish_reason?: string
        message?: { content?: string | null }
      }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
        completion_tokens_details?: { reasoning_tokens?: number }
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

    const choice = json.choices?.[0]
    const usage: AdvisorTokenUsage | undefined = json.usage
      ? {
          inputTokens: json.usage.prompt_tokens,
          outputTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
          reasoningTokens: json.usage.completion_tokens_details?.reasoning_tokens,
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
        providerRequestId,
      },
    )
  }

  async reviewWriting(
    packet: WritingReviewPacket,
    options: AdvisorRequestOptions,
  ): Promise<WritingReviewProviderResult> {
    const started = Date.now()
    if (!this.config.writingReviewEnabled || !this.config.groqApiKey) {
      return failure({
        category: 'PROVIDER_UNAVAILABLE',
        model: this.model,
        latencyMs: 0,
      })
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
      response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: options.maxTokens,
          include_reasoning: false,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: WRITING_REVIEW_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(packet) },
          ],
        }),
        signal: mergeSignals(options.signal, timeoutController.signal),
      })
    } catch (error) {
      clearTimeout(timer)
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
    const providerRequestId = safeProviderRequestId(response.headers)
    if (!response.ok) {
      let body: GroqErrorBody | undefined
      try {
        body = await response.json() as GroqErrorBody
      } catch {
        body = undefined
      }
      const code = body?.error?.code
      const errorText = `${code ?? ''} ${body?.error?.type ?? ''} ${body?.error?.message ?? ''}`
        .toLowerCase()
      const quotaExhausted = /(quota|billing|credits?|spend|capacity)/.test(errorText)
      const errorUsage: AdvisorTokenUsage | undefined = body?.usage
        ? {
            inputTokens: body.usage.prompt_tokens,
            outputTokens: body.usage.completion_tokens,
            totalTokens: body.usage.total_tokens,
            reasoningTokens: body.usage.completion_tokens_details?.reasoning_tokens,
          }
        : undefined
      if (response.status === 429) {
        return failure({
          category: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED',
          model: this.model,
          latencyMs,
          cooldownMs: parseRetryAfterMs(response.headers) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS,
          usage: errorUsage,
          finishReason: body?.error?.finish_reason,
          providerRequestId,
        })
      }
      if (response.status === 401 || response.status === 403) {
        return failure({ category: 'AUTH_FAILED', model: this.model, latencyMs, providerRequestId })
      }
      if (response.status === 408 || response.status === 504) {
        return failure({ category: 'TIMEOUT', model: this.model, latencyMs, providerRequestId })
      }
      if (response.status === 400 && code === 'json_validate_failed') {
        return failure({
          category: 'CONTRACT_FAILURE',
          model: this.model,
          latencyMs,
          usage: errorUsage,
          finishReason: body?.error?.finish_reason,
          providerRequestId,
        })
      }
      if (response.status === 400 || response.status === 404) {
        return failure({ category: 'INVALID_REQUEST', model: this.model, latencyMs, providerRequestId })
      }
      if (response.status >= 500) {
        return failure({ category: 'SERVER_ERROR', model: this.model, latencyMs, providerRequestId })
      }
      return failure({ category: 'UNKNOWN', model: this.model, latencyMs, providerRequestId })
    }

    let json: {
      model?: string
      choices?: Array<{
        finish_reason?: string
        message?: { content?: string | null }
      }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
        completion_tokens_details?: { reasoning_tokens?: number }
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

    const choice = json.choices?.[0]
    const usage: AdvisorTokenUsage | undefined = json.usage
      ? {
          inputTokens: json.usage.prompt_tokens,
          outputTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
          reasoningTokens: json.usage.completion_tokens_details?.reasoning_tokens,
        }
      : undefined
    return validateWritingReviewProviderContent(
      choice?.message?.content,
      packet.snippet,
      {
        provider: this.id,
        model: json.model ?? this.model,
        latencyMs,
        usage,
        finishReason: choice?.finish_reason,
        providerRequestId,
      },
    )
  }
}

export { GroqAdvisorProvider as GroqAdapter }
