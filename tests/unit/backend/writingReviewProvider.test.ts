import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig, type AppConfig } from '../../../backend/src/config/env.ts'
import {
  resetWritingReviewProviderRuntimeForTests,
  runWritingReviewProvider,
} from '../../../backend/src/providers/writingReviewProvider.ts'

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig(),
    groqApiKey: 'groq-key',
    geminiApiKey: 'gemini-key',
    openRouterApiKey: 'or-key',
    openRouterAdvisorModel: 'openai/gpt-4o-mini',
    groqAdvisorEnabled: true,
    geminiAdvisorEnabled: true,
    openRouterAdvisorEnabled: true,
    writingReviewEnabled: true,
    writingReviewFallbackEnabled: true,
    writingReviewTimeoutMs: 4_500,
    advisorGlobalRequestsPerMinute: 1_000,
    ...overrides,
  }
}

const noChange = JSON.stringify({
  verdict: 'no_change',
  ambiguityClass: 'ok',
  reasonCode: 'no_change',
  edits: [],
})

describe('writing review runtime fallback chain', () => {
  afterEach(() => {
    resetWritingReviewProviderRuntimeForTests()
    vi.unstubAllGlobals()
  })

  it('uses Gemini after Groq 429 when writing-review fallback is on', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('groq')) {
        return new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: '429' } }), { status: 429 })
      }
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: noChange }] } }],
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await runWritingReviewProvider(config(), {
      cycleId: 'cycle',
      snippet: 'hello comming tomorrow',
    })
    expect(result.provider).toBe('gemini')
    expect(result.fallbackUsed).toBe(true)
    expect(result.verdict).toBe('no_change')
  })

  it('uses Gemini after Groq 429 even when Gemini ranking is disabled', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('groq')) {
        return new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: '429' } }), { status: 429 })
      }
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: noChange }] } }],
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await runWritingReviewProvider(config({
      geminiAdvisorEnabled: false,
      advisorFallbackEnabled: false,
    }), {
      cycleId: 'cycle',
      snippet: 'hello comming tomorrow',
    })
    expect(result.provider).toBe('gemini')
    expect(result.fallbackUsed).toBe(true)
  })

  it('does not call Gemini when writing-review fallback is disabled', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      error: { code: 'rate_limit_exceeded', message: '429' },
    }), { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(runWritingReviewProvider(config({ writingReviewFallbackEnabled: false }), {
      cycleId: 'cycle',
      snippet: 'hello comming tomorrow',
    })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
