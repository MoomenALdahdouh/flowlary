import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadConfig, type AppConfig } from '../../backend/src/config/env.ts'
import {
  resetAdvisorProviderRuntimeForTests,
  runHypothesisAdvisorProvider,
  type HypothesisAdvisorInput,
} from '../../backend/src/providers/hypothesisAdvisorProvider.ts'
import { AdvisorProviderFailureError } from '../../backend/src/providers/advisorTypes.ts'

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig(),
    groqApiKey: 'groq-key',
    groqAdvisorEnabled: true,
    groqAdvisorModel: 'openai/gpt-oss-20b',
    advisorMaxTokens: 180,
    advisorTimeoutMs: 1_500,
    advisorFallbackEnabled: true,
    advisorGlobalRequestsPerMinute: 1_000,
    geminiApiKey: 'gemini-key',
    geminiAdvisorEnabled: true,
    geminiAdvisorModel: 'gemini-2.5-flash-lite',
    openRouterApiKey: 'openrouter-key',
    openRouterAdvisorEnabled: false,
    openRouterAdvisorModel: 'vendor/configured-model',
    ...overrides,
  }
}

const input: HypothesisAdvisorInput = {
  cycleId: 'cycle',
  snippet: 'ambiguous',
  allowedIntents: ['preserve', 'fix_layout'],
  hypotheses: [
    {
      id: 'h1',
      intent: 'preserve',
      localScore: 0.6,
      risk: 'low',
      needsLLM: true,
      conflicts: ['h2'],
      evidence: [],
    },
    {
      id: 'h2',
      intent: 'fix_layout',
      localScore: 0.5,
      risk: 'high',
      needsLLM: true,
      conflicts: ['h1'],
      evidence: [],
    },
  ],
}

function validGroq(): Response {
  return new Response(JSON.stringify({
    model: 'openai/gpt-oss-20b',
    choices: [{
      finish_reason: 'stop',
      message: {
        content: '{"rankedHypothesisIds":["h1","h2"],"ambiguityClass":"x","reasonCode":"y"}',
      },
    }],
  }), { status: 200 })
}

function validGemini(): Response {
  return new Response(JSON.stringify({
    modelVersion: 'gemini-2.5-flash-lite',
    candidates: [{
      finishReason: 'STOP',
      content: {
        parts: [{
          text: '{"rankedHypothesisIds":["h1","h2"],"ambiguityClass":"x","reasonCode":"y"}',
        }],
      },
    }],
  }), { status: 200 })
}

function validOpenRouter(): Response {
  return new Response(JSON.stringify({
    model: 'vendor/configured-model',
    choices: [{
      finish_reason: 'stop',
      message: {
        content: '{"rankedHypothesisIds":["h1","h2"],"ambiguityClass":"x","reasonCode":"y"}',
      },
    }],
  }), { status: 200 })
}

describe('AI advisor failure-only provider integration', () => {
  beforeEach(() => {
    resetAdvisorProviderRuntimeForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('uses only Groq when primary succeeds', async () => {
    const fetchMock = vi.fn(async () => validGroq())
    vi.stubGlobal('fetch', fetchMock)

    const result = await runHypothesisAdvisorProvider(config(), input, undefined, 'r1')
    expect(result).toMatchObject({
      provider: 'groq',
      fallbackUsed: false,
      rankedHypothesisIds: ['h1', 'h2'],
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each([429, 500])('uses Gemini once after Groq HTTP %s', async (status) => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('groq.com')) {
        return new Response('{}', {
          status,
          headers: status === 429 ? { 'retry-after': '5' } : {},
        })
      }
      return validGemini()
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runHypothesisAdvisorProvider(config(), input, undefined, 'r2')
    expect(result).toMatchObject({
      provider: 'gemini',
      fallbackUsed: true,
      fallbackReason: status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back after an invalid Groq response', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('groq.com')) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: '{' } }],
        }), { status: 200 })
      }
      return validGemini()
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runHypothesisAdvisorProvider(config(), input, undefined, 'r3')
    expect(result).toMatchObject({
      provider: 'gemini',
      fallbackUsed: true,
      fallbackReason: 'CONTRACT_FAILURE',
    })
  })

  it.each([
    ['unknown IDs', '{"rankedHypothesisIds":["unknown"],"ambiguityClass":"x","reasonCode":"y"}', 'CONTRACT_FAILURE'],
    ['duplicate IDs', '{"rankedHypothesisIds":["h1","h1"],"ambiguityClass":"x","reasonCode":"y"}', 'CONTRACT_FAILURE'],
    ['write field', '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y","write":true}', 'CONTRACT_FAILURE'],
  ])('rejects Groq %s and accepts one validated Gemini fallback', async (_name, content, category) => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('groq.com')) {
        return new Response(JSON.stringify({
          choices: [{ message: { content } }],
        }), { status: 200 })
      }
      return validGemini()
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(runHypothesisAdvisorProvider(config(), input, undefined, 'r-schema'))
      .resolves.toMatchObject({
        provider: 'gemini',
        fallbackUsed: true,
        fallbackReason: category,
      })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back once after a normalized GPT-OSS contract error without retrying Groq', async () => {
    let groqCalls = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('groq.com')) {
        groqCalls += 1
        return new Response(JSON.stringify({
          error: { code: 'json_validate_failed' },
        }), { status: 400 })
      }
      return validGemini()
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(runHypothesisAdvisorProvider(config(), input, undefined, 'r-budget'))
      .resolves.toMatchObject({
        provider: 'gemini',
        fallbackReason: 'CONTRACT_FAILURE',
      })
    expect(groqCalls).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses one Gemini fallback after a provider timeout response while time remains', async () => {
    const fetchMock = vi.fn(async (url: string) => (
      url.includes('groq.com')
        ? new Response('{}', { status: 408 })
        : validGemini()
    ))
    vi.stubGlobal('fetch', fetchMock)

    await expect(runHypothesisAdvisorProvider(config(), input, undefined, 'r-timeout'))
      .resolves.toMatchObject({
        provider: 'gemini',
        fallbackReason: 'TIMEOUT',
      })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('respects one absolute deadline and does not start late fallback', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>(
      (_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const started = performance.now()

    await expect(runHypothesisAdvisorProvider(
      config({
        advisorTimeoutMs: 40,
        advisorFallbackMinRemainingMs: 10,
      }),
      input,
      undefined,
      'r-deadline',
    )).rejects.toMatchObject({
      result: {
        category: 'TIMEOUT',
        fallbackReason: 'TIMEOUT',
      },
    })
    expect(performance.now() - started).toBeLessThan(500)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('returns normalized unavailable when both providers fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))

    const expectation = runHypothesisAdvisorProvider(config(), input, undefined, 'r4')
    await expect(expectation).rejects.toBeInstanceOf(AdvisorProviderFailureError)
    await expectation.catch((error: AdvisorProviderFailureError) => {
      expect(error.result).toMatchObject({
        ok: false,
        category: 'PROVIDER_UNAVAILABLE',
        fallbackUsed: true,
      })
      expect(error.result.attempts).toHaveLength(2)
    })
  })

  it('uses OpenRouter only after Groq and Gemini operational failures', async () => {
    const callOrder: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('groq.com')) {
        callOrder.push('groq')
        return new Response('{}', { status: 503 })
      }
      if (url.includes('googleapis.com')) {
        callOrder.push('gemini')
        return new Response('{}', { status: 429 })
      }
      callOrder.push('openrouter')
      return validOpenRouter()
    }))

    await expect(runHypothesisAdvisorProvider(config({
      openRouterAdvisorEnabled: true,
    }), input, undefined, 'r-three')).resolves.toMatchObject({
      provider: 'openrouter',
      fallbackUsed: true,
    })
    expect(callOrder).toEqual(['groq', 'gemini', 'openrouter'])
  })

  it('marks the local decision authoritative after all three providers fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    await expect(runHypothesisAdvisorProvider(config({
      openRouterAdvisorEnabled: true,
    }), input, undefined, 'r-local')).rejects.toMatchObject({
      result: {
        localDecisionAuthoritative: true,
        attempts: [{ provider: 'groq' }, { provider: 'gemini' }, { provider: 'openrouter' }],
      },
    })
  })

  it('skips Groq during cooldown and restores it after cooldown expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-31T16:00:00Z'))
    let groqCalls = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('groq.com')) {
        groqCalls += 1
        if (groqCalls === 1) {
          return new Response('{}', {
            status: 429,
            headers: { 'retry-after': '1' },
          })
        }
        return validGroq()
      }
      return validGemini()
    })
    vi.stubGlobal('fetch', fetchMock)
    const appConfig = config()

    expect(await runHypothesisAdvisorProvider(appConfig, input, undefined, 'r5'))
      .toMatchObject({ provider: 'gemini', fallbackUsed: true })
    expect(await runHypothesisAdvisorProvider(appConfig, input, undefined, 'r6'))
      .toMatchObject({ provider: 'gemini', fallbackUsed: true })
    expect(groqCalls).toBe(1)

    await vi.advanceTimersByTimeAsync(1_001)
    expect(await runHypothesisAdvisorProvider(appConfig, input, undefined, 'r7'))
      .toMatchObject({ provider: 'groq', fallbackUsed: false })
    expect(groqCalls).toBe(2)
  })

  it('does not repeatedly call Groq after an auth failure in the configuration epoch', async () => {
    let groqCalls = 0
    let geminiCalls = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('groq.com')) {
        groqCalls += 1
        return new Response('{}', { status: 401 })
      }
      geminiCalls += 1
      return validGemini()
    })
    vi.stubGlobal('fetch', fetchMock)
    const appConfig = config()

    await expect(runHypothesisAdvisorProvider(appConfig, input, undefined, 'r-auth-1'))
      .resolves.toMatchObject({ provider: 'gemini', fallbackReason: 'AUTH_FAILED' })
    await expect(runHypothesisAdvisorProvider(appConfig, input, undefined, 'r-auth-2'))
      .resolves.toMatchObject({ provider: 'gemini' })
    expect(groqCalls).toBe(1)
    expect(geminiCalls).toBe(2)
  })

  it('does not call Gemini when fallback is disabled', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(runHypothesisAdvisorProvider(
      config({ advisorFallbackEnabled: false }),
      input,
      undefined,
      'r8',
    )).rejects.toBeInstanceOf(AdvisorProviderFailureError)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not call Gemini when its provider flag is disabled', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(runHypothesisAdvisorProvider(
      config({ geminiAdvisorEnabled: false }),
      input,
      undefined,
      'r-disabled',
    )).rejects.toMatchObject({
      result: { category: 'PROVIDER_UNAVAILABLE' },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('supports Gemini as the only configured primary', async () => {
    const fetchMock = vi.fn(async () => validGemini())
    vi.stubGlobal('fetch', fetchMock)

    const result = await runHypothesisAdvisorProvider(config({
      groqAdvisorEnabled: false,
      advisorFallbackEnabled: false,
      advisorProviderOrder: ['gemini', 'groq'],
    }), input, undefined, 'r9')
    expect(result).toMatchObject({
      provider: 'gemini',
      fallbackUsed: false,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('supports no providers without making a network call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(runHypothesisAdvisorProvider(config({
      groqAdvisorEnabled: false,
      geminiAdvisorEnabled: false,
    }), input, undefined, 'r10')).rejects.toMatchObject({
      result: {
        category: 'PROVIDER_UNAVAILABLE',
        attempts: [],
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses configuration order and provider-specific generation budgets', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(url).toContain('generativelanguage.googleapis.com')
      expect(body.generationConfig.maxOutputTokens).toBe(321)
      return validGemini()
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runHypothesisAdvisorProvider(config({
      advisorProviderOrder: ['gemini', 'groq'],
      geminiAdvisorMaxTokens: 321,
    }), input, undefined, 'r11')
    expect(result).toMatchObject({ provider: 'gemini', fallbackUsed: false })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('enforces the process-local advisor event limit independently', async () => {
    const fetchMock = vi.fn(async () => validGroq())
    vi.stubGlobal('fetch', fetchMock)
    const appConfig = config({ advisorGlobalRequestsPerMinute: 1 })

    await expect(runHypothesisAdvisorProvider(appConfig, input, undefined, 'r12'))
      .resolves.toMatchObject({ provider: 'groq' })
    await expect(runHypothesisAdvisorProvider(appConfig, input, undefined, 'r13'))
      .rejects.toMatchObject({
        result: {
          category: 'RATE_LIMITED',
          attempts: [],
        },
      })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
