import {
  WRITING_REVIEW_CONTRACT_VERSION,
  WRITING_REVIEW_MAX_SNIPPET,
  type WritingReviewEdit,
  type WritingReviewPacket,
  type WritingReviewVerdict,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { ProviderHealthManager } from '../health/providerHealth.ts'
import { AdvisorProviderFailureError } from './advisorTypes.ts'
import type { AdvisorManagerFailure } from './advisorTypes.ts'
import { GeminiAdvisorProvider } from './geminiAdvisorProvider.ts'
import { GroqAdvisorProvider } from './groqAdvisorProvider.ts'
import { OpenRouterAdvisorProvider } from './openRouterAdvisorProvider.ts'
import { WritingReviewProviderManager } from './writingReviewProviderManager.ts'
import type { WritingReviewManagerResult, WritingReviewProvider } from './writingReviewTypes.ts'

export type WritingReviewInput = {
  cycleId: string
  snippet: string
  contextBefore?: string
  contextAfter?: string
  allowedKinds?: WritingReviewPacket['allowedKinds']
}

export type WritingReviewResult = {
  verdict: WritingReviewVerdict
  ambiguityClass: string
  reasonCode: string
  edits: WritingReviewEdit[]
  provider: string
  model: string
  latencyMs: number
  fallbackUsed: boolean
  fallbackReason?: string
  providerRequestId?: string
  finishReason?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  attempts: WritingReviewManagerResult['attempts']
}

type ReviewRuntime = {
  health: ProviderHealthManager
  manager: WritingReviewProviderManager
  globalWindowStart: number
  globalCount: number
}

let runtimes = new WeakMap<AppConfig, ReviewRuntime>()

function runtimeFor(config: AppConfig): ReviewRuntime {
  const existing = runtimes.get(config)
  if (existing) return existing
  const health = new ProviderHealthManager()
  const groq = new GroqAdvisorProvider(config, health)
  const gemini = new GeminiAdvisorProvider(config, health)
  const openRouter = new OpenRouterAdvisorProvider(config, health)
  const providersById = new Map<string, WritingReviewProvider>([
    [groq.id, groq],
    [gemini.id, gemini],
    [openRouter.id, openRouter],
  ])
  let providers = config.advisorProviderOrder
    .map((provider) => providersById.get(provider))
    .filter((provider): provider is WritingReviewProvider => Boolean(provider))
    .filter((provider) => writingReviewProviderConfigured(config, provider.id))
  if (!config.writingReviewFallbackEnabled) providers = providers.slice(0, 1)
  const runtime: ReviewRuntime = {
    health,
    manager: new WritingReviewProviderManager(
      providers,
      health,
      Date.now,
      {
        groq: config.groqAdvisorMaxTokens,
        gemini: config.geminiAdvisorMaxTokens,
        openrouter: config.openRouterAdvisorMaxTokens,
      },
      config.advisorFallbackMinRemainingMs,
      Math.min(config.advisorMaxProviderAttempts, config.advisorMaxFallbacks + 1),
      {
        groq: config.groqAdvisorRequestsPerMinute,
        gemini: config.geminiAdvisorRequestsPerMinute,
        openrouter: config.openRouterAdvisorRequestsPerMinute,
      },
    ),
    globalWindowStart: Date.now(),
    globalCount: 0,
  }
  runtimes.set(config, runtime)
  return runtime
}

function writingReviewProviderConfigured(config: AppConfig, id: string): boolean {
  if (!config.writingReviewEnabled) return false
  if (id === 'groq') return Boolean(config.groqApiKey)
  if (id === 'gemini') return Boolean(config.geminiApiKey)
  if (id === 'openrouter') return Boolean(config.openRouterApiKey && config.openRouterAdvisorModel)
  return false
}

function enforceGlobalLimit(config: AppConfig, runtime: ReviewRuntime): void {
  const now = Date.now()
  if (now - runtime.globalWindowStart >= 60_000) {
    runtime.globalWindowStart = now
    runtime.globalCount = 0
  }
  if (runtime.globalCount >= config.advisorGlobalRequestsPerMinute) {
    const result: AdvisorManagerFailure = {
      ok: false,
      provider: 'none',
      model: 'none',
      category: 'RATE_LIMITED',
      retryable: false,
      fallbackEligible: false,
      latencyMs: 0,
      cooldownMs: Math.max(1, 60_000 - (now - runtime.globalWindowStart)),
      fallbackUsed: false,
      attempts: [],
    }
    throw new AdvisorProviderFailureError(result)
  }
  runtime.globalCount += 1
}

export async function runWritingReviewProvider(
  config: AppConfig,
  input: WritingReviewInput,
  signal?: AbortSignal,
  requestId = 'writing-review',
): Promise<WritingReviewResult> {
  const snippet = input.snippet.trim()
  if (!input.cycleId || !snippet) throw new Error('invalid_request')
  if (!config.writingReviewEnabled) {
    throw new AdvisorProviderFailureError({
      ok: false,
      provider: 'none',
      model: 'none',
      category: 'PROVIDER_UNAVAILABLE',
      retryable: false,
      fallbackEligible: false,
      latencyMs: 0,
      fallbackUsed: false,
      attempts: [],
    })
  }
  const runtime = runtimeFor(config)
  enforceGlobalLimit(config, runtime)

  const packet: WritingReviewPacket = {
    cycleId: input.cycleId,
    snippet: snippet.slice(0, WRITING_REVIEW_MAX_SNIPPET),
    contextBefore: input.contextBefore,
    contextAfter: input.contextAfter,
    allowedKinds: input.allowedKinds ?? ['spelling', 'grammar', 'punctuation', 'layout_suspect'],
  }
  const deadlineAt = Date.now() + config.writingReviewTimeoutMs
  const result = await runtime.manager.reviewWriting(packet, {
    requestId,
    signal,
    deadlineAt,
    timeoutMs: config.writingReviewTimeoutMs,
    maxTokens: config.groqAdvisorMaxTokens,
    contractVersion: WRITING_REVIEW_CONTRACT_VERSION,
    requiredCapabilities: ['writing_review', 'structured_json'],
  })

  if (!result.ok) throw new AdvisorProviderFailureError(result)
  return {
    verdict: result.verdict,
    ambiguityClass: result.ambiguityClass,
    reasonCode: result.reasonCode,
    edits: result.edits,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
    fallbackUsed: result.fallbackUsed,
    fallbackReason: result.fallbackReason,
    providerRequestId: result.providerRequestId,
    finishReason: result.finishReason,
    inputTokens: result.usage?.inputTokens,
    outputTokens: result.usage?.outputTokens,
    totalTokens: result.usage?.totalTokens,
    reasoningTokens: result.usage?.reasoningTokens,
    attempts: result.attempts,
  }
}

export function resetWritingReviewProviderRuntimeForTests(): void {
  runtimes = new WeakMap<AppConfig, ReviewRuntime>()
}
