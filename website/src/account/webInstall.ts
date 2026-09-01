import { resolvePublicApiUrl } from '../config.ts'

const INSTALL_ID_KEY = 'flowlary.web.install_id'
const INSTALL_TOKEN_KEY = 'flowlary.web.install_token'

const INSTALL_ID_PATTERN = /^[a-f0-9-]{16,128}$/i
const INSTALL_TOKEN_PATTERN = /^[a-f0-9]{64}$/i

export type WebInstallAuth = {
  installId: string
  token: string
}

function randomInstallId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `fl-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readStoredInstall(): WebInstallAuth | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const installId = localStorage.getItem(INSTALL_ID_KEY)?.trim() ?? ''
    const token = localStorage.getItem(INSTALL_TOKEN_KEY)?.trim() ?? ''
    if (!INSTALL_ID_PATTERN.test(installId) || !INSTALL_TOKEN_PATTERN.test(token)) return null
    return { installId, token }
  } catch {
    return null
  }
}

function writeStoredInstall(auth: WebInstallAuth): void {
  localStorage.setItem(INSTALL_ID_KEY, auth.installId)
  localStorage.setItem(INSTALL_TOKEN_KEY, auth.token)
}

/** Bootstrap or return the website install identity (mirrors extension ensureInstallAuth). */
export async function ensureWebInstall(): Promise<WebInstallAuth> {
  const existing = readStoredInstall()
  if (existing) return existing

  const installId = randomInstallId()
  const response = await fetch(`${resolvePublicApiUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ install_id: installId }),
  })

  if (!response.ok) {
    throw new Error('web_install_register_failed')
  }

  const body = (await response.json()) as { install_id?: string; token?: string }
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token || !INSTALL_TOKEN_PATTERN.test(token)) {
    throw new Error('web_install_register_invalid')
  }

  const auth = { installId, token }
  writeStoredInstall(auth)
  return auth
}

export function readWebInstallId(): string | null {
  return readStoredInstall()?.installId ?? null
}
