import { randomUUID } from 'node:crypto'
import type { AppConfig } from '../config/env.ts'
import { GatewayError, mapProviderFailure } from './errors.ts'
import { logError, logInfo } from '../logging/logger.ts'
import { runCorrectionProvider } from '../providers/correctionProvider.ts'
import { runTranslationProvider } from '../providers/translationProvider.ts'
import { runLayoutClassifierProvider } from '../providers/layoutClassifierProvider.ts'
import { recordAiUsage } from '../services/usage.ts'
import type { AuthContext } from '../middleware/auth.ts'
import { checkRateLimit } from '../middleware/rateLimit.ts'

export type GatewayRequestMeta = {
  requestId: string
  auth: AuthContext
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

function assertEntitlement(auth: AuthContext, requestId: string): void {
  if (auth.entitlement === 'anonymous') {
    throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Entitlement required', 403, requestId)
  }
}

function trackUsage(
  meta: GatewayRequestMeta,
  operation: 'correction' | 'translation' | 'layout-classification',
  started: number,
  status: 'success' | 'failure',
  model: string,
  tokens?: { input?: number; output?: number; total?: number },
): void {
  recordAiUsage({
    requestId: meta.requestId,
    userId: meta.auth.userId,
    operation,
    model,
    inputTokens: tokens?.input,
    outputTokens: tokens?.output,
    totalTokens: tokens?.total,
    status,
    latencyMs: Date.now() - started,
    createdAt: Date.now(),
    entitlement: meta.auth.entitlement,
  })
}

export class AiGateway {
  constructor(private readonly config: AppConfig) {}

  async correction(
    meta: GatewayRequestMeta,
    body: { text: string; fieldType?: string; previousText?: string },
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    checkRateLimit(meta.auth.userId, meta.auth.entitlement, 'correction')

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runCorrectionProvider(this.config, body, signal),
      )
      trackUsage(meta, 'correction', started, 'success', result.model, {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      })
      logInfo('ai.correction.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.entitlement,
      })
      return {
        ok: true as const,
        data: result.data,
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'correction', started, 'failure', 'unknown')
      logError('ai.correction.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.entitlement,
      })
      throw mapped
    }
  }

  async translation(
    meta: GatewayRequestMeta,
    body: { text: string; sourceLanguage: string; targetLanguage: string; mode?: string },
  ) {
    const started = Date.now()
    assertEntitlement(meta.auth, meta.requestId)
    checkRateLimit(meta.auth.userId, meta.auth.entitlement, 'translation')

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runTranslationProvider(this.config, body, signal),
      )
      trackUsage(meta, 'translation', started, 'success', result.model, {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      })
      logInfo('ai.translation.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.entitlement,
      })
      return {
        ok: true as const,
        translation: result.translation,
        requestId: meta.requestId,
        model: result.model,
      }
    } catch (err) {
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'translation', started, 'failure', 'unknown')
      logError('ai.translation.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.entitlement,
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
    checkRateLimit(meta.auth.userId, meta.auth.entitlement, 'layout-classification')

    try {
      const result = await withTimeout(this.config, meta.requestId, (signal) =>
        runLayoutClassifierProvider(this.config, body, signal),
      )
      trackUsage(meta, 'layout-classification', started, 'success', result.model, {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      })
      logInfo('ai.layout.success', {
        requestId: meta.requestId,
        model: result.model,
        latencyMs: Date.now() - started,
        entitlement: meta.auth.entitlement,
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
      const mapped = mapProviderFailure(err, meta.requestId)
      trackUsage(meta, 'layout-classification', started, 'failure', 'unknown')
      logError('ai.layout.failure', {
        requestId: meta.requestId,
        code: mapped.code,
        entitlement: meta.auth.entitlement,
      })
      throw mapped
    }
  }
}

export function createRequestMeta(auth: AuthContext): GatewayRequestMeta {
  return { requestId: randomUUID(), auth }
}

export function createGateway(config: AppConfig): AiGateway {
  return new AiGateway(config)
}
