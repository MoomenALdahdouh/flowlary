/**
 * Sanitized live writing-review probe. Never prints API keys or field text.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WRITING_REVIEW_CONTRACT_VERSION, type WritingReviewPacket } from '@flowlary/shared'
import { loadBackendEnvFile, loadConfig } from '../backend/src/config/env.ts'
import { ProviderHealthManager } from '../backend/src/health/providerHealth.ts'
import { GroqAdvisorProvider } from '../backend/src/providers/groqAdvisorProvider.ts'
import { GeminiAdvisorProvider } from '../backend/src/providers/geminiAdvisorProvider.ts'
import { OpenRouterAdvisorProvider } from '../backend/src/providers/openRouterAdvisorProvider.ts'
import { WritingReviewProviderManager } from '../backend/src/providers/writingReviewProviderManager.ts'
import type { WritingReviewProvider } from '../backend/src/providers/writingReviewTypes.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../tests/e2e/results')
const GAP_MS = 800

const packet: WritingReviewPacket = {
  cycleId: 'probe-review',
  snippet: 'hello comming tomorrow',
  allowedKinds: ['spelling', 'grammar', 'punctuation', 'layout_suspect'],
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitize(result: {
  ok: boolean
  provider: string
  model: string
  latencyMs: number
  category?: string
  verdict?: string
  reasonCode?: string
  edits?: unknown[]
  providerRequestId?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    reasoningTokens?: number
  }
  finishReason?: string
}) {
  return {
    provider: result.provider,
    model: result.model,
    ok: result.ok,
    status: result.ok ? 'SUCCESS' : result.category,
    contractValid: result.ok,
    verdict: result.ok ? result.verdict : undefined,
    reasonCode: result.ok ? result.reasonCode : undefined,
    editCount: result.ok ? result.edits?.length ?? 0 : undefined,
    latencyMs: result.latencyMs,
    usage: result.usage ?? null,
    finishReason: result.finishReason ?? null,
    requestIdPresent: Boolean(result.providerRequestId),
  }
}

async function probeProvider(provider: WritingReviewProvider, timeoutMs: number, maxTokens: number) {
  const result = await provider.reviewWriting(packet, {
    requestId: `${provider.id}-review-probe`,
    deadlineAt: Date.now() + timeoutMs,
    timeoutMs,
    maxTokens,
    contractVersion: WRITING_REVIEW_CONTRACT_VERSION,
    requiredCapabilities: ['writing_review', 'structured_json'],
  })
  return sanitize(result)
}

async function main() {
  loadBackendEnvFile()
  const base = loadConfig()
  const health = new ProviderHealthManager()
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    notes: [
      'Sanitized live writing-review probe. Secrets omitted.',
      'Chain is Groq then Gemini then OpenRouter, failure-only, no voting.',
    ],
    writingReviewEnabled: base.writingReviewEnabled,
    writingReviewFallbackEnabled: base.writingReviewFallbackEnabled,
    writingReviewTimeoutMs: base.writingReviewTimeoutMs,
  }

  if (base.groqApiKey) {
    const groq = new GroqAdvisorProvider({ ...base, writingReviewEnabled: true }, health)
    report.groq = {
      configuredModel: base.groqAdvisorModel,
      outcomes: [await probeProvider(groq, 5_000, base.groqAdvisorMaxTokens)],
    }
  } else {
    report.groq = { skipped: 'GROQ_API_KEY missing in local env' }
  }

  await sleep(GAP_MS)

  if (base.geminiApiKey) {
    const gemini = new GeminiAdvisorProvider({ ...base, writingReviewEnabled: true }, health)
    report.gemini = {
      configuredModel: base.geminiAdvisorModel,
      rankingEnabled: base.geminiAdvisorEnabled,
      outcomes: [await probeProvider(gemini, 8_000, base.geminiAdvisorMaxTokens)],
    }
  } else {
    report.gemini = { skipped: 'GEMINI_API_KEY missing in local env' }
  }

  await sleep(GAP_MS)

  if (base.openRouterApiKey && base.openRouterAdvisorModel) {
    const openrouter = new OpenRouterAdvisorProvider({ ...base, writingReviewEnabled: true }, health)
    report.openrouter = {
      configuredModel: base.openRouterAdvisorModel,
      rankingEnabled: base.openRouterAdvisorEnabled,
      outcomes: [await probeProvider(openrouter, 8_000, base.openRouterAdvisorMaxTokens)],
    }
  } else {
    report.openrouter = {
      skipped: !base.openRouterApiKey
        ? 'OPENROUTER_API_KEY missing in local env'
        : 'OPENROUTER_ADVISOR_MODEL unset',
    }
  }

  const injectedHealth = new ProviderHealthManager()
  const failingGroq: WritingReviewProvider = {
    id: 'groq',
    model: 'injected-fail',
    capabilities: ['writing_review', 'structured_json'],
    enabled: true,
    health: () => injectedHealth.snapshot('groq'),
    availability: () => ({ available: true, state: 'HEALTHY' as const }),
    async reviewWriting() {
      return {
        ok: false,
        provider: 'groq',
        model: 'injected-fail',
        category: 'RATE_LIMITED',
        retryable: true,
        fallbackEligible: true,
        latencyMs: 12,
        cooldownMs: 1,
      }
    },
  }
  const succeedingGemini: WritingReviewProvider = {
    id: 'gemini',
    model: 'injected-success',
    capabilities: ['writing_review', 'structured_json'],
    enabled: false,
    health: () => injectedHealth.snapshot('gemini'),
    availability: () => ({ available: true, state: 'HEALTHY' as const }),
    async reviewWriting() {
      return {
        ok: true,
        provider: 'gemini',
        model: 'injected-success',
        verdict: 'no_change',
        ambiguityClass: 'ok',
        reasonCode: 'no_change',
        edits: [],
        latencyMs: 8,
      }
    },
  }
  const manager = new WritingReviewProviderManager(
    [failingGroq, succeedingGemini],
    injectedHealth,
    Date.now,
    { groq: 180, gemini: 512 },
    1,
    3,
  )
  const fallback = await manager.reviewWriting(packet, {
    requestId: 'fallback-injected',
    deadlineAt: Date.now() + 2_000,
    timeoutMs: 2_000,
    maxTokens: 180,
    contractVersion: WRITING_REVIEW_CONTRACT_VERSION,
    requiredCapabilities: ['writing_review', 'structured_json'],
  })
  report.injectedFallback = {
    ok: fallback.ok,
    winner: fallback.ok ? fallback.provider : fallback.provider,
    fallbackUsed: fallback.fallbackUsed,
    attempts: fallback.attempts.map((attempt) => ({
      provider: attempt.provider,
      result: attempt.result,
      latencyMs: attempt.latencyMs,
    })),
    localDecisionAuthoritative: fallback.ok ? false : fallback.localDecisionAuthoritative,
  }

  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'writing-review-provider-probe.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote sanitized probe evidence to ${outPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'probe failed')
  process.exit(1)
})
