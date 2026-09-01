/**
 * Final provider closure: real HTTP probes + real manager chain.
 * Writes sanitized evidence only. Never prints credentials.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBackendEnvFile, loadConfig, type AppConfig } from '../backend/src/config/env.ts'
import { ProviderHealthManager } from '../backend/src/health/providerHealth.ts'
import { GroqAdvisorProvider } from '../backend/src/providers/groqAdvisorProvider.ts'
import { GeminiAdvisorProvider } from '../backend/src/providers/geminiAdvisorProvider.ts'
import { OpenRouterAdvisorProvider } from '../backend/src/providers/openRouterAdvisorProvider.ts'
import {
  ADVISOR_CONTRACT_VERSION,
  type AdvisorPacket,
  type AdvisorProviderResult,
  type HypothesisAdvisorProvider,
} from '../backend/src/providers/advisorTypes.ts'
import {
  resetAdvisorProviderRuntimeForTests,
  runHypothesisAdvisorProvider,
} from '../backend/src/providers/hypothesisAdvisorProvider.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '../tests/e2e/results/provider-final-closure.json')

const packet: AdvisorPacket = {
  cycleId: 'closure',
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
}

const input = {
  cycleId: 'closure',
  snippet: packet.snippet,
  allowedIntents: packet.allowedIntents,
  hypotheses: packet.hypotheses,
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitize(result: AdvisorProviderResult) {
  const ids = result.ok ? result.rankedHypothesisIds : []
  const known = new Set(packet.hypotheses.map((item) => item.id))
  return {
    provider: result.provider,
    model: result.model,
    ok: result.ok,
    status: result.ok ? 'SUCCESS' : result.category,
    contractValid: result.ok,
    knownIdsOnly: result.ok ? ids.every((id) => known.has(id)) : false,
    noDuplicates: result.ok ? new Set(ids).size === ids.length : false,
    rankedIds: result.ok ? ids : undefined,
    latencyMs: result.latencyMs,
    usage: result.usage ?? null,
    finishReason: result.finishReason ?? null,
    requestIdPresent: Boolean(result.providerRequestId),
  }
}

async function probe(provider: HypothesisAdvisorProvider, maxTokens: number, timeoutMs: number) {
  const result = await provider.rankHypotheses(
    { ...packet, cycleId: `${provider.id}-closure` },
    {
      requestId: `${provider.id}-closure`,
      deadlineAt: Date.now() + timeoutMs,
      timeoutMs,
      maxTokens,
      contractVersion: ADVISOR_CONTRACT_VERSION,
      requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
    },
  )
  return sanitize(result)
}

function hostsCalled(urls: string[]) {
  return [...new Set(urls.map((url) => {
    try {
      return new URL(url).host
    } catch {
      return 'invalid'
    }
  }))]
}

function wrapFetch(onRequest: (url: string) => Response | void): () => void {
  const original = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const override = onRequest(url)
    if (override) return override
    return original(input, init)
  }
  return () => {
    globalThis.fetch = original
  }
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

async function main() {
  loadBackendEnvFile()
  const base = loadConfig()
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    productionFlags: {
      advisorEnabled: base.advisorEnabled,
      advisorFallbackEnabled: base.advisorFallbackEnabled,
      groqAdvisorEnabled: base.groqAdvisorEnabled,
      geminiAdvisorEnabled: base.geminiAdvisorEnabled,
      openRouterAdvisorEnabled: base.openRouterAdvisorEnabled,
      groqAdvisorMaxTokens: base.groqAdvisorMaxTokens,
      geminiAdvisorModel: base.geminiAdvisorModel,
      groqAdvisorModel: base.groqAdvisorModel,
      openRouterAdvisorModel: base.openRouterAdvisorModel || 'NOT CONFIGURED',
      applyMode: 'shadow',
    },
    credentials: {
      groq: Boolean(base.groqApiKey),
      gemini: Boolean(base.geminiApiKey),
      openrouter: Boolean(base.openRouterApiKey),
    },
  }

  const health = new ProviderHealthManager()
  const groq = new GroqAdvisorProvider(
    { ...base, advisorEnabled: true, groqAdvisorEnabled: true },
    health,
  )
  const gemini = new GeminiAdvisorProvider(
    { ...base, advisorEnabled: true, geminiAdvisorEnabled: true },
    health,
  )
  const openrouter = new OpenRouterAdvisorProvider(
    { ...base, advisorEnabled: true, openRouterAdvisorEnabled: true },
    health,
  )

  report.groq = {
    configuredModel: base.groqAdvisorModel,
    maxTokens: base.groqAdvisorMaxTokens,
    outcome: await probe(groq, base.groqAdvisorMaxTokens, 5_000),
  }
  await sleep(700)
  report.gemini = {
    configuredModel: base.geminiAdvisorModel,
    maxTokens: base.geminiAdvisorMaxTokens,
    productionEnabled: base.geminiAdvisorEnabled,
    outcome: await probe(gemini, base.geminiAdvisorMaxTokens, 8_000),
  }

  if (base.openRouterApiKey && base.openRouterAdvisorModel) {
    report.openrouter = {
      configuredModel: base.openRouterAdvisorModel,
      outcome: await probe(openrouter, base.openRouterAdvisorMaxTokens, 8_000),
    }
  } else if (base.openRouterApiKey) {
    const started = Date.now()
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${base.openRouterApiKey}` },
    })
    report.openrouter = {
      configuredModel: 'NOT CONFIGURED',
      ranking: 'skipped_no_model',
      authCheck: {
        realHttp: true,
        httpStatus: response.status,
        latencyMs: Date.now() - started,
      },
    }
  } else {
    report.openrouter = { skipped: 'OPENROUTER_API_KEY missing' }
  }

  const liveConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
    ...base,
    advisorEnabled: true,
    advisorFallbackEnabled: true,
    groqAdvisorEnabled: true,
    geminiAdvisorEnabled: true,
    openRouterAdvisorEnabled: Boolean(base.openRouterApiKey && base.openRouterAdvisorModel),
    advisorTimeoutMs: 8_000,
    advisorGlobalRequestsPerMinute: 1_000,
    ...overrides,
  })

  {
    const urls: string[] = []
    const restore = wrapFetch((url) => {
      urls.push(url)
    })
    resetAdvisorProviderRuntimeForTests()
    try {
      const result = await runHypothesisAdvisorProvider(liveConfig(), { ...input, cycleId: 'chain-a' }, undefined, 'chain-a')
      report.chainA = {
        winner: result.provider,
        model: result.model,
        fallbackUsed: result.fallbackUsed,
        attempts: result.attempts,
        hosts: hostsCalled(urls),
        geminiCalled: urls.some((url) => url.includes('generativelanguage.googleapis.com')),
        openRouterCalled: urls.some((url) => url.includes('openrouter.ai')),
        pass: result.provider === 'groq' && !urls.some((url) => url.includes('generativelanguage.googleapis.com') || url.includes('openrouter.ai')),
      }
    } catch (error) {
      report.chainA = { error: error instanceof Error ? error.name : 'failed', hosts: hostsCalled(urls) }
    } finally {
      restore()
    }
  }

  await sleep(700)

  {
    const urls: string[] = []
    const restore = wrapFetch((url) => {
      urls.push(url)
      if (url.includes('api.groq.com')) {
        return jsonResponse(429, { error: { message: 'rate limited', type: 'rate_limit' } }, { 'retry-after': '1' })
      }
    })
    resetAdvisorProviderRuntimeForTests()
    try {
      const result = await runHypothesisAdvisorProvider(liveConfig(), { ...input, cycleId: 'chain-b' }, undefined, 'chain-b')
      report.chainB = {
        winner: result.provider,
        model: result.model,
        fallbackUsed: result.fallbackUsed,
        fallbackReason: result.fallbackReason,
        attempts: result.attempts,
        hosts: hostsCalled(urls),
        openRouterCalled: urls.some((url) => url.includes('openrouter.ai')),
        pass:
          result.provider === 'gemini'
          && result.fallbackUsed
          && !urls.some((url) => url.includes('openrouter.ai')),
      }
    } catch (error) {
      report.chainB = { error: error instanceof Error ? error.name : 'failed', hosts: hostsCalled(urls) }
    } finally {
      restore()
    }
  }

  {
    const urls: string[] = []
    const restore = wrapFetch((url) => {
      urls.push(url)
      if (url.includes('api.groq.com') || url.includes('generativelanguage.googleapis.com')) {
        return jsonResponse(503, { error: { message: 'unavailable' } })
      }
    })
    resetAdvisorProviderRuntimeForTests()
    try {
      const result = await runHypothesisAdvisorProvider(liveConfig(), { ...input, cycleId: 'chain-c' }, undefined, 'chain-c')
      report.chainC = {
        winner: result.provider,
        attempts: result.attempts,
        hosts: hostsCalled(urls),
        note: base.openRouterAdvisorModel ? 'openrouter model configured' : 'OPENROUTER MODEL: NOT CONFIGURED',
        pass: Boolean(base.openRouterAdvisorModel) && result.provider === 'openrouter',
      }
    } catch (error) {
      report.chainC = {
        localAuthoritative: true,
        hosts: hostsCalled(urls),
        note: base.openRouterAdvisorModel ? 'third provider failed' : 'OPENROUTER MODEL: NOT CONFIGURED',
        pass: false,
        error: error instanceof Error ? error.name : 'failed',
      }
    } finally {
      restore()
    }
  }

  {
    const restore = wrapFetch((url) => {
      if (
        url.includes('api.groq.com')
        || url.includes('generativelanguage.googleapis.com')
        || url.includes('openrouter.ai')
      ) {
        return jsonResponse(503, { error: { message: 'unavailable' } })
      }
    })
    resetAdvisorProviderRuntimeForTests()
    try {
      await runHypothesisAdvisorProvider(liveConfig(), { ...input, cycleId: 'chain-d' }, undefined, 'chain-d')
      report.chainD = { pass: false, note: 'unexpected success' }
    } catch {
      report.chainD = { pass: true, localDecisionAuthoritative: true }
    } finally {
      restore()
    }
  }

  report.chainE = {
    noVoting: true,
    firstValidWins: (report.chainA as { pass?: boolean } | undefined)?.pass === true,
    pass: (report.chainA as { pass?: boolean } | undefined)?.pass === true,
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote sanitized closure evidence to ${outPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'closure probe failed')
  process.exit(1)
})
