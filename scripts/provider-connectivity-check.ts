/**
 * One-request connectivity check for Groq, Gemini, and OpenRouter.
 * Prints WORKING / NOT WORKING only. Never prints API keys.
 */
import { loadBackendEnvFile, loadConfig } from '../backend/src/config/env.ts'
import { ProviderHealthManager } from '../backend/src/health/providerHealth.ts'
import { GroqAdvisorProvider } from '../backend/src/providers/groqAdvisorProvider.ts'
import { GeminiAdvisorProvider } from '../backend/src/providers/geminiAdvisorProvider.ts'
import { OpenRouterAdvisorProvider } from '../backend/src/providers/openRouterAdvisorProvider.ts'
import {
  ADVISOR_CONTRACT_VERSION,
  type AdvisorPacket,
  type HypothesisAdvisorProvider,
} from '../backend/src/providers/advisorTypes.ts'

const packet: AdvisorPacket = {
  cycleId: 'connectivity-check',
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

async function check(
  label: string,
  provider: HypothesisAdvisorProvider,
  maxTokens: number,
  timeoutMs: number,
  extra?: string,
) {
  const result = await provider.rankHypotheses(packet, {
    requestId: `${provider.id}-connectivity`,
    deadlineAt: Date.now() + timeoutMs,
    timeoutMs,
    maxTokens,
    contractVersion: ADVISOR_CONTRACT_VERSION,
    requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
  })
  const status = result.ok ? 'WORKING' : `NOT WORKING (${result.category})`
  const extraBit = extra ? ` | ${extra}` : ''
  const failBit = result.ok
    ? ''
    : ` | finish=${result.finishReason ?? 'n/a'} | tokens=${result.usage?.outputTokens ?? 'n/a'} reasonTokens=${result.usage?.reasoningTokens ?? 'n/a'}`
  console.log(
    `${label}: ${status} | model=${result.model} | ${result.latencyMs}ms${extraBit}${failBit}`,
  )
  return result.ok
}

async function main() {
  loadBackendEnvFile()
  const config = loadConfig()
  const health = new ProviderHealthManager()
  let okCount = 0
  let ran = 0

  console.log('Provider connectivity (one request each, no apply)\n')

  if (!config.groqApiKey) {
    console.log('Groq: SKIPPED (GROQ_API_KEY missing)')
  } else {
    ran += 1
    if (await check(
      'Groq',
      new GroqAdvisorProvider(
        { ...config, advisorEnabled: true, groqAdvisorEnabled: true },
        health,
      ),
      config.groqAdvisorMaxTokens,
      8_000,
    )) okCount += 1
  }

  if (!config.geminiApiKey) {
    console.log('Gemini: SKIPPED (GEMINI_API_KEY missing)')
  } else {
    ran += 1
    if (await check(
      'Gemini',
      new GeminiAdvisorProvider(
        { ...config, advisorEnabled: true, geminiAdvisorEnabled: true, advisorFallbackEnabled: false },
        health,
      ),
      config.geminiAdvisorMaxTokens,
      10_000,
    )) okCount += 1
  }

  if (!config.openRouterApiKey) {
    console.log('OpenRouter: SKIPPED (OPENROUTER_API_KEY missing)')
  } else if (!config.openRouterAdvisorModel) {
    console.log('OpenRouter: SKIPPED (OPENROUTER_ADVISOR_MODEL unset)')
  } else {
    ran += 1
    if (await check(
      'OpenRouter',
      new OpenRouterAdvisorProvider(
        { ...config, advisorEnabled: true, openRouterAdvisorEnabled: true },
        health,
      ),
      config.openRouterAdvisorMaxTokens,
      12_000,
    )) okCount += 1
  }

  console.log(`\n${okCount}/${ran} providers returned a valid advisor ranking.`)
  process.exit(okCount === ran && ran > 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'connectivity check failed')
  process.exit(1)
})
