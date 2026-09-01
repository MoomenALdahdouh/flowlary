import { describe, expect, it } from 'vitest'
import { loadBackendEnvFile, loadConfig } from '../../../backend/src/config/env.ts'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import { GroqAdvisorProvider } from '../../../backend/src/providers/groqAdvisorProvider.ts'
import { OpenRouterAdvisorProvider } from '../../../backend/src/providers/openRouterAdvisorProvider.ts'
import {
  ADVISOR_CONTRACT_VERSION,
  type AdvisorPacket,
  type HypothesisAdvisorProvider,
} from '../../../backend/src/providers/advisorTypes.ts'

const packet: AdvisorPacket = {
  cycleId: 'live-connectivity',
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

async function probe(provider: HypothesisAdvisorProvider, maxTokens: number) {
  const outcomes: Array<Record<string, unknown>> = []
  let consecutiveRateLimits = 0
  for (let index = 0; index < 3 && consecutiveRateLimits < 2; index += 1) {
    const timeoutMs = 5_000
    const result = await provider.rankHypotheses(
      { ...packet, cycleId: `${packet.cycleId}-${index}` },
      {
        requestId: `live-${provider.id}-${index}`,
        deadlineAt: Date.now() + timeoutMs,
        timeoutMs,
        maxTokens,
        contractVersion: ADVISOR_CONTRACT_VERSION,
        requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
      },
    )
    consecutiveRateLimits = !result.ok && result.category === 'RATE_LIMITED'
      ? consecutiveRateLimits + 1
      : 0
    outcomes.push({
      provider: provider.id,
      model: result.model,
      status: result.ok ? 'SUCCESS' : result.category,
      latencyMs: result.latencyMs,
      schemaValid: result.ok,
    })
    if (index < 2) await new Promise((resolve) => setTimeout(resolve, 500))
  }
  console.log('ADVISOR_CONNECTIVITY_PROBE', JSON.stringify(outcomes))
  expect(outcomes.length).toBeGreaterThan(0)
}

describe.skipIf(process.env.FLOWLARY_GROQ_LIVE !== 'true')('Groq advisor connectivity probe', () => {
  it('runs a small paced, non-apply probe', { timeout: 30_000 }, async () => {
    loadBackendEnvFile()
    const config = { ...loadConfig(), advisorEnabled: true, groqAdvisorEnabled: true }
    expect(config.groqApiKey, 'GROQ_API_KEY is required').not.toBe('')
    await probe(
      new GroqAdvisorProvider(config, new ProviderHealthManager()),
      config.groqAdvisorMaxTokens,
    )
  })
})

describe.skipIf(process.env.FLOWLARY_OPENROUTER_LIVE !== 'true')('OpenRouter advisor connectivity probe', () => {
  it('runs a small paced, non-apply probe', { timeout: 30_000 }, async () => {
    loadBackendEnvFile()
    const config = { ...loadConfig(), advisorEnabled: true, openRouterAdvisorEnabled: true }
    expect(config.openRouterApiKey, 'OPENROUTER_API_KEY is required').not.toBe('')
    expect(config.openRouterAdvisorModel, 'OPENROUTER_ADVISOR_MODEL is required').not.toBe('')
    await probe(
      new OpenRouterAdvisorProvider(config, new ProviderHealthManager()),
      config.openRouterAdvisorMaxTokens,
    )
  })
})
