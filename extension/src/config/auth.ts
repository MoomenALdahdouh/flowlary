import { STORAGE_KEYS } from '@flowlary/shared'
import type { FlowlaryStorage } from '../storage/index.ts'
import { readStoredString } from '../storage/schemas.ts'
import { FLOWLARY_API_BASE } from './endpoints.ts'
import {
  ensureApiAuth,
  readAccountSession,
  readServerEntitlementCache,
  refreshAccountSession,
  type ApiAuth,
} from './accountAuth.ts'

const INSTALL_ID_PATTERN = /^[a-f0-9-]{16,128}$/i
const INSTALL_TOKEN_PATTERN = /^[a-f0-9]{64}$/i

export type InstallAuth = {
  installId: string
  token: string
}

function randomInstallId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `fl-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function readInstallAuth(storage: FlowlaryStorage): Promise<InstallAuth | null> {
  const installId = readStoredString(await storage.get(STORAGE_KEYS.authInstallId, 'local'))
  const token = readStoredString(await storage.get(STORAGE_KEYS.authInstallToken, 'local'))
  if (!INSTALL_ID_PATTERN.test(installId) || !INSTALL_TOKEN_PATTERN.test(token)) return null
  return { installId, token }
}

export async function ensureInstallAuth(storage: FlowlaryStorage): Promise<InstallAuth> {
  const existing = await readInstallAuth(storage)
  if (existing) return existing

  const installId = randomInstallId()
  const response = await fetch(`${FLOWLARY_API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ install_id: installId }),
  })

  if (!response.ok) {
    throw new Error('auth_register_failed')
  }

  const body = (await response.json()) as { install_id?: string; token?: string }
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token || !INSTALL_TOKEN_PATTERN.test(token)) {
    throw new Error('auth_register_invalid')
  }

  await storage.setPrimitive(STORAGE_KEYS.authInstallId, installId, 'local')
  await storage.setPrimitive(STORAGE_KEYS.authInstallToken, token, 'local')
  return { installId, token }
}

export function buildFlowlaryApiHeaders(
  auth: InstallAuth | ApiAuth,
  entitlement: 'trial' | 'free' | 'pro' | 'anonymous' = 'free',
): Record<string, string> {
  const install = 'install' in auth && auth.install ? auth.install : (auth as InstallAuth)
  const bearer =
    'bearerToken' in auth && auth.bearerToken ? auth.bearerToken : install.token
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearer}`,
    'X-Flowlary-Install-Id': install.installId,
    'X-Flowlary-Entitlement': entitlement,
  }
}

export async function buildAuthenticatedHeaders(
  storage: FlowlaryStorage,
  entitlement: 'trial' | 'free' | 'pro' | 'anonymous' = 'free',
): Promise<Record<string, string>> {
  const apiAuth = await ensureApiAuth(storage)
  return buildFlowlaryApiHeaders(apiAuth, entitlement)
}

export function resolveEntitlementHeader(
  status: 'trial' | 'free' | 'pro' | 'unknown',
): 'trial' | 'free' | 'pro' | 'anonymous' {
  if (status === 'trial' || status === 'free' || status === 'pro') return status
  return 'anonymous'
}

/**
 * Refresh account session and build headers for managed AI (correction, translation, etc.).
 * Install-only tokens cannot access managed AI — account JWT is required.
 */
export async function prepareManagedAiRequest(
  storage: FlowlaryStorage,
): Promise<Record<string, string>> {
  let account = await readAccountSession(storage)
  if (!account) {
    throw new Error('account_required')
  }

  if (account.expiresAt <= Date.now() + 30_000) {
    account = await refreshAccountSession(storage)
  }
  if (!account) {
    throw new Error('auth_failed')
  }

  const server = await readServerEntitlementCache(storage)
  let entitlement: 'trial' | 'free' | 'pro' | 'anonymous' = 'anonymous'
  if (server?.isPro) entitlement = 'pro'
  else if (server?.inTrial) entitlement = 'trial'
  else if (server?.plan === 'trial' || server?.plan === 'free' || server?.plan === 'pro') {
    entitlement = server.plan
  }

  try {
    return await buildAuthenticatedHeaders(storage, entitlement)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'auth_register_failed' || err.message === 'auth_register_invalid') {
        throw new Error('network')
      }
    }
    throw err
  }
}
