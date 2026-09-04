import type { TranslationProviderId, TranslationRouteStrategy } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import type { AuthContext } from '../middleware/auth.ts'
import {
  GoogleTranslateError,
  isGoogleTranslateConfigured,
  runGoogleTranslate,
} from './googleTranslateProvider.ts'
import {
  liveTranslationPolishEligible,
  needsTranslationPolish,
} from './needsTranslationPolish.ts'
import {
  runTranslationProvider,
  runTranslationRefinement,
  type TranslationProviderInput,
} from './translationProvider.ts'
import {
  buildTranslationCacheKey,
  getTranslationCache,
  setTranslationCache,
} from './translationCache.ts'

export type RoutedTranslationResult = {
  translation: string
  model: string
  provider: TranslationProviderId
  strategy: TranslationRouteStrategy
  cacheHit: boolean
  googleUsed: boolean
  groqUsed: boolean
  refinementAttempted: boolean
  refinementSucceeded: boolean
  refinementSkipped: boolean
  refinementSkipReason?: string
  fallbackUsed: boolean
  /** True when Groq usage should finalize a credit reservation. */
  groqBillable: boolean
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type TranslationRouteHooks = {
  tryReserveGroq: () => boolean
  releaseGroq: () => void
}

export function resolveTranslationStrategy(
  config: AppConfig,
  auth: AuthContext,
  _mode?: string,
): TranslationRouteStrategy {
  if (config.translationForceProvider !== 'auto') {
    return config.translationForceProvider
  }
  if (!isGoogleTranslateConfigured(config)) {
    return 'groq'
  }
  const isPro = auth.rateLimitTier === 'pro' || auth.rateLimitTier === 'trial'
  if (isPro) {
    if (!auth.allowed && auth.denyReason === 'usage_exhausted') return 'google'
    return 'groq'
  }
  return 'google'
}

export function shouldAttemptTranslationRefinement(
  input: TranslationProviderInput,
  googleTranslation: string,
): { attempt: boolean; reason: string } {
  if (input.mode !== 'live') {
    return { attempt: true, reason: 'manual_pro_refine' }
  }

  const polish = needsTranslationPolish({
    sourceText: input.text,
    draftTranslation: googleTranslation,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
  })

  const completionEligible = liveTranslationPolishEligible(input.translationContext)
  if (!completionEligible) {
    if (!polish.needsPolish) {
      return { attempt: false, reason: 'live_incomplete_segment' }
    }
    return { attempt: true, reason: `live_colloquial:${polish.reason}` }
  }

  if (!polish.needsPolish) {
    return { attempt: false, reason: polish.reason }
  }
  return { attempt: true, reason: polish.reason }
}

export function strategyRequiresGroqCredits(strategy: TranslationRouteStrategy): boolean {
  return strategy === 'groq'
}

export function canAccessTranslation(
  auth: AuthContext,
  strategy: TranslationRouteStrategy,
): boolean {
  if (auth.authKind === 'dev') return true
  if (!auth.accountId) return false
  if (auth.denyReason === 'suspended') return false
  if (auth.allowed) return true
  if (auth.denyReason === 'usage_exhausted' && strategy !== 'groq') return true
  return false
}

export async function runRoutedTranslation(
  config: AppConfig,
  auth: AuthContext,
  input: TranslationProviderInput,
  hooks: TranslationRouteHooks,
  signal?: AbortSignal,
): Promise<RoutedTranslationResult> {
  const strategy = resolveTranslationStrategy(config, auth, input.mode)
  const cacheKey = buildTranslationCacheKey({
    accountId: auth.accountId,
    text: input.text,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    strategy,
  })

  const cached = getTranslationCache(cacheKey)
  if (cached) {
    return {
      translation: cached.translation,
      model: cached.model,
      provider: 'cache',
      strategy,
      cacheHit: true,
      googleUsed: false,
      groqUsed: false,
      refinementAttempted: false,
      refinementSucceeded: false,
      refinementSkipped: false,
      fallbackUsed: false,
      groqBillable: false,
    }
  }

  if (strategy === 'google') {
    return runGooglePath(config, auth, input, strategy, cacheKey, hooks, signal)
  }
  if (strategy === 'groq') {
    return runGroqPath(config, auth, input, strategy, cacheKey, hooks, signal, false)
  }
  return runGoogleThenGroqPath(config, auth, input, strategy, cacheKey, hooks, signal)
}

async function runGooglePath(
  config: AppConfig,
  auth: AuthContext,
  input: TranslationProviderInput,
  strategy: TranslationRouteStrategy,
  cacheKey: string,
  hooks: TranslationRouteHooks,
  signal?: AbortSignal,
): Promise<RoutedTranslationResult> {
  try {
    const google = await runGoogleTranslate(
      config,
      {
        text: input.text,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      },
      signal,
    )
    setTranslationCache(cacheKey, {
      translation: google.translation,
      model: google.model,
      strategy,
      provider: 'google',
    })
    return {
      translation: google.translation,
      model: google.model,
      provider: 'google',
      strategy,
      cacheHit: false,
      googleUsed: true,
      groqUsed: false,
      refinementAttempted: false,
      refinementSucceeded: false,
      refinementSkipped: false,
      fallbackUsed: false,
      groqBillable: false,
    }
  } catch (err) {
    if (!(err instanceof GoogleTranslateError)) throw err
    if (!config.translationAllowGroqFallback) throw err
    if (!auth.allowed && auth.authKind !== 'dev') throw err
    return runGroqPath(config, auth, input, strategy, cacheKey, hooks, signal, true)
  }
}

async function runGroqPath(
  config: AppConfig,
  auth: AuthContext,
  input: TranslationProviderInput,
  strategy: TranslationRouteStrategy,
  cacheKey: string,
  hooks: TranslationRouteHooks,
  signal: AbortSignal | undefined,
  fallbackUsed: boolean,
): Promise<RoutedTranslationResult> {
  if (!hooks.tryReserveGroq()) {
    throw new Error('usage_exhausted')
  }
  try {
    const groq = await runTranslationProvider(config, input, signal)
    setTranslationCache(cacheKey, {
      translation: groq.translation,
      model: groq.model,
      strategy,
      provider: 'groq',
    })
    return {
      translation: groq.translation,
      model: groq.model,
      provider: 'groq',
      strategy,
      cacheHit: false,
      googleUsed: false,
      groqUsed: true,
      refinementAttempted: false,
      refinementSucceeded: false,
      refinementSkipped: false,
      fallbackUsed,
      groqBillable: true,
      inputTokens: groq.inputTokens,
      outputTokens: groq.outputTokens,
      totalTokens: groq.totalTokens,
    }
  } catch (err) {
    hooks.releaseGroq()
    throw err
  }
}

function cacheGoogleOnlyResult(
  cacheKey: string,
  googleTranslation: string,
  googleModel: string,
  strategy: TranslationRouteStrategy,
): RoutedTranslationResult {
  setTranslationCache(cacheKey, {
    translation: googleTranslation,
    model: googleModel,
    strategy,
    provider: 'google',
  })
  return {
    translation: googleTranslation,
    model: googleModel,
    provider: 'google',
    strategy,
    cacheHit: false,
    googleUsed: true,
    groqUsed: false,
    refinementAttempted: false,
    refinementSucceeded: false,
    refinementSkipped: true,
    fallbackUsed: false,
    groqBillable: false,
  }
}

async function runGoogleThenGroqPath(
  config: AppConfig,
  auth: AuthContext,
  input: TranslationProviderInput,
  strategy: TranslationRouteStrategy,
  cacheKey: string,
  hooks: TranslationRouteHooks,
  signal?: AbortSignal,
): Promise<RoutedTranslationResult> {
  let googleTranslation: string
  let googleModel: string
  try {
    const google = await runGoogleTranslate(
      config,
      {
        text: input.text,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      },
      signal,
    )
    googleTranslation = google.translation
    googleModel = google.model
  } catch (err) {
    if (!(err instanceof GoogleTranslateError)) throw err
    if (!config.translationAllowGroqFallback) throw err
    if (!auth.allowed && auth.authKind !== 'dev') throw err
    return runGroqPath(config, auth, input, strategy, cacheKey, hooks, signal, true)
  }

  const refineDecision = shouldAttemptTranslationRefinement(input, googleTranslation)
  if (!refineDecision.attempt) {
    const result: RoutedTranslationResult = {
      translation: googleTranslation,
      model: googleModel,
      provider: 'google',
      strategy,
      cacheHit: false,
      googleUsed: true,
      groqUsed: false,
      refinementAttempted: false,
      refinementSucceeded: false,
      refinementSkipped: true,
      refinementSkipReason: refineDecision.reason,
      fallbackUsed: false,
      groqBillable: false,
    }
    if (refineDecision.reason !== 'live_incomplete_segment') {
      setTranslationCache(cacheKey, {
        translation: googleTranslation,
        model: googleModel,
        strategy,
        provider: 'google',
      })
    }
    return result
  }

  const canRefine = auth.allowed || auth.authKind === 'dev'
  if (!canRefine || !hooks.tryReserveGroq()) {
    return cacheGoogleOnlyResult(cacheKey, googleTranslation, googleModel, strategy)
  }

  try {
    const refined = await runTranslationRefinement(
      config,
      {
        text: input.text,
        draftTranslation: googleTranslation,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        mode: input.mode,
        translationContext: input.translationContext,
      },
      signal,
    )
    setTranslationCache(cacheKey, {
      translation: refined.translation,
      model: refined.model,
      strategy,
      provider: 'google_then_groq',
    })
    return {
      translation: refined.translation,
      model: refined.model,
      provider: 'google_then_groq',
      strategy,
      cacheHit: false,
      googleUsed: true,
      groqUsed: true,
      refinementAttempted: true,
      refinementSucceeded: true,
      refinementSkipped: false,
      fallbackUsed: false,
      groqBillable: true,
      inputTokens: refined.inputTokens,
      outputTokens: refined.outputTokens,
      totalTokens: refined.totalTokens,
    }
  } catch {
    hooks.releaseGroq()
    return {
      ...cacheGoogleOnlyResult(cacheKey, googleTranslation, googleModel, strategy),
      refinementAttempted: true,
      refinementSucceeded: false,
      refinementSkipped: false,
      groqUsed: true,
    }
  }
}
