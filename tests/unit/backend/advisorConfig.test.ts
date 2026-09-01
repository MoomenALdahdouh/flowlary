import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../../../backend/src/config/env.ts'

const ADVISOR_ENV = [
  'ADVISOR_ENABLED',
  'ADVISOR_PROVIDER_ORDER',
  'AI_ADVISOR_PROVIDER_ORDER',
  'GROQ_ADVISOR_ENABLED',
  'GROQ_ADVISOR_MODEL',
  'GROQ_ADVISOR_MAX_TOKENS',
  'GEMINI_ADVISOR_ENABLED',
  'GEMINI_ADVISOR_MODEL',
  'GEMINI_ADVISOR_MAX_TOKENS',
  'OPENROUTER_ADVISOR_ENABLED',
  'OPENROUTER_ADVISOR_MODEL',
  'OPENROUTER_ADVISOR_MAX_TOKENS',
  'ADVISOR_FALLBACK_ENABLED',
  'ADVISOR_TIMEOUT_MS',
  'ADVISOR_TOTAL_DEADLINE_MS',
  'ADVISOR_USER_RPM',
  'ADVISOR_GLOBAL_RPM',
] as const

function clearAdvisorEnv(): void {
  for (const name of ADVISOR_ENV) vi.stubEnv(name, '')
  vi.stubEnv('FLOWLARY_ADVISOR_MAX_TOKENS', '')
  vi.stubEnv('FLOWLARY_ADVISOR_TIMEOUT_MS', '')
  vi.stubEnv('FLOWLARY_ADVISOR_FALLBACK_ENABLED', '')
  vi.stubEnv('FLOWLARY_ADVISOR_GLOBAL_RPM', '')
}

describe('advisor production configuration', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('keeps safe defaults and production Groq budget 512', () => {
    clearAdvisorEnv()
    const config = loadConfig()
    expect(config).toMatchObject({
      advisorEnabled: true,
      advisorProviderOrder: ['groq', 'gemini', 'openrouter'],
      groqAdvisorEnabled: true,
      geminiAdvisorEnabled: false,
      openRouterAdvisorEnabled: false,
      advisorFallbackEnabled: false,
      advisorTimeoutMs: 1_500,
      groqAdvisorMaxTokens: 512,
      writingReviewEnabled: true,
      writingReviewFallbackEnabled: true,
      writingReviewTimeoutMs: 4_500,
    })
  })

  it('reads independent provider flags, models, budgets, order, and deadline', () => {
    clearAdvisorEnv()
    vi.stubEnv('ADVISOR_ENABLED', '0')
    vi.stubEnv('AI_ADVISOR_PROVIDER_ORDER', 'openrouter,gemini,groq')
    vi.stubEnv('GROQ_ADVISOR_ENABLED', '0')
    vi.stubEnv('GROQ_ADVISOR_MODEL', 'groq-model')
    vi.stubEnv('GROQ_ADVISOR_MAX_TOKENS', '181')
    vi.stubEnv('GEMINI_ADVISOR_ENABLED', '1')
    vi.stubEnv('GEMINI_ADVISOR_MODEL', 'gemini-model')
    vi.stubEnv('GEMINI_ADVISOR_MAX_TOKENS', '321')
    vi.stubEnv('OPENROUTER_ADVISOR_ENABLED', '1')
    vi.stubEnv('OPENROUTER_ADVISOR_MODEL', 'router-model')
    vi.stubEnv('OPENROUTER_ADVISOR_MAX_TOKENS', '222')
    vi.stubEnv('ADVISOR_FALLBACK_ENABLED', '1')
    vi.stubEnv('ADVISOR_TOTAL_DEADLINE_MS', '1200')

    expect(loadConfig()).toMatchObject({
      advisorEnabled: false,
      advisorProviderOrder: ['openrouter', 'gemini', 'groq'],
      groqAdvisorEnabled: false,
      groqAdvisorModel: 'groq-model',
      groqAdvisorMaxTokens: 181,
      geminiAdvisorEnabled: true,
      geminiAdvisorModel: 'gemini-model',
      geminiAdvisorMaxTokens: 321,
      openRouterAdvisorEnabled: true,
      openRouterAdvisorModel: 'router-model',
      openRouterAdvisorMaxTokens: 222,
      advisorFallbackEnabled: true,
      advisorTimeoutMs: 1_200,
    })
  })
})
