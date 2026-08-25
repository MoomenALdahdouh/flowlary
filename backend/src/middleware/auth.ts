import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AppConfig } from '../config/env.ts'
import { GatewayError } from '../gateway/errors.ts'

export type AuthContext = {
  userId: string
  entitlement: 'anonymous' | 'free' | 'trial' | 'pro' | 'byok'
  installId: string
}

const TOKEN_PATTERN = /^[a-f0-9-]{16,128}$/i

export function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1]?.trim()
  return token && TOKEN_PATTERN.test(token) ? token : null
}

export function deriveUserId(installId: string, config: AppConfig): string {
  return createHmac('sha256', config.authSecret).update(installId).digest('hex').slice(0, 32)
}

export function authenticateRequest(
  config: AppConfig,
  headers: Record<string, string | undefined>,
): AuthContext {
  const installId = headers['x-flowlary-install-id']?.trim()
  const token = parseBearerToken(headers.authorization)
  const entitlementRaw = headers['x-flowlary-entitlement']?.trim().toLowerCase()

  const entitlement =
    entitlementRaw === 'pro' ||
    entitlementRaw === 'trial' ||
    entitlementRaw === 'free' ||
    entitlementRaw === 'byok'
      ? entitlementRaw
      : 'anonymous'

  if (config.authDisabled) {
    const fallbackInstall = installId && TOKEN_PATTERN.test(installId) ? installId : 'dev-install'
    return {
      userId: deriveUserId(fallbackInstall, config),
      entitlement: entitlement === 'anonymous' ? 'free' : entitlement,
      installId: fallbackInstall,
    }
  }

  if (!installId || !TOKEN_PATTERN.test(installId) || !token) {
    throw new GatewayError('AI_AUTH_FAILED', 'Authentication required', 401, 'auth')
  }

  const expected = createInstallToken(installId, config)
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new GatewayError('AI_AUTH_FAILED', 'Invalid credentials', 401, 'auth')
  }

  return {
    userId: deriveUserId(installId, config),
    entitlement,
    installId,
  }
}

export function createInstallToken(installId: string, config: AppConfig): string {
  return createHmac('sha256', config.authSecret).update(`install:${installId}`).digest('hex')
}
