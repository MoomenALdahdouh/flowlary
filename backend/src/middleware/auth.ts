import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AppConfig } from '../config/env.ts'
import { GatewayError } from '../gateway/errors.ts'
import { parseClientEntitlementClaim } from './entitlement.ts'
import type { RateLimitTier } from './rateLimit.ts'
import { findAccountById } from '../db/store.ts'
import {
  getAccountEntitlement,
  resolveServerEntitlementForAccount,
} from '../services/accountService.ts'
import { verifyAccessToken } from '../services/crypto.ts'

export type AuthContext = {
  userId: string
  accountId: string | null
  sessionId: string | null
  installId: string
  /** Server-authoritative plan for rate limits and AI access. */
  rateLimitTier: RateLimitTier
  /** Whether managed AI is permitted for this request. */
  allowed: boolean
  denyReason?: string
  /** Advisory client header — never billing truth. */
  clientClaim: string | null
  authKind: 'account' | 'install' | 'dev'
}

const INSTALL_ID_PATTERN = /^[a-f0-9-]{16,128}$/i
const INSTALL_TOKEN_PATTERN = /^[a-f0-9]{64}$/i

export function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1]?.trim()
  return token || null
}

export function deriveUserId(installId: string, config: AppConfig): string {
  return createHmac('sha256', config.authSecret).update(installId).digest('hex').slice(0, 32)
}

/**
 * Phase 26: install tokens never unlock managed AI.
 * Local features work without an account; AI requires a signed-in account JWT.
 */
function resolveInstallAuth(
  config: AppConfig,
  installId: string,
  clientClaimRaw: string | undefined,
): AuthContext {
  const clientClaim = parseClientEntitlementClaim(clientClaimRaw)
  return {
    userId: deriveUserId(installId, config),
    accountId: null,
    sessionId: null,
    installId,
    rateLimitTier: 'anonymous',
    allowed: false,
    denyReason: 'account_required',
    clientClaim,
    authKind: 'install',
  }
}

function resolveAccountAuth(
  config: AppConfig,
  payload: Record<string, unknown>,
  installId: string,
  clientClaimRaw: string | undefined,
): AuthContext {
  const accountId = typeof payload.sub === 'string' ? payload.sub : ''
  const sessionId = typeof payload.sid === 'string' ? payload.sid : null
  const account = findAccountById(accountId)
  if (!account) {
    throw new GatewayError('AI_AUTH_FAILED', 'Account not found', 401, 'auth')
  }
  const entitlement = resolveServerEntitlementForAccount(account)
  const clientClaim = parseClientEntitlementClaim(clientClaimRaw)
  return {
    userId: accountId,
    accountId,
    sessionId,
    installId,
    rateLimitTier: entitlement.rateLimitTier,
    allowed: entitlement.allowed,
    denyReason: entitlement.reason,
    clientClaim,
    authKind: 'account',
  }
}

export function authenticateRequest(
  config: AppConfig,
  headers: Record<string, string | undefined>,
): AuthContext {
  const installId = headers['x-flowlary-install-id']?.trim() ?? ''
  const token = parseBearerToken(headers.authorization)
  const clientClaimRaw = headers['x-flowlary-entitlement']

  if (config.authDisabled) {
    if (token?.includes('.')) {
      const payload = verifyAccessToken(token, config.jwtSecret)
      if (payload) {
        const fallbackInstall = INSTALL_ID_PATTERN.test(installId) ? installId : 'dev-install'
        return resolveAccountAuth(config, payload, fallbackInstall, clientClaimRaw)
      }
    }
    const fallbackInstall = INSTALL_ID_PATTERN.test(installId) ? installId : 'dev-install'
    return {
      userId: deriveUserId(fallbackInstall, config),
      accountId: null,
      sessionId: null,
      installId: fallbackInstall,
      rateLimitTier: 'free',
      allowed: true,
      clientClaim: parseClientEntitlementClaim(clientClaimRaw),
      authKind: 'dev',
    }
  }

  if (!INSTALL_ID_PATTERN.test(installId) || !token) {
    throw new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'auth')
  }

  if (token.includes('.')) {
    const payload = verifyAccessToken(token, config.jwtSecret)
    if (!payload) {
      throw new GatewayError('AI_AUTH_FAILED', 'Invalid access token', 401, 'auth')
    }
    return resolveAccountAuth(config, payload, installId, clientClaimRaw)
  }

  if (!INSTALL_TOKEN_PATTERN.test(token)) {
    throw new GatewayError('AI_AUTH_FAILED', 'Invalid credentials', 401, 'auth')
  }

  const expected = createInstallToken(installId, config)
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new GatewayError('AI_AUTH_FAILED', 'Invalid credentials', 401, 'auth')
  }

  return resolveInstallAuth(config, installId, clientClaimRaw)
}

export function createInstallToken(installId: string, config: AppConfig): string {
  return createHmac('sha256', config.authSecret).update(`install:${installId}`).digest('hex')
}

export function getEntitlementForAuth(auth: AuthContext) {
  if (auth.accountId) return getAccountEntitlement(auth.accountId)
  return {
    plan: 'anonymous' as const,
    status: 'none' as const,
    allowed: false,
    reason: (auth.denyReason as 'anonymous' | 'account_required' | undefined) ?? 'account_required',
    remainingMs: 0,
    creditsRemaining: 0,
    creditsUsed: 0,
    dailyLimit: 0,
    resetAt: Date.now(),
    monthlyCreditsUsed: 0,
    monthlySoftCap: null,
    monthlyResetAt: null,
    capabilities: [] as string[],
    inTrial: false,
    isPro: false,
    rateLimitTier: 'anonymous' as const,
    billingAvailable: false,
    subscription: {
      status: 'none' as const,
      plan: 'free' as const,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      paymentFailed: false,
      billingEnvironment: null,
    },
  }
}
