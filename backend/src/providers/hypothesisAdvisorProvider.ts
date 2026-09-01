import {
  HYPOTHESIS_ADVISOR_MAX_HYPOTHESES,
  HYPOTHESIS_ADVISOR_MAX_SNIPPET,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { ProviderHealthManager } from '../health/providerHealth.ts'
import { AdvisorProviderManager } from './advisorProviderManager.ts'
import { GeminiAdvisorProvider } from './geminiAdvisorProvider.ts'
import { GroqAdvisorProvider } from './groqAdvisorProvider.ts'
import { OpenRouterAdvisorProvider } from './openRouterAdvisorProvider.ts'
import {
  ADVISOR_CONTRACT_VERSION,
  AdvisorProviderFailureError,
  type AdvisorManagerFailure,
  type AdvisorManagerResult,
  type AdvisorPacket,
  type HypothesisAdvisorProvider,
  type ProviderHealthSnapshot,
} from './advisorTypes.ts'

export type HypothesisAdvisorInput = {
  cycleId: string
  snippet: string
  allowedIntents: string[]
  hypotheses: Array<{
    id: string
    intent: string
    localScore: number
    risk: string
    needsLLM: boolean
    conflicts: string[]
    evidence: string[]
  }>
}

export type HypothesisAdvisorResult = {
  rankedHypothesisIds: string[]
  ambiguityClass: string
  reasonCode: string
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
  attempts: AdvisorManagerResult['attempts']
}

type AdvisorRuntime = {
  health: ProviderHealthManager
  manager: AdvisorProviderManager
  globalWindowStart: number
  globalCount: number
}

let runtimes = new WeakMap<AppConfig, AdvisorRuntime>()

function runtimeFor(config: AppConfig): AdvisorRuntime {
  const existing = runtimes.get(config)
  if (existing) return existing
  const health = new ProviderHealthManager()
  const groq = new GroqAdvisorProvider(config, health)
  const gemini = new GeminiAdvisorProvider(config, health)
  const openRouter = new OpenRouterAdvisorProvider(config, health)
  const providersById = new Map<string, HypothesisAdvisorProvider>([
    [groq.id, groq],
    [gemini.id, gemini],
    [openRouter.id, openRouter],
  ])
  let providers = config.advisorProviderOrder
    .map((provider) => providersById.get(provider))
    .filter((provider): provider is HypothesisAdvisorProvider => Boolean(provider))
    .filter((provider) => provider.enabled)
  if (!config.advisorFallbackEnabled) providers = providers.slice(0, 1)
  const runtime: AdvisorRuntime = {
    health,
    manager: new AdvisorProviderManager(
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

function enforceGlobalLimit(config: AppConfig, runtime: AdvisorRuntime): void {
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

export async function runHypothesisAdvisorProvider(
  config: AppConfig,
  input: HypothesisAdvisorInput,
  signal?: AbortSignal,
  requestId = 'advisor',
): Promise<HypothesisAdvisorResult> {
  if (!input.cycleId || input.hypotheses.length === 0) throw new Error('invalid_request')
  if (input.hypotheses.length > HYPOTHESIS_ADVISOR_MAX_HYPOTHESES) throw new Error('invalid_request')
  if (!config.advisorEnabled) {
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

  const packet: AdvisorPacket = {
    cycleId: input.cycleId,
    snippet: input.snippet.slice(0, HYPOTHESIS_ADVISOR_MAX_SNIPPET),
    allowedIntents: input.allowedIntents,
    hypotheses: input.hypotheses,
  }
  const deadlineAt = Date.now() + config.advisorTimeoutMs
  const result = await runtime.manager.rankHypotheses(packet, {
    requestId,
    signal,
    deadlineAt,
    timeoutMs: config.advisorTimeoutMs,
    maxTokens: config.groqAdvisorMaxTokens,
    contractVersion: ADVISOR_CONTRACT_VERSION,
    requiredCapabilities: [
      'hypothesis_ranking',
      'structured_json',
      'id_only_output',
    ],
  })

  if (!result.ok) throw new AdvisorProviderFailureError(result)
  return {
    rankedHypothesisIds: result.rankedHypothesisIds,
    ambiguityClass: result.ambiguityClass,
    reasonCode: result.reasonCode,
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

export function getAdvisorProviderHealth(config: AppConfig): ProviderHealthSnapshot[] {
  const runtime = runtimeFor(config)
  return ['groq', 'gemini', 'openrouter'].map((provider) => runtime.health.snapshot(provider))
}

export function resetAdvisorProviderRuntimeForTests(): void {
  runtimes = new WeakMap<AppConfig, AdvisorRuntime>()
}
