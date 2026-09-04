import { randomUUID } from 'node:crypto'
import type { TranslationRequestContext } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { GatewayError, mapProviderFailure } from './errors.ts'
import { logError, logInfo } from '../logging/logger.ts'
import { runCorrectionProvider } from '../providers/correctionProvider.ts'
import {
  canAccessTranslation,
  runRoutedTranslation,
  resolveTranslationStrategy,
  strategyRequiresGroqCredits,
} from '../providers/translationRouter.ts'
import { runLayoutClassifierProvider } from '../providers/layoutClassifierProvider.ts'
import { runHypothesisAdvisorProvider } from '../providers/hypothesisAdvisorProvider.ts'
import { runWritingReviewProvider, type WritingReviewInput } from '../providers/writingReviewProvider.ts'
import { AdvisorProviderFailureError } from '../providers/advisorTypes.ts'
import type { AdvisorManagerResult } from '../providers/advisorTypes.ts'
import { runExplanationLocalizeProvider } from '../providers/explanationLocalizeProvider.ts'
import { runLearningReportNarrationProvider } from '../providers/learningReportNarrationProvider.ts'
import { runLearningCoachProvider } from '../providers/learningCoachProvider.ts'
import { recordAiUsage } from '../services/usage.ts'
import type { AuthContext } from '../middleware/auth.ts'
import { checkAdvisorRateLimit, checkRateLimit } from '../middleware/rateLimit.ts'
import {
  finalizeManagedUsageReservation,
  releaseManagedUsageReservation,
  reserveManagedUsage,
} from '../services/accountService.ts'

export type GatewayRequestMeta = {
  requestId: string
  auth: AuthContext
  signal?: AbortSignal
}

async function withTimeout<T>(
  config: AppConfig,
  requestId: string,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

async function withAdvisorTimeout<T>(
  config: AppConfig,
  parentSignal: AbortSignal | undefined,
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs = config.advisorTimeoutMs,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const signal = parentSignal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([parentSignal, controller.signal])
    : controller.signal
  const abortFromParent = () => controller.abort()
  if (parentSignal && typeof AbortSignal.any !== 'function') {
    if (parentSignal.aborted) controller.abort()
    else parentSignal.addEventListener('abort', abortFromParent, { once: true })
  }
  try {
    return await fn(signal)
  } finally {
    clearTimeout(timer)
    parentSignal?.removeEventListener('abort', abortFromParent)
  }
}

function assertEntitlement(auth: AuthContext, requestId: string): void {
  if (!auth.allowed) {
    throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Entitlement required', 403, requestId)
  }
}

function trackUsage(
  meta: GatewayRequestMeta,
  operation: 'correction' | 'translation' | 'layout-classification' | 'hypothesis-advisor' | 'writing-review',
  started: number,
  status: 'success' | 'failure',
  model: string,
  tokens?: { input?: number; output?: number; total?: number },
  mode?: string | null,
  details?: {
    provider?: string
    reasoningTokens?: number
    finishReason?: string
    fallbackUsed?: boolean
    fallbackReason?: string
  },
): void {
  recordAiUsage({
    requestId: meta.requestId,
    userId: meta.auth.userId,
    accountId: meta.auth.accountId,
    operation,
    model,
    provider: details?.provider,
    inputTokens: tokens?.input,
    outputTokens: tokens?.output,
    totalTokens: tokens?.total,
    reasoningTokens: details?.reasoningTokens,
    finishReason: details?.finishReason,
    fallbackUsed: details?.fallbackUsed,
    fallbackReason: details?.fallbackReason,
    status,
    latencyMs: Date.now() - started,
    createdAt: Date.now(),
    plan: meta.auth.rateLimitTier,
    clientClaim: meta.auth.clientClaim,
    mode: mode ?? null,
  })
}

function trackAdvisorAttempts(
  meta: GatewayRequestMeta,
  attempts: AdvisorManagerResult['attempts'],
  createdAt: number,
): void {
  attempts.forEach((attempt, fallbackPosition) => {
    recordAiUsage({
      requestId: meta.requestId,
      userId: meta.auth.userId,
      accountId: meta.auth.accountId,
      operation: 'hypothesis-advisor',
      provider: attempt.provider,
      model: attempt.model,
      inputTokens: attempt.usage?.inputTokens,
      outputTokens: attempt.usage?.outputTokens,
      totalTokens: attempt.usage?.totalTokens,
      reasoningTokens: attempt.usage?.reasoningTokens,
      finishReason: attempt.finishReason,
      fallbackPosition,
      errorClass: attempt.result === 'SUCCESS' ? undefined : attempt.result,
      estimatedCostUsd: attempt.usage?.estimatedCostUsd,
      status: attempt.result === 'SUCCESS' ? 'success' : 'failure',
      latencyMs: attempt.latencyMs,
      createdAt,
      plan: meta.auth.rateLimitTier,
      clientClaim: meta.auth.clientClaim,
      mode: 'hypothesis-advisor-attempt',
      telemetryKind: 'provider-attempt',
      meterManagedUsage: false,
    })
  })
}

export class AiGateway {
  constructor(private readonly config: AppConfig) {}

  async correction(
    meta: GatewayRequestMeta,
    body: { text: string; fieldType?: string; previousText?: string; mode?: string },
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    checkRateLimit(meta.auth.userId, meta.auth.rateLimitTier, 'correction')
    const reservation = reserveManagedUsage({
      accountId: meta.auth.accountId,
      operation: 'correction',
      mode: body.mode === 'practice' ? 'practice' : null,
    })

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runCorrectionProvider(this.config, body, signal),
      )
      finalizeManagedUsageReservation(reservation?.id)
      trackUsage(
        meta,
        'correction',
        started,
        'success',
        result.model,
        {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.totalTokens,
        },
        body.mode === 'practice' ? 'practice' : null,
      )
      logInfo('ai.correction.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.rateLimitTier,
        clientClaim: meta.auth.clientClaim,
        accountId: meta.auth.accountId,
      })
      return {
        ok: true as const,
        data: result.data,
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      releaseManagedUsageReservation(reservation?.id)
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'correction', started, 'failure', 'unknown')
      logError('ai.correction.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.rateLimitTier,
        clientClaim: meta.auth.clientClaim,
        accountId: meta.auth.accountId,
      })
      throw mapped
    }
  }

  async translation(
    meta: GatewayRequestMeta,
    body: {
      text: string
      sourceLanguage: string
      targetLanguage: string
      mode?: string
      translationContext?: TranslationRequestContext
    },
  ) {
    const started = Date.now()
    const strategy = resolveTranslationStrategy(this.config, meta.auth, body.mode)
    if (!canAccessTranslation(meta.auth, strategy)) {
      throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Entitlement required', 403, meta.requestId)
    }
    checkRateLimit(meta.auth.userId, meta.auth.rateLimitTier, 'translation')

    let reservationId: string | null = null
    const hooks = {
      tryReserveGroq: () => {
        if (reservationId) return true
        if (!meta.auth.allowed && meta.auth.authKind !== 'dev') return false
        try {
          const reservation = reserveManagedUsage({
            accountId: meta.auth.accountId,
            operation: 'translation',
            mode: body.mode ?? null,
          })
          reservationId = reservation?.id ?? null
          return reservationId != null || meta.auth.authKind === 'dev' || !meta.auth.accountId
        } catch {
          return false
        }
      },
      releaseGroq: () => {
        releaseManagedUsageReservation(reservationId)
        reservationId = null
      },
    }

    // Pure Groq path still requires full entitlement + reservation up front.
    if (strategyRequiresGroqCredits(strategy)) {
      assertEntitlement(meta.auth, meta.requestId)
      if (!hooks.tryReserveGroq()) {
        throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Entitlement required', 403, meta.requestId)
      }
    }

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runRoutedTranslation(
          this.config,
          meta.auth,
          {
            text: body.text,
            sourceLanguage: body.sourceLanguage,
            targetLanguage: body.targetLanguage,
            mode: body.mode,
            translationContext: body.translationContext,
          },
          hooks,
          signal,
        ),
      )

      if (result.groqBillable) {
        finalizeManagedUsageReservation(reservationId)
      } else if (reservationId) {
        releaseManagedUsageReservation(reservationId)
      }

      trackUsage(
        meta,
        'translation',
        started,
        'success',
        result.model,
        {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.totalTokens,
        },
        body.mode ?? null,
      )
      logInfo('ai.translation.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.rateLimitTier,
        clientClaim: meta.auth.clientClaim,
        accountId: meta.auth.accountId,
        provider: result.provider,
        strategy: result.strategy,
        cacheHit: result.cacheHit,
        googleUsed: result.googleUsed,
        groqUsed: result.groqUsed,
        refinementAttempted: result.refinementAttempted,
        refinementSucceeded: result.refinementSucceeded,
        refinementSkipped: result.refinementSkipped,
        refinementSkipReason: result.refinementSkipReason,
        fallbackUsed: result.fallbackUsed,
      })
      return {
        ok: true as const,
        translation: result.translation,
        requestId: meta.requestId,
        model: result.model,
        provider: result.provider,
        strategy: result.strategy,
      }
    } catch (err) {
      releaseManagedUsageReservation(reservationId)
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'translation', started, 'failure', 'unknown', undefined, body.mode ?? null)
      logError('ai.translation.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.rateLimitTier,
        clientClaim: meta.auth.clientClaim,
        accountId: meta.auth.accountId,
        strategy,
      })
      throw mapped
    }
  }

  async layoutClassification(
    meta: GatewayRequestMeta,
    body: { word: string; context?: string; sourceLayout: string; candidateLayouts: string[] },
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    checkRateLimit(meta.auth.userId, meta.auth.rateLimitTier, 'layout-classification')
    const reservation = reserveManagedUsage({
      accountId: meta.auth.accountId,
      operation: 'layout-classification',
    })

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runLayoutClassifierProvider(this.config, body, signal),
      )
      finalizeManagedUsageReservation(reservation?.id)
      trackUsage(meta, 'layout-classification', started, 'success', result.model, {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      })
      logInfo('ai.layout.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.rateLimitTier,
        clientClaim: meta.auth.clientClaim,
        accountId: meta.auth.accountId,
      })
      return {
        ok: true as const,
        result: {
          kind: result.kind,
          target_layout: result.targetLayout ?? null,
        },
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      releaseManagedUsageReservation(reservation?.id)
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'layout-classification', started, 'failure', 'unknown')
      logError('ai.layout.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.rateLimitTier,
        clientClaim: meta.auth.clientClaim,
        accountId: meta.auth.accountId,
      })
      throw mapped
    }
  }

  async hypothesisAdvisor(
    meta: GatewayRequestMeta,
    body: {
      cycleId: string
      snippet: string
      allowedIntents: string[]
      hypotheses: Array<{
        id: string
        intent: string
        localScore: number
        risk: string
        needsLLM: boolean
        conflicts: string[]
        evidence: string[]
      }>
    },
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    checkAdvisorRateLimit(meta.auth.userId, this.config.advisorUserRequestsPerMinute)
    const reservation = reserveManagedUsage({
      accountId: meta.auth.accountId,
      operation: 'hypothesis-advisor',
    })

    try {
      const result = await withAdvisorTimeout(this.config, meta.signal, (signal) =>
        runHypothesisAdvisorProvider(this.config, body, signal, meta.requestId),
      )
      trackAdvisorAttempts(meta, result.attempts, started)
      finalizeManagedUsageReservation(reservation?.id)
      trackUsage(
        meta,
        'hypothesis-advisor',
        started,
        'success',
        result.model,
        {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.totalTokens,
        },
        'hypothesis-advisor',
        {
          provider: result.provider,
          reasoningTokens: result.reasoningTokens,
          finishReason: result.finishReason,
          fallbackUsed: result.fallbackUsed,
          fallbackReason: result.fallbackReason,
        },
      )
      logInfo('ai.hypothesis_advisor.success', {
        requestId: meta.requestId,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        fallbackUsed: result.fallbackUsed,
        fallbackReason: result.fallbackReason,
        primaryProvider: result.attempts[0]?.provider,
        primaryResult: result.attempts[0]?.result,
        primaryCooldownMs: result.attempts[0]?.cooldownMs,
        fallbackProvider: result.attempts[1]?.provider,
        fallbackResult: result.attempts[1]?.result,
        providerRequestId: result.providerRequestId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        reasoningTokens: result.reasoningTokens,
        finishReason: result.finishReason,
        entitlement: meta.auth.rateLimitTier,
        accountId: meta.auth.accountId,
      })
      return {
        ok: true as const,
        rankedHypothesisIds: result.rankedHypothesisIds,
        ambiguityClass: result.ambiguityClass,
        reasonCode: result.reasonCode,
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      releaseManagedUsageReservation(reservation?.id)
      const mapped = mapProviderFailure(err, meta.requestId)
      const providerFailure = err instanceof AdvisorProviderFailureError ? err.result : null
      if (providerFailure) trackAdvisorAttempts(meta, providerFailure.attempts, started)
      trackUsage(
        meta,
        'hypothesis-advisor',
        started,
        'failure',
        providerFailure?.model ?? 'unknown',
        undefined,
        'hypothesis-advisor',
        {
          provider: providerFailure?.provider,
          fallbackUsed: providerFailure?.fallbackUsed,
          fallbackReason: providerFailure?.fallbackReason,
          finishReason: providerFailure?.finishReason,
          reasoningTokens: providerFailure?.usage?.reasoningTokens,
        },
      )
      logError('ai.hypothesis_advisor.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        provider: providerFailure?.provider,
        model: providerFailure?.model,
        result: providerFailure?.category,
        latencyMs: providerFailure?.latencyMs,
        fallbackUsed: providerFailure?.fallbackUsed,
        fallbackReason: providerFailure?.fallbackReason,
        attemptCount: providerFailure?.attempts.length,
        primaryProvider: providerFailure?.attempts[0]?.provider,
        primaryResult: providerFailure?.attempts[0]?.result,
        fallbackProvider: providerFailure?.attempts[1]?.provider,
        fallbackResult: providerFailure?.attempts[1]?.result,
        cooldownMs: providerFailure?.cooldownMs,
        providerRequestId: providerFailure?.providerRequestId,
        inputTokens: providerFailure?.usage?.inputTokens,
        outputTokens: providerFailure?.usage?.outputTokens,
        totalTokens: providerFailure?.usage?.totalTokens,
        reasoningTokens: providerFailure?.usage?.reasoningTokens,
        finishReason: providerFailure?.finishReason,
        accountId: meta.auth.accountId,
      })
      throw mapped
    }
  }

  async writingReview(
    meta: GatewayRequestMeta,
    body: {
      cycleId: string
      snippet: string
      contextBefore?: string
      contextAfter?: string
      allowedKinds?: string[]
    },
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    checkAdvisorRateLimit(meta.auth.userId, this.config.advisorUserRequestsPerMinute)
    const reservation = reserveManagedUsage({
      accountId: meta.auth.accountId,
      operation: 'writing-review',
    })

    try {
      const result = await withAdvisorTimeout(this.config, meta.signal, (signal) =>
        runWritingReviewProvider(this.config, {
          cycleId: body.cycleId,
          snippet: body.snippet,
          contextBefore: body.contextBefore,
          contextAfter: body.contextAfter,
          allowedKinds: body.allowedKinds as WritingReviewInput['allowedKinds'],
        }, signal, meta.requestId),
      this.config.writingReviewTimeoutMs)
      trackAdvisorAttempts(meta, result.attempts, started)
      finalizeManagedUsageReservation(reservation?.id)
      trackUsage(
        meta,
        'writing-review',
        started,
        'success',
        result.model,
        {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.totalTokens,
        },
        'writing-review',
        {
          provider: result.provider,
          reasoningTokens: result.reasoningTokens,
          finishReason: result.finishReason,
          fallbackUsed: result.fallbackUsed,
          fallbackReason: result.fallbackReason,
        },
      )
      logInfo('ai.writing_review.success', {
        requestId: meta.requestId,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        fallbackUsed: result.fallbackUsed,
        verdict: result.verdict,
        editCount: result.edits.length,
        entitlement: meta.auth.rateLimitTier,
        accountId: meta.auth.accountId,
      })
      return {
        ok: true as const,
        verdict: result.verdict,
        ambiguityClass: result.ambiguityClass,
        reasonCode: result.reasonCode,
        edits: result.edits,
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      releaseManagedUsageReservation(reservation?.id)
      const mapped = mapProviderFailure(err, meta.requestId)
      const providerFailure = err instanceof AdvisorProviderFailureError ? err.result : null
      if (providerFailure) trackAdvisorAttempts(meta, providerFailure.attempts, started)
      trackUsage(
        meta,
        'writing-review',
        started,
        'failure',
        providerFailure?.model ?? 'unknown',
        undefined,
        'writing-review',
        {
          provider: providerFailure?.provider,
          fallbackUsed: providerFailure?.fallbackUsed,
          fallbackReason: providerFailure?.fallbackReason,
          finishReason: providerFailure?.finishReason,
          reasoningTokens: providerFailure?.usage?.reasoningTokens,
        },
      )
      logError('ai.writing_review.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        provider: providerFailure?.provider,
        model: providerFailure?.model,
        result: providerFailure?.category,
        latencyMs: providerFailure?.latencyMs,
        accountId: meta.auth.accountId,
      })
      throw mapped
    }
  }

  async explanationLocalize(
    meta: GatewayRequestMeta,
    body: import('@flowlary/shared').ExplanationLocalizeRequest,
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    if (meta.auth.rateLimitTier === 'free') {
      throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Entitlement required', 403, meta.requestId)
    }
    checkRateLimit(meta.auth.userId, meta.auth.rateLimitTier, 'translation')
    const reservation = reserveManagedUsage({
      accountId: meta.auth.accountId,
      operation: 'translation',
      mode: 'explanation-localize',
    })

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runExplanationLocalizeProvider(this.config, body, signal),
      )
      finalizeManagedUsageReservation(reservation?.id)
      trackUsage(
        meta,
        'translation',
        started,
        'success',
        result.model,
        {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.totalTokens,
        },
        'explanation-localize',
      )
      logInfo('ai.explanation_localize.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.rateLimitTier,
        clientClaim: meta.auth.clientClaim,
        accountId: meta.auth.accountId,
        locale: body.locale,
        ruleId: body.ruleId,
      })
      return {
        ok: true as const,
        data: result.data,
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      releaseManagedUsageReservation(reservation?.id)
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'translation', started, 'failure', 'unknown', undefined, 'explanation-localize')
      logError('ai.explanation_localize.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.rateLimitTier,
        clientClaim: meta.auth.clientClaim,
        accountId: meta.auth.accountId,
      })
      throw mapped
    }
  }

  /** Pro/Trial learning report narration — separate from correction credits (client enforces 1/day). */
  async learningReportNarrate(
    meta: GatewayRequestMeta,
    body: import('../providers/learningReportNarrationProvider.ts').LearningReportNarrationInput,
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    if (meta.auth.rateLimitTier === 'free') {
      throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Entitlement required', 403, meta.requestId)
    }
    checkRateLimit(meta.auth.userId, meta.auth.rateLimitTier, 'translation')

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runLearningReportNarrationProvider(this.config, body, signal),
      )
      trackUsage(
        meta,
        'translation',
        started,
        'success',
        result.model,
        {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.totalTokens,
        },
        'learning-report-narrate',
      )
      logInfo('ai.learning_report_narrate.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.rateLimitTier,
        accountId: meta.auth.accountId,
        locale: body.locale,
      })
      return {
        ok: true as const,
        data: result.data,
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'translation', started, 'failure', 'unknown', undefined, 'learning-report-narrate')
      logError('ai.learning_report_narrate.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.rateLimitTier,
        accountId: meta.auth.accountId,
      })
      throw mapped
    }
  }

  /** Pro/Trial learning coach — separate from correction credits (client enforces daily quota). */
  async learningCoach(
    meta: GatewayRequestMeta,
    body: import('../providers/learningCoachProvider.ts').LearningCoachInput,
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    if (meta.auth.rateLimitTier === 'free') {
      throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Entitlement required', 403, meta.requestId)
    }
    checkRateLimit(meta.auth.userId, meta.auth.rateLimitTier, 'translation')

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runLearningCoachProvider(this.config, body, signal),
      )
      trackUsage(
        meta,
        'translation',
        started,
        'success',
        result.model,
        {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.totalTokens,
        },
        'learning-coach',
      )
      logInfo('ai.learning_coach.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.rateLimitTier,
        accountId: meta.auth.accountId,
        locale: body.locale,
        mode: body.context.mode,
      })
      return {
        ok: true as const,
        data: result.data,
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'translation', started, 'failure', 'unknown', undefined, 'learning-coach')
      logError('ai.learning_coach.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.rateLimitTier,
        accountId: meta.auth.accountId,
      })
      throw mapped
    }
  }
}

export function createRequestMeta(auth: AuthContext, signal?: AbortSignal): GatewayRequestMeta {
  return { requestId: randomUUID(), auth, signal }
}

export function createGateway(config: AppConfig): AiGateway {
  return new AiGateway(config)
}
