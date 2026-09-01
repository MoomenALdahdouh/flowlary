import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AppConfig } from '../config/env.ts'
import {
  authenticateRequest,
  createInstallToken,
  getEntitlementForAuth,
  parseBearerToken,
} from '../middleware/auth.ts'
import { applyCors } from '../middleware/cors.ts'
import { GatewayError } from '../gateway/errors.ts'
import { createGateway, createRequestMeta } from '../gateway/index.ts'
import { checkRateLimit, resetRateLimitsForTests } from '../middleware/rateLimit.ts'
import { findAccountById, upsertInstall } from '../db/store.ts'
import {
  getAccountEntitlement,
  getAccountUsageSummary,
  issueAdditionalSession,
  loginAccount,
  logoutSession,
  refreshAccountSession,
  registerAccount,
  resetAccountServicesForTests,
  toAccountPublicView,
} from '../services/accountService.ts'
import {
  issueVerificationToken,
  verifyEmailWithToken,
} from '../services/emailVerificationService.ts'
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '../services/passwordResetService.ts'
import {
  confirmStudentVerification,
  getStudentStatusView,
  requestStudentVerification,
  submitEnrollmentReview,
} from '../services/studentVerificationService.ts'
import { verifyAccessToken } from '../services/crypto.ts'
import { resetStoreForTests } from '../db/store.ts'
import {
  getAccountBillingStatus,
  getBillingStatus,
  getPublicBillingConfig,
  processVerifiedPaddleEvent,
  startCheckout,
  startCustomerPortal,
  verifyPaddleSignature,
} from '../billing/index.ts'
import {
  clearAccountLearningData,
  getAccountLearningProfile,
  getAccountPracticeSessions,
  mergeAccountPracticeSessions,
  normalizeServerLearningProfile,
  normalizeServerPracticeStore,
  putAccountLearningProfile,
  resetAccountLearningSyncForTests,
} from '../services/learningSyncService.ts'
import {
  ingestAccountLearningEvents,
  listAccountLearningEvents,
  resetAccountLearningEventsForTests,
} from '../services/learningEventsService.ts'
import {
  MAX_LEARNING_EVENT_INGEST_BATCH,
  validateLearningEventIngestInput,
} from '@flowlary/shared'
import { evaluateReadiness } from '../health/readiness.ts'
import { getAdvisorProviderHealth } from '../providers/hypothesisAdvisorProvider.ts'
import { isShuttingDown } from '../server/lifecycle.ts'
import { appendAgentDebugLog } from '../debug/agentLog.ts'
import {
  adminUpdateFeedback,
  createFeatureRequest,
  dismissFeedbackPrompt,
  getAdminSummary,
  getFeedbackAnalyticsEvents,
  getFeedbackConfig,
  getFeedbackEligibility,
  isFeedbackAdmin,
  listAccountFeedback,
  listAdminFeedbackItems,
  listPublicFeatureRequests,
  markFirstWinCompleted,
  markPromptShown,
  recordMeaningfulUse,
  resetFeedbackServicesForTests,
  submitFeedback,
  submitRating,
  voteFeatureRequest,
} from '../services/feedbackService.ts'
import {
  addUserSupportTicketMessage,
  adminGetSupportTicketDetail,
  adminListSupportTickets,
  adminReplySupportTicket,
  adminUpdateSupportTicketRecord,
  createSupportTicketWithNotifications,
  getAccountSupportTicketDetail,
  listAccountSupportTicketsPublic,
  resolveSupportTicketByUser,
} from '../services/supportService.ts'
import {
  getAccountPersonalStats,
  getGrowthAdminSummary,
  getPublicTrustPayload,
  resetProductStatisticsCacheForTests,
} from '../services/productStatisticsService.ts'
import { adminListTestimonials, adminUpdateTestimonial } from '../services/testimonialService.ts'

type JsonRecord = Record<string, unknown>

async function readRawBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) {
      throw new GatewayError('AI_INVALID_REQUEST', 'Request body too large', 413, 'body')
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<JsonRecord> {
  const raw = await readRawBody(req, maxBytes)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid')
    }
    return parsed as JsonRecord
  } catch {
    throw new GatewayError('AI_INVALID_REQUEST', 'Invalid JSON body', 400, 'body')
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function authRouteClientKey(req: IncomingMessage, email?: string): string {
  const ip = req.socket.remoteAddress ?? 'unknown'
  const normalized = email?.trim().toLowerCase()
  return normalized ? `auth:${ip}:${normalized}` : `auth:${ip}`
}

function enforceAuthRouteRateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  operation: string,
  email?: string,
): boolean {
  try {
    checkRateLimit(authRouteClientKey(req, email), 'anonymous', operation)
    return true
  } catch (err) {
    if (err instanceof Error && err.message === 'rate_limited') {
      sendJson(res, 429, { ok: false, error: 'rate_limited' })
      return false
    }
    throw err
  }
}

function sendVerifyEmailResult(
  res: ServerResponse,
  result: ReturnType<typeof verifyEmailWithToken>,
): void {
  if (result.status === 'verified' || result.status === 'already_verified') {
    sendJson(res, 200, {
      ok: true,
      status: result.status,
      account: toAccountPublicView(result.account),
    })
    return
  }
  const statusCode = result.status === 'expired_token' ? 410 : 400
  sendJson(res, statusCode, { ok: false, status: result.status })
}

function headerMap(req: IncomingMessage): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    map[key.toLowerCase()] = Array.isArray(value) ? value[0] : value
  }
  return map
}

function errorResponse(err: GatewayError) {
  return {
    ok: false,
    error: {
      code: err.code,
      message: err.message,
      requestId: err.requestId,
    },
  }
}

function readInstallId(body: JsonRecord): string {
  return typeof body.install_id === 'string' ? body.install_id.trim() : ''
}

function optionalInstallId(headers: Record<string, string | undefined>, body: JsonRecord): string | undefined {
  const fromBody = readInstallId(body)
  if (/^[a-f0-9-]{16,128}$/i.test(fromBody)) return fromBody
  const fromHeader = headers['x-flowlary-install-id']?.trim()
  if (fromHeader && /^[a-f0-9-]{16,128}$/i.test(fromHeader)) return fromHeader
  return undefined
}

function resolveAccountFromBearer(config: AppConfig, headers: Record<string, string | undefined>) {
  const token = parseBearerToken(headers.authorization)
  if (!token?.includes('.')) return null
  const payload = verifyAccessToken(token, config.jwtSecret)
  if (!payload || typeof payload.sub !== 'string') return null
  const account = findAccountById(payload.sub)
  if (!account) return null
  return {
    account,
    sessionId: typeof payload.sid === 'string' ? payload.sid : null,
    view: toAccountPublicView(account),
  }
}

export async function handleHttpRequest(
  config: AppConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const method = req.method ?? 'GET'
  const headers = headerMap(req)

  if (applyCors(req, res, config.corsOrigins)) return

  if (config.env !== 'production' && method === 'POST' && url.pathname === '/__debug/ingest') {
    try {
      const body = await readJsonBody(req, 16_000)
      appendAgentDebugLog(body as Record<string, unknown>)
    } catch {
      /* ignore malformed debug payloads */
    }
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    sendJson(res, isShuttingDown() ? 503 : 200, {
      ok: !isShuttingDown(),
      service: 'flowlary-ai-gateway',
      env: config.env,
      groqConfigured: Boolean(config.groqApiKey),
      billingConfigured: getBillingStatus(config).configured,
      paddleEnvironment: config.paddleEnvironment,
      advisor: {
        enabled: config.advisorEnabled,
        fallbackEnabled: config.advisorFallbackEnabled,
        providerOrder: config.advisorProviderOrder,
        providers: getAdvisorProviderHealth(config).map((snapshot) => ({
          provider: snapshot.provider,
          enabled: snapshot.enabled,
          state: snapshot.state,
          cooldownUntil: snapshot.cooldownUntil,
        })),
      },
      shuttingDown: isShuttingDown() || undefined,
    })
    return
  }

  if (method === 'GET' && url.pathname === '/ready') {
    if (isShuttingDown()) {
      sendJson(res, 503, { ok: false, ready: false, reason: 'shutting_down' })
      return
    }
    const report = evaluateReadiness(config)
    sendJson(res, report.ready ? 200 : 503, {
      ok: report.ready,
      ready: report.ready,
      checks: report.checks.map(({ name, ok, detail }) => ({
        name,
        ok,
        ...(detail ? { detail } : {}),
      })),
    })
    return
  }

  if (config.env === 'test' && method === 'POST' && url.pathname === '/__test/reset') {
    resetRoutesForTests()
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/register') {
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const email = typeof body.email === 'string' ? body.email : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const installId = readInstallId(body)

      if (email && password) {
        const result = registerAccount(config, email, password, optionalInstallId(headers, body))
        void issueVerificationToken(config, result.account.id).catch(() => undefined)
        sendJson(res, 200, {
          ok: true,
          account: result.account,
          access_token: result.tokens.accessToken,
          refresh_token: result.tokens.refreshToken,
          expires_in: result.tokens.expiresIn,
          session_id: result.sessionId,
        })
        return
      }

      if (!/^[a-f0-9-]{16,128}$/i.test(installId)) {
        sendJson(
          res,
          400,
          errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Invalid install id', 400, 'register')),
        )
        return
      }
      upsertInstall(installId, null)
      const token = createInstallToken(installId, config)
      sendJson(res, 200, { ok: true, install_id: installId, token })
    } catch (err) {
      const mapped =
        err instanceof GatewayError
          ? err
          : new GatewayError('AI_INVALID_REQUEST', 'Registration failed', 400, 'register')
      sendJson(res, mapped.status, errorResponse(mapped))
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/login') {
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const email = typeof body.email === 'string' ? body.email : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const result = loginAccount(config, email, password, optionalInstallId(headers, body))
      sendJson(res, 200, {
        ok: true,
        account: result.account,
        access_token: result.tokens.accessToken,
        refresh_token: result.tokens.refreshToken,
        expires_in: result.tokens.expiresIn,
        session_id: result.sessionId,
      })
    } catch (err) {
      const mapped =
        err instanceof GatewayError
          ? err
          : new GatewayError('AI_AUTH_FAILED', 'Login failed', 401, 'login')
      sendJson(res, mapped.status, errorResponse(mapped))
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/forgot-password') {
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const email = typeof body.email === 'string' ? body.email : ''
      if (!email.trim()) {
        sendJson(res, 400, { ok: false, error: 'invalid_email' })
        return
      }
      if (!enforceAuthRouteRateLimit(req, res, 'forgot-password', email)) return
      const result = await requestPasswordReset(config, email)
      if (!result.ok) {
        sendJson(res, 503, { ok: false, error: 'email_not_configured' })
        return
      }
      sendJson(res, 200, { ok: true })
    } catch {
      sendJson(res, 200, { ok: true })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/reset-password') {
    try {
      if (!enforceAuthRouteRateLimit(req, res, 'reset-password')) return
      const body = await readJsonBody(req, config.maxBodyBytes)
      const token = typeof body.token === 'string' ? body.token : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const result = await resetPasswordWithToken(config, token, password)
      if (result.status === 'reset') {
        sendJson(res, 200, { ok: true, status: 'reset' })
        return
      }
      const code =
        result.status === 'expired_token'
          ? 'expired_token'
          : result.status === 'invalid_password'
            ? 'invalid_password'
            : 'invalid_token'
      sendJson(res, result.status === 'expired_token' ? 410 : 400, { ok: false, error: code })
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid_token' })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/refresh') {
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : ''
      const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
      const result = refreshAccountSession(config, refreshToken, sessionId)
      sendJson(res, 200, {
        ok: true,
        account: result.account,
        access_token: result.tokens.accessToken,
        refresh_token: result.tokens.refreshToken,
        expires_in: result.tokens.expiresIn,
        session_id: result.sessionId,
      })
    } catch (err) {
      const mapped =
        err instanceof GatewayError
          ? err
          : new GatewayError('AI_AUTH_FAILED', 'Refresh failed', 401, 'refresh')
      sendJson(res, mapped.status, errorResponse(mapped))
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/device-session') {
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const accountCtx = resolveAccountFromBearer(config, headers)
      if (!accountCtx) {
        sendJson(
          res,
          401,
          errorResponse(new GatewayError('AI_AUTH_FAILED', 'Invalid credentials', 401, 'session')),
        )
        return
      }
      const result = issueAdditionalSession(config, accountCtx.account.id, optionalInstallId(headers, body))
      sendJson(res, 200, {
        ok: true,
        account: result.account,
        access_token: result.tokens.accessToken,
        refresh_token: result.tokens.refreshToken,
        expires_in: result.tokens.expiresIn,
        session_id: result.sessionId,
      })
    } catch (err) {
      const mapped =
        err instanceof GatewayError
          ? err
          : new GatewayError('AI_AUTH_FAILED', 'Session issue failed', 401, 'session')
      sendJson(res, mapped.status, errorResponse(mapped))
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/logout') {
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
      const accountCtx = resolveAccountFromBearer(config, headers)
      if (sessionId) logoutSession(sessionId)
      else if (accountCtx?.sessionId) logoutSession(accountCtx.sessionId)
      sendJson(res, 200, { ok: true })
    } catch {
      sendJson(res, 200, { ok: true })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/auth/verify-email') {
    try {
      const token = url.searchParams.get('token') ?? ''
      const result = verifyEmailWithToken(config, token)
      sendVerifyEmailResult(res, result)
    } catch {
      sendJson(res, 500, { ok: false, status: 'server_error' })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/verify-email') {
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const token = typeof body.token === 'string' ? body.token : url.searchParams.get('token') ?? ''
      if (!token.trim()) {
        sendJson(res, 400, { ok: false, status: 'invalid_token' })
        return
      }
      const result = verifyEmailWithToken(config, token)
      sendVerifyEmailResult(res, result)
    } catch {
      sendJson(res, 500, { ok: false, status: 'server_error' })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/resend-verification') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(
        res,
        401,
        errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'resend-verification')),
      )
      return
    }
    try {
      const result = await issueVerificationToken(config, accountCtx.account.id, { resend: true })
      sendJson(res, 200, { ok: true, sent: result.sent, maskedEmail: result.maskedEmail })
    } catch (err) {
      const mapped =
        err instanceof GatewayError
          ? err
          : new GatewayError('AI_UNAVAILABLE', 'Could not resend verification email', 503, 'resend-verification')
      sendJson(res, mapped.status, errorResponse(mapped))
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/account') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'account')))
      return
    }
    const usage = getAccountUsageSummary(accountCtx.account.id)
    const billing = getBillingStatus(config)
    const view = {
      ...accountCtx.view,
      billingAvailable: billing.configured || accountCtx.view.billingAvailable,
    }
    sendJson(res, 200, {
      ok: true,
      account: view,
      usage: {
        requestCount: usage.requestCount,
        successCount: usage.successCount,
        failureCount: usage.failureCount,
      },
      billingAvailable: view.billingAvailable,
      subscription: view.subscription,
    })
    return
  }

  if (method === 'GET' && url.pathname === '/api/account/statistics') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'account')))
      return
    }
    sendJson(res, 200, { ok: true, statistics: getAccountPersonalStats(accountCtx.account) })
    return
  }

  if (method === 'GET' && url.pathname === '/api/account/entitlement') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'entitlement')))
      return
    }
    const billing = getBillingStatus(config)
    const entitlement = getAccountEntitlement(accountCtx.account.id)
    sendJson(res, 200, {
      ok: true,
      entitlement: {
        ...entitlement,
        billingAvailable: billing.configured || entitlement.billingAvailable,
      },
    })
    return
  }

  if (url.pathname.startsWith('/api/student/')) {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'student')))
      return
    }

    if (method === 'GET' && url.pathname === '/api/student/status') {
      sendJson(res, 200, { ok: true, student: getStudentStatusView(accountCtx.account.id) })
      return
    }

    if (method === 'POST' && url.pathname === '/api/student/verify/request') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const result = await requestStudentVerification(config, accountCtx.account.id, body.academicEmail)
        sendJson(res, 200, { ok: true, sent: result.sent, maskedEmail: result.maskedEmail })
      } catch (err) {
        const mapped =
          err instanceof GatewayError
            ? err
            : new GatewayError('AI_UNAVAILABLE', 'Could not start student verification', 503, 'student-verify')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/student/verify/confirm') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const result = confirmStudentVerification(config, accountCtx.account.id, body.token)
        sendJson(res, 200, { ok: true, status: result.status })
      } catch (err) {
        const mapped =
          err instanceof GatewayError
            ? err
            : new GatewayError('AI_UNAVAILABLE', 'Could not confirm student verification', 503, 'student-confirm')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/student/enrollment/review') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        await submitEnrollmentReview(config, accountCtx.account.id, body.institutionHint)
        sendJson(res, 200, { ok: true })
      } catch (err) {
        const mapped =
          err instanceof GatewayError
            ? err
            : new GatewayError('AI_UNAVAILABLE', 'Could not submit enrollment review', 503, 'student-review')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }
  }

  if (url.pathname === '/api/learning/events') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(
        res,
        401,
        errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'learning-events')),
      )
      return
    }

    if (method === 'GET') {
      const store = listAccountLearningEvents(accountCtx.account.id)
      sendJson(res, 200, { ok: true, store })
      return
    }

    if (method === 'DELETE') {
      clearAccountLearningData(accountCtx.account.id)
      sendJson(res, 200, { ok: true })
      return
    }

    if (method === 'POST') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const eventsRaw = Array.isArray(body.events) ? body.events : []
        if (eventsRaw.length > MAX_LEARNING_EVENT_INGEST_BATCH) {
          sendJson(
            res,
            400,
            errorResponse(
              new GatewayError('AI_INVALID_REQUEST', 'Too many learning events in batch', 400, 'learning-events'),
            ),
          )
          return
        }

        const website =
          headers['x-flowlary-client']?.trim().toLowerCase() === 'website' ||
          headers['x-flowlary-surface']?.trim().toLowerCase() === 'website'

        const validated = []
        let rejected = 0
        for (const item of eventsRaw) {
          const parsed = validateLearningEventIngestInput(item, Date.now(), { website })
          if (!parsed) {
            rejected += 1
            continue
          }
          validated.push(parsed)
        }

        const result = ingestAccountLearningEvents(accountCtx.account.id, validated)
        sendJson(res, 200, {
          ok: true,
          result: { ...result, rejected: result.rejected + rejected },
        })
      } catch (err) {
        const mapped =
          err instanceof GatewayError
            ? err
            : new GatewayError('AI_INVALID_REQUEST', 'Invalid learning events payload', 400, 'learning-events')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }
  }

  if (url.pathname === '/api/learning/profile') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(
        res,
        401,
        errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'learning-profile')),
      )
      return
    }

    if (method === 'GET') {
      const profile = getAccountLearningProfile(accountCtx.account.id)
      sendJson(res, 200, { ok: true, profile })
      return
    }

    if (method === 'PUT') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const profile = normalizeServerLearningProfile(body.profile)
        if (!profile) {
          sendJson(
            res,
            400,
            errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Invalid learning profile', 400, 'learning-profile')),
          )
          return
        }
        putAccountLearningProfile(accountCtx.account.id, profile)
        sendJson(res, 200, { ok: true, profile })
      } catch (err) {
        const mapped =
          err instanceof GatewayError
            ? err
            : new GatewayError('AI_INVALID_REQUEST', 'Invalid learning profile payload', 400, 'learning-profile')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }
  }

  if (url.pathname === '/api/learning/practice-sessions') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(
        res,
        401,
        errorResponse(
          new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'learning-practice-sessions'),
        ),
      )
      return
    }

    if (method === 'GET') {
      const store = getAccountPracticeSessions(accountCtx.account.id)
      sendJson(res, 200, { ok: true, store })
      return
    }

    if (method === 'PUT') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const store = normalizeServerPracticeStore(body.store)
        const result = mergeAccountPracticeSessions(accountCtx.account.id, store)
        sendJson(res, 200, { ok: true, store: result.store, added: result.added })
      } catch (err) {
        const mapped =
          err instanceof GatewayError
            ? err
            : new GatewayError(
                'AI_INVALID_REQUEST',
                'Invalid practice sessions payload',
                400,
                'learning-practice-sessions',
              )
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }
  }

  if (url.pathname === '/api/feedback/config' && method === 'GET') {
    sendJson(res, 200, { ok: true, config: getFeedbackConfig(config) })
    return
  }

  if (url.pathname === '/api/public/stats' && method === 'GET') {
    sendJson(res, 200, { ok: true, ...getPublicTrustPayload(config) })
    return
  }

  if (url.pathname === '/api/public/feature-requests' && method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      items: getPublicTrustPayload(config).featureRequests,
    })
    return
  }

  if (url.pathname.startsWith('/api/feedback') || url.pathname.startsWith('/api/support/ticket')) {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'feedback')))
      return
    }

    if (method === 'GET' && url.pathname === '/api/feedback/eligibility') {
      sendJson(res, 200, { ok: true, ...getFeedbackEligibility(accountCtx.account) })
      return
    }

    if (method === 'GET' && url.pathname === '/api/feedback/mine') {
      sendJson(res, 200, { ok: true, items: listAccountFeedback(accountCtx.account.id) })
      return
    }

    if (method === 'GET' && url.pathname === '/api/feedback/feature-requests') {
      sendJson(res, 200, { ok: true, items: listPublicFeatureRequests(accountCtx.account.id) })
      return
    }

    if (method === 'POST' && url.pathname === '/api/feedback') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const item = submitFeedback(accountCtx.account, body)
        sendJson(res, 200, { ok: true, item })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid feedback', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/feedback/rating') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const item = submitRating(accountCtx.account, body)
        sendJson(res, 200, { ok: true, item })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid rating', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/feedback/feature-request') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const item = createFeatureRequest(accountCtx.account, body)
        sendJson(res, 200, { ok: true, item })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid feature request', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    const voteMatch = url.pathname.match(/^\/api\/feedback\/feature-request\/([^/]+)\/vote$/)
    if (method === 'POST' && voteMatch) {
      try {
        const item = voteFeatureRequest(accountCtx.account.id, decodeURIComponent(voteMatch[1]!))
        sendJson(res, 200, { ok: true, item })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Could not vote', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/feedback/dismiss') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const preferences = dismissFeedbackPrompt(accountCtx.account.id, body)
        sendJson(res, 200, { ok: true, preferences })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid dismiss', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/feedback/prompt-shown') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const preferences = markPromptShown(accountCtx.account.id, body.promptId)
        sendJson(res, 200, { ok: true, preferences })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid prompt', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/feedback/meaningful-use') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const preferences = recordMeaningfulUse(
          accountCtx.account.id,
          typeof body.feature === 'string' ? body.feature : null,
        )
        sendJson(res, 200, { ok: true, preferences })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid event', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/feedback/first-win') {
      const preferences = markFirstWinCompleted(accountCtx.account.id)
      sendJson(res, 200, { ok: true, preferences })
      return
    }

    if (method === 'POST' && url.pathname === '/api/feedback/survey-response') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const item = submitFeedback(accountCtx.account, { ...body, type: 'SATISFACTION' })
        sendJson(res, 200, { ok: true, item })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid survey response', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'POST' && url.pathname === '/api/support/ticket') {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const ticket = createSupportTicketWithNotifications(config, accountCtx.account, body)
        sendJson(res, 200, { ok: true, ticket })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid support ticket', 400, 'feedback')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }

    if (method === 'GET' && url.pathname === '/api/support/tickets') {
      sendJson(res, 200, { ok: true, tickets: listAccountSupportTicketsPublic(accountCtx.account.id) })
      return
    }

    const ticketMatch = url.pathname.match(/^\/api\/support\/tickets\/([^/]+)(?:\/(message|resolve))?$/)
    if (ticketMatch) {
      const ticketId = decodeURIComponent(ticketMatch[1]!)
      if (method === 'GET' && !ticketMatch[2]) {
        try {
          const payload = getAccountSupportTicketDetail(accountCtx.account.id, ticketId)
          sendJson(res, 200, { ok: true, ...payload })
        } catch (err) {
          const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Ticket not found', 404, 'feedback')
          sendJson(res, mapped.status, errorResponse(mapped))
        }
        return
      }
      if (method === 'POST' && ticketMatch[2] === 'message') {
        try {
          const body = await readJsonBody(req, config.maxBodyBytes)
          const message = addUserSupportTicketMessage(accountCtx.account.id, ticketId, body)
          sendJson(res, 200, { ok: true, message })
        } catch (err) {
          const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Invalid message', 400, 'feedback')
          sendJson(res, mapped.status, errorResponse(mapped))
        }
        return
      }
      if (method === 'POST' && ticketMatch[2] === 'resolve') {
        try {
          const ticket = resolveSupportTicketByUser(config, accountCtx.account.id, ticketId)
          sendJson(res, 200, { ok: true, ticket })
        } catch (err) {
          const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Could not resolve ticket', 400, 'feedback')
          sendJson(res, mapped.status, errorResponse(mapped))
        }
        return
      }
    }

    if (url.pathname.startsWith('/api/feedback/admin')) {
      if (!isFeedbackAdmin(config, accountCtx.account)) {
        sendJson(res, 403, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Admin access required', 403, 'feedback-admin')))
        return
      }
      if (method === 'GET' && url.pathname === '/api/feedback/admin/summary') {
        sendJson(res, 200, { ok: true, summary: getAdminSummary(), events: getFeedbackAnalyticsEvents(100) })
        return
      }
      if (method === 'GET' && url.pathname === '/api/feedback/admin/items') {
        const type = url.searchParams.get('type') ?? undefined
        const status = url.searchParams.get('status') ?? undefined
        const limit = Number(url.searchParams.get('limit') ?? '100')
        sendJson(res, 200, {
          ok: true,
          items: listAdminFeedbackItems({ type, status, limit: Number.isFinite(limit) ? limit : 100 }),
        })
        return
      }
      const adminItemMatch = url.pathname.match(/^\/api\/feedback\/admin\/items\/([^/]+)$/)
      if (method === 'PATCH' && adminItemMatch) {
        try {
          const body = await readJsonBody(req, config.maxBodyBytes)
          const item = adminUpdateFeedback(decodeURIComponent(adminItemMatch[1]!), body)
          sendJson(res, 200, { ok: true, item })
        } catch (err) {
          const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Could not update feedback', 400, 'feedback-admin')
          sendJson(res, mapped.status, errorResponse(mapped))
        }
        return
      }
      if (method === 'GET' && url.pathname === '/api/feedback/admin/tickets') {
        const status = url.searchParams.get('status') ?? undefined
        const type = url.searchParams.get('type') ?? undefined
        const priority = url.searchParams.get('priority') ?? undefined
        const limit = Number(url.searchParams.get('limit') ?? '100')
        sendJson(res, 200, {
          ok: true,
          tickets: adminListSupportTickets({ status, type, priority, limit: Number.isFinite(limit) ? limit : 100 }),
        })
        return
      }
      const adminTicketMatch = url.pathname.match(/^\/api\/feedback\/admin\/tickets\/([^/]+)(?:\/reply)?$/)
      if (adminTicketMatch) {
        const ticketId = decodeURIComponent(adminTicketMatch[1]!)
        if (method === 'GET' && !url.pathname.endsWith('/reply')) {
          try {
            const payload = adminGetSupportTicketDetail(ticketId)
            sendJson(res, 200, { ok: true, ...payload })
          } catch (err) {
            const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Ticket not found', 404, 'support-admin')
            sendJson(res, mapped.status, errorResponse(mapped))
          }
          return
        }
        if (method === 'POST' && url.pathname.endsWith('/reply')) {
          try {
            const body = await readJsonBody(req, config.maxBodyBytes)
            const message = adminReplySupportTicket(config, ticketId, body)
            sendJson(res, 200, { ok: true, message })
          } catch (err) {
            const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Could not reply', 400, 'support-admin')
            sendJson(res, mapped.status, errorResponse(mapped))
          }
          return
        }
        if (method === 'PATCH') {
          try {
            const body = await readJsonBody(req, config.maxBodyBytes)
            const ticket = adminUpdateSupportTicketRecord(ticketId, body)
            sendJson(res, 200, { ok: true, ticket })
          } catch (err) {
            const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Could not update ticket', 400, 'support-admin')
            sendJson(res, mapped.status, errorResponse(mapped))
          }
          return
        }
      }
    }
  }

  if (url.pathname.startsWith('/api/admin/')) {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'admin')))
      return
    }
    if (!isFeedbackAdmin(config, accountCtx.account)) {
      sendJson(res, 403, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Admin access required', 403, 'admin')))
      return
    }
    if (method === 'GET' && url.pathname === '/api/admin/growth/summary') {
      sendJson(res, 200, { ok: true, summary: getGrowthAdminSummary(config, accountCtx.account) })
      return
    }
    if (method === 'GET' && url.pathname === '/api/admin/testimonials') {
      sendJson(res, 200, { ok: true, items: adminListTestimonials() })
      return
    }
    const testimonialMatch = url.pathname.match(/^\/api\/admin\/testimonials\/([^/]+)$/)
    if (method === 'PATCH' && testimonialMatch) {
      try {
        const body = await readJsonBody(req, config.maxBodyBytes)
        const item = adminUpdateTestimonial(decodeURIComponent(testimonialMatch[1]!), body)
        sendJson(res, 200, { ok: true, item })
      } catch (err) {
        const mapped = err instanceof GatewayError ? err : new GatewayError('AI_INVALID_REQUEST', 'Could not update testimonial', 400, 'admin')
        sendJson(res, mapped.status, errorResponse(mapped))
      }
      return
    }
  }

  if (method === 'GET' && url.pathname === '/api/billing/config') {
    sendJson(res, 200, { ok: true, ...(await getPublicBillingConfig(config)) })
    return
  }

  if (method === 'GET' && url.pathname === '/api/billing/status') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'billing-status')))
      return
    }
    const entitlement = getAccountEntitlement(accountCtx.account.id)
    sendJson(res, 200, {
      ok: true,
      billing: getAccountBillingStatus(config, accountCtx.account.id),
      entitlement: {
        plan: entitlement.plan,
        isPro: entitlement.isPro,
        inTrial: entitlement.inTrial,
        trialEndsAt: entitlement.trialEndsAt,
        billingAvailable: getBillingStatus(config).configured || entitlement.billingAvailable,
      },
    })
    return
  }

  if (method === 'POST' && (url.pathname === '/api/billing/webhook' || url.pathname === '/api/billing/paddle/webhook')) {
    try {
      const raw = await readRawBody(req, Math.max(config.maxBodyBytes, 256_000))
      const signature = headers['paddle-signature'] ?? ''
      if (!config.paddleWebhookSecret) {
        sendJson(
          res,
          503,
          errorResponse(new GatewayError('AI_UNAVAILABLE', 'Billing webhook is not configured', 503, 'webhook')),
        )
        return
      }
      if (!signature || !raw) {
        sendJson(
          res,
          400,
          errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Missing signature or body', 400, 'webhook')),
        )
        return
      }
      if (!verifyPaddleSignature(raw, signature, config.paddleWebhookSecret)) {
        sendJson(
          res,
          400,
          errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Invalid webhook signature', 400, 'webhook')),
        )
        return
      }
      let payload: Record<string, unknown>
      try {
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid')
        payload = parsed as Record<string, unknown>
      } catch {
        sendJson(
          res,
          400,
          errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Malformed webhook payload', 400, 'webhook')),
        )
        return
      }
      const result = processVerifiedPaddleEvent(config, payload)
      sendJson(res, 200, { ok: true, received: true, duplicate: result.duplicate, ignored: result.ignored })
    } catch (err) {
      const mapped =
        err instanceof GatewayError
          ? err
          : new GatewayError('AI_UNAVAILABLE', 'Webhook processing failed', 500, 'webhook')
      sendJson(res, mapped.status, errorResponse(mapped))
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/billing/checkout') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'checkout')))
      return
    }
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const intervalRaw =
        body && typeof body === 'object' && typeof (body as { interval?: unknown }).interval === 'string'
          ? (body as { interval: string }).interval
          : 'month'
      const interval = intervalRaw === 'year' ? 'year' : 'month'
      const started = await startCheckout(
        config,
        accountCtx.account.id,
        accountCtx.account.paddleCustomerId,
        interval,
      )
      if (!started.ok) {
        const status =
          started.reason === 'already_pro'
            ? 409
            : started.reason === 'email_not_verified'
              ? 403
            : started.reason === 'interval_unavailable'
              ? 400
              : 503
        sendJson(
          res,
          status,
          errorResponse(
            new GatewayError(
              started.reason === 'already_pro' ||
              started.reason === 'interval_unavailable' ||
              started.reason === 'email_not_verified'
                ? 'AI_INVALID_REQUEST'
                : 'AI_UNAVAILABLE',
              started.reason === 'already_pro'
                ? 'This account already has Pro'
                : started.reason === 'email_not_verified'
                  ? 'Verify your email before upgrading to Pro'
                : started.reason === 'billing_unavailable'
                  ? 'Billing is not configured'
                  : started.reason === 'interval_unavailable'
                    ? 'Selected billing interval is unavailable'
                    : 'Checkout is temporarily unavailable',
              status,
              'checkout',
            ),
          ),
        )
        return
      }
      sendJson(res, 200, {
        ok: true,
        transactionId: started.transactionId,
        clientToken: started.clientToken,
        environment: started.environment,
        interval: started.interval,
      })
      return
    } catch {
      /* body optional; client price/plan/amount are ignored — retry with defaults */
      const started = await startCheckout(
        config,
        accountCtx.account.id,
        accountCtx.account.paddleCustomerId,
        'month',
      )
      if (!started.ok) {
        const status =
          started.reason === 'already_pro'
            ? 409
            : started.reason === 'email_not_verified'
              ? 403
              : 503
        sendJson(
          res,
          status,
          errorResponse(
            new GatewayError(
              started.reason === 'already_pro' || started.reason === 'email_not_verified'
                ? 'AI_INVALID_REQUEST'
                : 'AI_UNAVAILABLE',
              started.reason === 'already_pro'
                ? 'This account already has Pro'
                : started.reason === 'email_not_verified'
                  ? 'Verify your email before upgrading to Pro'
                : started.reason === 'billing_unavailable'
                  ? 'Billing is not configured'
                  : 'Checkout is temporarily unavailable',
              status,
              'checkout',
            ),
          ),
        )
        return
      }
      sendJson(res, 200, {
        ok: true,
        transactionId: started.transactionId,
        clientToken: started.clientToken,
        environment: started.environment,
        interval: started.interval,
      })
      return
    }
  }

  if (method === 'POST' && url.pathname === '/api/billing/portal') {
    const accountCtx = resolveAccountFromBearer(config, headers)
    if (!accountCtx) {
      sendJson(res, 401, errorResponse(new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'portal')))
      return
    }
    try {
      await readJsonBody(req, config.maxBodyBytes)
    } catch {
      /* body optional; client customer ids are ignored */
    }
    const portal = await startCustomerPortal(
      config,
      accountCtx.account.paddleCustomerId,
      accountCtx.account.paddleSubscriptionId,
    )
    if (!portal.ok) {
      const status = portal.reason === 'no_customer' ? 409 : 503
      sendJson(
        res,
        status,
        errorResponse(
          new GatewayError(
            'AI_UNAVAILABLE',
            portal.reason === 'no_customer'
              ? 'No billing customer is linked to this account yet'
              : 'Billing portal is unavailable',
            status,
            'portal',
          ),
        ),
      )
      return
    }
    sendJson(res, 200, { ok: true, url: portal.url })
    return
  }

  if (method !== 'POST') {
    sendJson(res, 405, errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Method not allowed', 405, 'route')))
    return
  }

  let auth
  try {
    auth = authenticateRequest(config, headers)
  } catch (err) {
    const mapped = err instanceof GatewayError ? err : new GatewayError('AI_AUTH_FAILED', 'Authentication failed', 401, 'auth')
    sendJson(res, mapped.status, errorResponse(mapped))
    return
  }

  const gateway = createGateway(config)
  const disconnectController = new AbortController()
  if (typeof res.once === 'function') {
    res.once('close', () => {
      if (!res.writableEnded) disconnectController.abort()
    })
  }
  const meta = createRequestMeta(auth, disconnectController.signal)

  try {
    const body = await readJsonBody(req, config.maxBodyBytes)

    if (url.pathname === '/api/ai/correction') {
      const text = typeof body.text === 'string' ? body.text : ''
      const result = await gateway.correction(meta, {
        text,
        fieldType: typeof body.fieldType === 'string' ? body.fieldType : undefined,
        previousText: typeof body.previousText === 'string' ? body.previousText : undefined,
        mode: typeof body.mode === 'string' ? body.mode : undefined,
      })
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/translation' || url.pathname === '/api/translate') {
      const text = typeof body.text === 'string' ? body.text : ''
      const sourceLanguage =
        typeof body.source_language === 'string'
          ? body.source_language
          : typeof body.sourceLanguage === 'string'
            ? body.sourceLanguage
            : ''
      const targetLanguage =
        typeof body.target_language === 'string'
          ? body.target_language
          : typeof body.targetLanguage === 'string'
            ? body.targetLanguage
            : ''
      const mode =
        typeof body.context === 'object' &&
        body.context !== null &&
        typeof (body.context as JsonRecord).mode === 'string'
          ? ((body.context as JsonRecord).mode as string)
          : typeof body.mode === 'string'
            ? body.mode
            : 'shortcut'

      const result = await gateway.translation(meta, {
        text,
        sourceLanguage,
        targetLanguage,
        mode,
      })

      if (url.pathname === '/api/translate') {
        sendJson(res, 200, { translation: result.translation })
        return
      }
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/explanation-localize') {
      const locale = typeof body.locale === 'string' ? body.locale : ''
      const ruleId = typeof body.ruleId === 'string' ? body.ruleId : ''
      const ruleVersion = typeof body.ruleVersion === 'string' ? body.ruleVersion : ''
      const ruleTitle = typeof body.ruleTitle === 'string' ? body.ruleTitle : ''
      const summary = typeof body.summary === 'string' ? body.summary : ''
      const why = typeof body.why === 'string' ? body.why : undefined
      const payload = { locale, ruleId, ruleVersion, ruleTitle, summary, why }
      const result = await gateway.explanationLocalize(
        meta,
        payload as import('@flowlary/shared').ExplanationLocalizeRequest,
      )
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/learning-report-narrate') {
      const locale = typeof body.locale === 'string' ? body.locale : ''
      const snapshot =
        typeof body.snapshot === 'object' && body.snapshot !== null && !Array.isArray(body.snapshot)
          ? body.snapshot
          : null
      if (!snapshot) {
        sendJson(res, 400, errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Invalid snapshot', 400, meta.requestId)))
        return
      }
      const result = await gateway.learningReportNarrate(meta, {
        locale: locale as import('@flowlary/shared').UiLocaleCode,
        snapshot: snapshot as import('../providers/learningReportNarrationProvider.ts').LearningReportNarrationInput['snapshot'],
      })
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/learning-coach') {
      const locale = typeof body.locale === 'string' ? body.locale : ''
      const context =
        typeof body.context === 'object' && body.context !== null && !Array.isArray(body.context)
          ? body.context
          : null
      if (!context) {
        sendJson(res, 400, errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Invalid context', 400, meta.requestId)))
        return
      }
      const result = await gateway.learningCoach(meta, {
        locale: locale as import('@flowlary/shared').UiLocaleCode,
        context: context as import('../providers/learningCoachProvider.ts').LearningCoachInput['context'],
      })
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/hypothesis-advisor') {
      const cycleId = typeof body.cycleId === 'string' ? body.cycleId : ''
      const snippet = typeof body.snippet === 'string' ? body.snippet : ''
      const allowedIntents = Array.isArray(body.allowedIntents)
        ? body.allowedIntents.filter((item): item is string => typeof item === 'string')
        : []
      const hypotheses = Array.isArray(body.hypotheses)
        ? body.hypotheses.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : '',
            intent: typeof item.intent === 'string' ? item.intent : '',
            localScore: typeof item.localScore === 'number' ? item.localScore : 0,
            risk: typeof item.risk === 'string' ? item.risk : 'high',
            needsLLM: item.needsLLM === true,
            conflicts: Array.isArray(item.conflicts)
              ? item.conflicts.filter((id): id is string => typeof id === 'string')
              : [],
            evidence: Array.isArray(item.evidence)
              ? item.evidence.filter((kind): kind is string => typeof kind === 'string')
              : [],
          }))
          .filter((item) => item.id)
        : []
      const result = await gateway.hypothesisAdvisor(meta, {
        cycleId,
        snippet,
        allowedIntents,
        hypotheses,
      })
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/writing-review') {
      const cycleId = typeof body.cycleId === 'string' ? body.cycleId : ''
      const snippet = typeof body.snippet === 'string' ? body.snippet : ''
      const contextBefore = typeof body.contextBefore === 'string' ? body.contextBefore : undefined
      const contextAfter = typeof body.contextAfter === 'string' ? body.contextAfter : undefined
      const result = await gateway.writingReview(meta, {
        cycleId,
        snippet,
        contextBefore,
        contextAfter,
        allowedKinds: Array.isArray(body.allowedKinds)
          ? body.allowedKinds.filter((item): item is string => typeof item === 'string')
          : undefined,
      })
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/layout-classification' || url.pathname === '/api/analyze-word') {
      const word = typeof body.word === 'string' ? body.word : ''
      const sourceLayout =
        typeof body.source_layout === 'string'
          ? body.source_layout
          : typeof body.sourceLayout === 'string'
            ? body.sourceLayout
            : ''
      const candidateLayouts = Array.isArray(body.candidate_layouts)
        ? body.candidate_layouts.filter((item): item is string => typeof item === 'string')
        : Array.isArray(body.candidateLayouts)
          ? body.candidateLayouts.filter((item): item is string => typeof item === 'string')
          : []

      const result = await gateway.layoutClassification(meta, {
        word,
        context: typeof body.context === 'string' ? body.context : undefined,
        sourceLayout,
        candidateLayouts,
      })

      if (url.pathname === '/api/analyze-word') {
        sendJson(res, 200, { result: result.result })
        return
      }
      sendJson(res, 200, result)
      return
    }

    sendJson(res, 404, errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Not found', 404, meta.requestId)))
  } catch (err) {
    if (err instanceof Error && err.message === 'rate_limited') {
      sendJson(
        res,
        429,
        errorResponse(new GatewayError('AI_RATE_LIMITED', 'Rate limit exceeded', 429, meta.requestId)),
      )
      return
    }
    if (err instanceof Error && err.message === 'invalid_request') {
      sendJson(
        res,
        400,
        errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Invalid request', 400, meta.requestId)),
      )
      return
    }
    const mapped = err instanceof GatewayError ? err : new GatewayError('AI_UNAVAILABLE', 'Service unavailable', 503, meta.requestId)
    sendJson(res, mapped.status, errorResponse(mapped))
  }
}

export function resetRoutesForTests(): void {
  resetRateLimitsForTests()
  resetAccountServicesForTests()
  resetAccountLearningEventsForTests()
  resetAccountLearningSyncForTests()
  resetFeedbackServicesForTests()
  resetProductStatisticsCacheForTests()
  resetStoreForTests()
}

export { getEntitlementForAuth }
