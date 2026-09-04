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
    expect(resolveTranslationStrategy(baseConfig(), auth({ rateLimitTier: 'free' }), 'live')).toBe(
      'google',
    )
  })

  it('routes pro shortcut and live to groq', () => {
    expect(
      resolveTranslationStrategy(baseConfig(), auth({ rateLimitTier: 'pro', clientClaim: 'pro' }), 'shortcut'),
    ).toBe('groq')
    expect(resolveTranslationStrategy(baseConfig(), auth({ rateLimitTier: 'pro' }), 'live')).toBe(
      'groq',
    )
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

  it('Free live path does not call Groq refinement', async () => {
    vi.spyOn(google, 'runGoogleTranslate').mockResolvedValue({
      translation: 'Hello',
      model: 'google-translate',
    })
    const refine = vi.spyOn(groqProvider, 'runTranslationRefinement')

    const result = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'free' }),
      {
        text: 'والله يمكن اجي',
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        mode: 'live',
        translationContext: { segment_complete: true },
      },
      { tryReserveGroq: () => true, releaseGroq: () => undefined },
    )

    expect(result.provider).toBe('google')
    expect(refine).not.toHaveBeenCalled()
  })

  it('Pro live translates with Groq even when the segment is incomplete', async () => {
    vi.spyOn(groqProvider, 'runTranslationProvider').mockResolvedValue({
      translation: "Honestly, maybe I'll come.",
      model: 'openai/gpt-oss-120b',
    })
    const googleSpy = vi.spyOn(google, 'runGoogleTranslate')

    const result = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'pro' }),
      {
        text: 'والله يمكن اجي',
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        mode: 'live',
        translationContext: { segment_complete: false, focus_out_completion: false },
      },
      { tryReserveGroq: () => true, releaseGroq: () => undefined },
    )

    expect(result.provider).toBe('groq')
    expect(result.translation).toBe("Honestly, maybe I'll come.")
    expect(googleSpy).not.toHaveBeenCalled()
  })

  it('Pro live colloquial sentence uses Groq, not Google', async () => {
    vi.spyOn(groqProvider, 'runTranslationProvider').mockResolvedValue({
      translation:
        "Honestly, maybe I'll come, yeah, but I don't know why my stomach hurts.",
      model: 'openai/gpt-oss-120b',
    })

    const result = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'pro' }),
      {
        text: 'والله يمكن اجي اه بس مش عارف ليش بطني بيجعني',
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        mode: 'live',
        translationContext: { segment_complete: true },
      },
      { tryReserveGroq: () => true, releaseGroq: () => undefined },
    )

    expect(result.provider).toBe('groq')
    expect(result.translation).toMatch(/Honestly|maybe/i)
  })

  it('Pro live MSA sentence still uses Groq as the translator', async () => {
    vi.spyOn(groqProvider, 'runTranslationProvider').mockResolvedValue({
      translation: "I'm going to the university now.",
      model: 'openai/gpt-oss-120b',
    })
    const refine = vi.spyOn(groqProvider, 'runTranslationRefinement')

    const result = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'pro' }),
      {
        text: 'أنا ذاهب إلى الجامعة الآن.',
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        mode: 'live',
        translationContext: { segment_complete: true },
      },
      { tryReserveGroq: () => true, releaseGroq: () => undefined },
    )

    expect(result.provider).toBe('groq')
    expect(result.translation).toBe("I'm going to the university now.")
    expect(refine).not.toHaveBeenCalled()
  })

  it('Pro live focus-out uses Groq', async () => {
    vi.spyOn(groqProvider, 'runTranslationProvider').mockResolvedValue({
      translation:
        "Honestly, maybe I'll come, yeah, but I don't know why my stomach hurts.",
      model: 'openai/gpt-oss-120b',
    })

    const result = await runRoutedTranslation(
      baseConfig(),
      auth({ rateLimitTier: 'pro' }),
      {
        text: 'والله يمكن اجي اه بس مش عارف ليش بطني بيجعني',
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        mode: 'live',
        translationContext: { focus_out_completion: true },
      },
      { tryReserveGroq: () => true, releaseGroq: () => undefined },
    )

    expect(result.provider).toBe('groq')
    expect(result.groqBillable).toBe(true)
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

  it('Pro Groq translation is billable', async () => {
    vi.spyOn(groqProvider, 'runTranslationProvider').mockResolvedValue({
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

    expect(result.provider).toBe('groq')
    expect(result.groqBillable).toBe(true)
    expect(result.translation).toBe('¡Hola!')
  })

  it('falls back is not used — Groq failure surfaces', async () => {
    vi.spyOn(groqProvider, 'runTranslationProvider').mockRejectedValue(new Error('rate_limited'))

    await expect(
      runRoutedTranslation(
        baseConfig(),
        auth({ rateLimitTier: 'pro' }),
        { text: 'hello', sourceLanguage: 'en', targetLanguage: 'es', mode: 'shortcut' },
        { tryReserveGroq: () => true, releaseGroq: () => undefined },
      ),
    ).rejects.toThrow('rate_limited')
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

  it('does not leak google cache into groq strategy', async () => {
    vi.spyOn(google, 'runGoogleTranslate').mockResolvedValue({
      translation: 'hola',
      model: 'google-translate',
    })
    vi.spyOn(groqProvider, 'runTranslationProvider').mockResolvedValue({
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
