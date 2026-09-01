/**
 * Small paced live advisor probe. Writes sanitized evidence only.
 * Never prints API keys or packet snippets containing secrets.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBackendEnvFile, loadConfig } from '../backend/src/config/env.ts'
import { ProviderHealthManager } from '../backend/src/health/providerHealth.ts'
import { GroqAdvisorProvider } from '../backend/src/providers/groqAdvisorProvider.ts'
import { GeminiAdvisorProvider } from '../backend/src/providers/geminiAdvisorProvider.ts'
import { OpenRouterAdvisorProvider } from '../backend/src/providers/openRouterAdvisorProvider.ts'
import { AdvisorProviderManager } from '../backend/src/providers/advisorProviderManager.ts'
import {
  ADVISOR_CONTRACT_VERSION,
  type AdvisorPacket,
  type HypothesisAdvisorProvider,
} from '../backend/src/providers/advisorTypes.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../tests/e2e/results')
const MAX_PER_PROVIDER = 3
const GAP_MS = 800

const packet = (cycleId: string): AdvisorPacket => ({
  cycleId,
  snippet: 'review this API response',
  allowedIntents: ['preserve', 'fix_english'],
  hypotheses: [
    {
      id: 'h1',
      intent: 'preserve',
      localScore: 0.6,
      risk: 'low',
      needsLLM: true,
      conflicts: ['h2'],
      evidence: ['mixed_script'],
    },
    {
      id: 'h2',
      intent: 'fix_english',
      localScore: 0.5,
      risk: 'medium',
      needsLLM: true,
      conflicts: ['h1'],
      evidence: ['english_candidate'],
    },
  ],
})

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitizeResult(result: {
  ok: boolean
  provider: string
  model: string
  latencyMs: number
  category?: string
  rankedHypothesisIds?: string[]
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
    rankedIds: result.ok ? result.rankedHypothesisIds : undefined,
    latencyMs: result.latencyMs,
    usage: result.usage ?? null,
    finishReason: result.finishReason ?? null,
    requestIdPresent: Boolean(result.providerRequestId),
  }
}

async function probeProvider(
  provider: HypothesisAdvisorProvider,
  maxTokens: number,
  timeoutMs: number,
) {
  const outcomes: ReturnType<typeof sanitizeResult>[] = []
  let consecutive429 = 0
  for (let index = 0; index < MAX_PER_PROVIDER && consecutive429 < 2; index += 1) {
    const result = await provider.rankHypotheses(packet(`${provider.id}-probe-${index}`), {
      requestId: `${provider.id}-probe-${index}`,
      deadlineAt: Date.now() + timeoutMs,
      timeoutMs,
      maxTokens,
      contractVersion: ADVISOR_CONTRACT_VERSION,
      requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
    })
    consecutive429 = !result.ok && result.category === 'RATE_LIMITED' ? consecutive429 + 1 : 0
    outcomes.push(sanitizeResult(result))
    if (index < MAX_PER_PROVIDER - 1) await sleep(GAP_MS)
  }
  return outcomes
}

async function main() {
  loadBackendEnvFile()
  const base = loadConfig()
  const health = new ProviderHealthManager()
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    notes: [
      'Sanitized live probe. Secrets omitted.',
      'OpenRouter is skipped unless a non-example local key and model are configured.',
      'Compromised keys found in tracked examples must not be reused.',
    ],
  }

  if (base.groqApiKey) {
    const groq = new GroqAdvisorProvider(
      { ...base, advisorEnabled: true, groqAdvisorEnabled: true },
      health,
    )
    report.groq = {
      configuredModel: base.groqAdvisorModel,
      maxTokens: base.groqAdvisorMaxTokens,
      outcomes: await probeProvider(groq, base.groqAdvisorMaxTokens, 5_000),
    }
  } else {
    report.groq = { skipped: 'GROQ_API_KEY missing in local env' }
  }

  if (base.geminiApiKey) {
    const gemini = new GeminiAdvisorProvider(
      { ...base, advisorEnabled: true, geminiAdvisorEnabled: true, advisorFallbackEnabled: false },
      health,
    )
    report.gemini = {
      configuredModel: base.geminiAdvisorModel,
      maxTokens: base.geminiAdvisorMaxTokens,
      productionEnabled: base.geminiAdvisorEnabled,
      outcomes: await probeProvider(gemini, base.geminiAdvisorMaxTokens, 8_000),
    }
  } else {
    report.gemini = { skipped: 'GEMINI_API_KEY missing in local env' }
  }

  if (base.openRouterApiKey && base.openRouterAdvisorModel) {
    const openrouter = new OpenRouterAdvisorProvider(
      { ...base, advisorEnabled: true, openRouterAdvisorEnabled: true },
      health,
    )
    report.openrouter = {
      configuredModel: base.openRouterAdvisorModel,
      maxTokens: base.openRouterAdvisorMaxTokens,
      outcomes: await probeProvider(openrouter, base.openRouterAdvisorMaxTokens, 8_000),
    }
  } else {
    report.openrouter = {
      skipped: !base.openRouterApiKey
        ? 'OPENROUTER_API_KEY missing in local env (example key treated as compromised; not reused)'
        : 'OPENROUTER_ADVISOR_MODEL unset',
    }
  }

  const injectedHealth = new ProviderHealthManager()
  const failingGroq = {
    id: 'groq' as const,
    model: 'injected-fail',
    capabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'] as const,
    enabled: true,
    health: () => injectedHealth.snapshot('groq'),
    availability: () => ({ available: true, state: 'ready' as const }),
    async rankHypotheses() {
      return {
        ok: false as const,
        provider: 'groq' as const,
        model: 'injected-fail',
        category: 'RATE_LIMITED' as const,
        retryable: true,
        fallbackEligible: true,
        latencyMs: 12,
        cooldownMs: 1,
      }
    },
  }
  const succeedingGemini = {
    id: 'gemini' as const,
    model: 'injected-success',
    capabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'] as const,
    enabled: true,
    health: () => injectedHealth.snapshot('gemini'),
    availability: () => ({ available: true, state: 'ready' as const }),
    async rankHypotheses() {
      return {
        ok: true as const,
        provider: 'gemini' as const,
        model: 'injected-success',
        rankedHypothesisIds: ['h1'],
        ambiguityClass: 'preserve',
        reasonCode: 'test',
        latencyMs: 8,
      }
    },
  }
  const manager = new AdvisorProviderManager(
    [failingGroq, succeedingGemini],
    injectedHealth,
    Date.now,
    { groq: 180, gemini: 512 },
    1,
    3,
  )
  const fallback = await manager.rankHypotheses(packet('fallback-injected'), {
    requestId: 'fallback-injected',
    deadlineAt: Date.now() + 2_000,
    timeoutMs: 2_000,
    maxTokens: 180,
    contractVersion: ADVISOR_CONTRACT_VERSION,
    requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
  })
  report.injectedFallback = {
    ok: fallback.ok,
    winner: fallback.ok ? fallback.provider : fallback.provider,
    fallbackUsed: fallback.fallbackUsed,
    attempts: fallback.attempts,
    localDecisionAuthoritative: fallback.localDecisionAuthoritative,
  }

  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'provider-probe.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote sanitized probe evidence to ${outPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'probe failed')
  process.exit(1)
})
