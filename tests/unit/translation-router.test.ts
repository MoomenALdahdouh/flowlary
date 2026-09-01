import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../../backend/src/config/env.ts'
import { loadConfig } from '../../backend/src/config/env.ts'
import type { AuthContext } from '../../backend/src/middleware/auth.ts'
import {
  canAccessTranslation,
  resolveTranslationStrategy,
  runRoutedTranslation,
} from '../../backend/src/providers/translationRouter.ts'
import { clearTranslationCacheForTests } from '../../backend/src/providers/translationCache.ts'
import * as google from '../../backend/src/providers/googleTranslateProvider.ts'
import * as groqProvider from '../../backend/src/providers/translationProvider.ts'

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig(),
    groqApiKey: 'test-groq',
    googleTranslateEnabled: true,
    googleTranslateApiKey: 'test-google-key',
    googleProjectId: 'test-project',
    googleLocation: 'global',
    googleApplicationCredentials: '',
    translationForceProvider: 'auto',
    translationAllowGroqFallback: false,
    ...overrides,
  }
}

function auth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'user-1',
    accountId: 'acct-1',
    sessionId: 'sess-1',
    installId: 'install-1',
    rateLimitTier: 'free',
    allowed: true,
    clientClaim: 'free',
    authKind: 'account',
    ...overrides,
  }
}

describe('translation provider router', () => {
  beforeEach(() => {
    clearTranslationCacheForTests()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes free users to Google when configured', () => {
    expect(resolveTranslationStrategy(baseConfig(), auth({ rateLimitTier: 'free' }), 'shortcut')).toBe(
      'google',
    )
  })

  it('routes pro shortcut to google_then_groq', () => {
    expect(
      resolveTranslationStrategy(baseConfig(), auth({ rateLimitTier: 'pro', clientClaim: 'pro' }), 'shortcut'),
    ).toBe('google_then_groq')
  })

  it('routes pro live to google only', () => {
    expect(resolveTranslationStrategy(baseConfig(), auth({ rateLimitTier: 'pro' }), 'live')).toBe('google')
  })

  it('uses groq strategy when Google is not configured', () => {
    expect(
      resolveTranslationStrategy(
        baseConfig({ googleTranslateEnabled: false, googleTranslateApiKey: '' }),
        auth({ rateLimitTier: 'free' }),
        'shortcut',
      ),
    ).toBe('groq')
  })

  it('allows Google when usage is exhausted but denies pure Groq', () => {
    const exhausted = auth({ allowed: false, denyReason: 'usage_exhausted', rateLimitTier: 'free' })
    expect(canAccessTranslation(exhausted, 'google')).toBe(true)
    expect(canAccessTranslation(exhausted, 'groq')).toBe(false)
  })

  it('Free Google path does not call Groq or reserve credits', async () => {
    vi.spyOn(google, 'runGoogleTranslate').mockResolvedValue({
      translation: 'hola',
      model: 'google-translate',
    })
    const groq = vi.spyOn(groqProvider, 'runTranslationProvider')
    const refine = vi.spyOn(groqProvider, 'runTranslationRefinement')
    let reserved = false

    const result = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'free' }),
      { text: 'hello', sourceLanguage: 'en', targetLanguage: 'es', mode: 'shortcut' },
      {
        tryReserveGroq: () => {
          reserved = true
          return true
        },
        releaseGroq: () => {
          reserved = false
        },
      },
    )

    expect(result.provider).toBe('google')
    expect(result.googleUsed).toBe(true)
    expect(result.groqUsed).toBe(false)
    expect(result.groqBillable).toBe(false)
    expect(reserved).toBe(false)
    expect(groq).not.toHaveBeenCalled()
    expect(refine).not.toHaveBeenCalled()
  })

  it('Pro refinement is billable and returns refined text', async () => {
    vi.spyOn(google, 'runGoogleTranslate').mockResolvedValue({
      translation: 'hola',
      model: 'google-translate',
    })
    vi.spyOn(groqProvider, 'runTranslationRefinement').mockResolvedValue({
      translation: '¡Hola!',
      model: 'openai/gpt-oss-120b',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    })

    const result = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'pro', clientClaim: 'pro' }),
      { text: 'hello', sourceLanguage: 'en', targetLanguage: 'es', mode: 'shortcut' },
      { tryReserveGroq: () => true, releaseGroq: () => undefined },
    )

    expect(result.provider).toBe('google_then_groq')
    expect(result.refinementSucceeded).toBe(true)
    expect(result.groqBillable).toBe(true)
    expect(result.translation).toBe('¡Hola!')
  })

  it('keeps Google translation when refinement fails', async () => {
    vi.spyOn(google, 'runGoogleTranslate').mockResolvedValue({
      translation: 'hola',
      model: 'google-translate',
    })
    vi.spyOn(groqProvider, 'runTranslationRefinement').mockRejectedValue(new Error('rate_limited'))

    const result = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'pro' }),
      { text: 'hello', sourceLanguage: 'en', targetLanguage: 'es', mode: 'shortcut' },
      { tryReserveGroq: () => true, releaseGroq: () => undefined },
    )

    expect(result.translation).toBe('hola')
    expect(result.provider).toBe('google')
    expect(result.refinementAttempted).toBe(true)
    expect(result.refinementSucceeded).toBe(false)
    expect(result.groqBillable).toBe(false)
  })

  it('serves cache hits without provider calls', async () => {
    vi.spyOn(google, 'runGoogleTranslate').mockResolvedValue({
      translation: 'hola',
      model: 'google-translate',
    })
    const input = {
      text: 'hello',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      mode: 'shortcut' as const,
    }
    const hooks = { tryReserveGroq: () => false, releaseGroq: () => undefined }
    const first = await runRoutedTranslation(baseConfig(), auth(), input, hooks)
    const spy = vi.spyOn(google, 'runGoogleTranslate')
    spy.mockClear()
    const second = await runRoutedTranslation(baseConfig(), auth(), input, hooks)
    expect(second.cacheHit).toBe(true)
    expect(second.translation).toBe(first.translation)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not leak google cache into google_then_groq strategy', async () => {
    vi.spyOn(google, 'runGoogleTranslate').mockResolvedValue({
      translation: 'hola',
      model: 'google-translate',
    })
    vi.spyOn(groqProvider, 'runTranslationRefinement').mockResolvedValue({
      translation: '¡Hola!',
      model: 'openai/gpt-oss-120b',
    })

    await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'free' }),
      { text: 'hello', sourceLanguage: 'en', targetLanguage: 'es', mode: 'shortcut' },
      { tryReserveGroq: () => false, releaseGroq: () => undefined },
    )

    const refined = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'pro' }),
      { text: 'hello', sourceLanguage: 'en', targetLanguage: 'es', mode: 'shortcut' },
      { tryReserveGroq: () => true, releaseGroq: () => undefined },
    )
    expect(refined.cacheHit).toBe(false)
    expect(refined.translation).toBe('¡Hola!')
  })
})
