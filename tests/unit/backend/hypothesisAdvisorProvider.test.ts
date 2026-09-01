import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig, type AppConfig } from '../../../backend/src/config/env.ts'
import {
  resetAdvisorProviderRuntimeForTests,
  runHypothesisAdvisorProvider,
} from '../../../backend/src/providers/hypothesisAdvisorProvider.ts'
import { AdvisorProviderFailureError } from '../../../backend/src/providers/advisorTypes.ts'
import { HYPOTHESIS_ADVISOR_MAX_SNIPPET } from '@flowlary/shared'

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig(),
    groqApiKey: 'groq-key',
    groqAdvisorEnabled: true,
    advisorFallbackEnabled: false,
    advisorGlobalRequestsPerMinute: 1_000,
    ...overrides,
  }
}

const input = {
  cycleId: 'cycle',
  snippet: 'x'.repeat(HYPOTHESIS_ADVISOR_MAX_SNIPPET + 50),
  allowedIntents: ['preserve'],
  hypotheses: [{
    id: 'h1',
    intent: 'preserve',
    localScore: 0.5,
    risk: 'low',
    needsLLM: true,
    conflicts: [],
    evidence: [],
  }],
}

describe('hypothesis advisor runtime entry', () => {
  afterEach(() => {
    resetAdvisorProviderRuntimeForTests()
    vi.unstubAllGlobals()
  })

  it('rejects invalid requests before any provider call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(runHypothesisAdvisorProvider(config(), {
      ...input,
      cycleId: '',
    })).rejects.toThrow('invalid_request')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns unavailable when the advisor is disabled', async () => {
    await expect(runHypothesisAdvisorProvider(config({ advisorEnabled: false }), input))
      .rejects.toBeInstanceOf(AdvisorProviderFailureError)
  })

  it('truncates outbound snippets to the shared maximum', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.messages[1].content.length).toBeLessThanOrEqual(HYPOTHESIS_ADVISOR_MAX_SNIPPET + 200)
      expect(JSON.parse(body.messages[1].content).snippet.length).toBe(HYPOTHESIS_ADVISOR_MAX_SNIPPET)
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y"}',
          },
        }],
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    await runHypothesisAdvisorProvider(config(), input)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
