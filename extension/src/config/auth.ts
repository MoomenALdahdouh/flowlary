import { STORAGE_KEYS } from '@flowlary/shared'
import type { FlowlaryStorage } from '../storage/index.ts'
import { readStoredString } from '../storage/schemas.ts'
import { FLOWLARY_API_BASE } from './endpoints.ts'

const INSTALL_ID_PATTERN = /^[a-f0-9-]{16,128}$/i

function randomInstallId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `fl-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export type InstallAuth = {
  installId: string
  token: string
}

export async function readInstallAuth(storage: FlowlaryStorage): Promise<InstallAuth | null> {
  const installId = readStoredString(await storage.get(STORAGE_KEYS.authInstallId, 'local'))
  const token = readStoredString(await storage.get(STORAGE_KEYS.authInstallToken, 'local'))
  if (!INSTALL_ID_PATTERN.test(installId) || !INSTALL_ID_PATTERN.test(token)) return null
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
  if (!token || !INSTALL_ID_PATTERN.test(token)) {
    throw new Error('auth_register_invalid')
  }

  await storage.setPrimitive(STORAGE_KEYS.authInstallId, installId, 'local')
  await storage.setPrimitive(STORAGE_KEYS.authInstallToken, token, 'local')
  return { installId, token }
}

export function buildFlowlaryApiHeaders(
  auth: InstallAuth,
  entitlement: 'trial' | 'free' | 'pro' | 'byok' | 'anonymous' = 'free',
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.token}`,
    'X-Flowlary-Install-Id': auth.installId,
    'X-Flowlary-Entitlement': entitlement,
  }
}

export function resolveEntitlementHeader(
  status: 'trial' | 'free' | 'pro' | 'unknown',
): 'trial' | 'free' | 'pro' | 'anonymous' {
  if (status === 'trial' || status === 'free' || status === 'pro') return status
  return 'anonymous'
}
