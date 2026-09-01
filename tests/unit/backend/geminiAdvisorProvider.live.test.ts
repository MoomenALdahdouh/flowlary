import { describe, expect, it } from 'vitest'
import { loadBackendEnvFile, loadConfig } from '../../../backend/src/config/env.ts'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import { GeminiAdvisorProvider } from '../../../backend/src/providers/geminiAdvisorProvider.ts'
import {
  ADVISOR_CONTRACT_VERSION,
  type AdvisorPacket,
} from '../../../backend/src/providers/advisorTypes.ts'

const LIVE_ENABLED = process.env.FLOWLARY_GEMINI_LIVE === 'true'
const REQUEST_COUNT = 5

describe.skipIf(!LIVE_ENABLED)('Gemini advisor live contract probe', () => {
  it('returns provider-neutral validated ranks in a small sequential probe', {
    timeout: 60_000,
  }, async () => {
    loadBackendEnvFile()
    const config = {
      ...loadConfig(),
      advisorEnabled: true,
      advisorFallbackEnabled: false,
      geminiAdvisorEnabled: true,
    }
    expect(config.geminiApiKey, 'GEMINI_API_KEY is required for the live probe').not.toBe('')

    const health = new ProviderHealthManager()
    const provider = new GeminiAdvisorProvider(config, health)
    const liveFetch = globalThis.fetch
    const httpStatuses: Record<string, number> = {}
    globalThis.fetch = async (...args) => {
      const response = await liveFetch(...args)
      const status = String(response.status)
      httpStatuses[status] = (httpStatuses[status] ?? 0) + 1
      return response
    }
    const latencies: number[] = []
    const models = new Set<string>()
    const outcomes: Record<string, number> = {}
    let valid = 0

    for (let index = 0; index < REQUEST_COUNT; index += 1) {
      const packet: AdvisorPacket = {
        cycleId: `gemini-contract-${index}`,
        snippet: index % 2 === 0 ? 'review this API response' : 'راجع هذا API response',
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
      const timeoutMs = config.advisorTimeoutMs
      const result = await provider.rankHypotheses(packet, {
        requestId: packet.cycleId,
        deadlineAt: Date.now() + timeoutMs,
        timeoutMs,
        maxTokens: config.geminiAdvisorMaxTokens,
        contractVersion: ADVISOR_CONTRACT_VERSION,
        requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
      })
      latencies.push(result.latencyMs)
      models.add(result.model)
      const outcome = result.ok ? 'SUCCESS' : result.category
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1
      if (result.ok) {
        valid += 1
        expect(result.rankedHypothesisIds.every((id) => ['h1', 'h2'].includes(id))).toBe(true)
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    const sorted = [...latencies].sort((a, b) => a - b)
    console.log('GEMINI_CONTRACT_METRICS', JSON.stringify({
      requests: REQUEST_COUNT,
      valid,
      invalid: REQUEST_COUNT - valid,
      minLatencyMs: sorted[0],
      maxLatencyMs: sorted.at(-1),
      models: [...models],
      outcomes,
      httpStatuses,
    }))
    globalThis.fetch = liveFetch
    expect(valid).toBe(REQUEST_COUNT)
  })
})
