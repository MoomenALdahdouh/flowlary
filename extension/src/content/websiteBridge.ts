/**
 * Bridges website account sessions into the extension when the user signs in on
 * flowlary.com / flowlary.test.
 *
 * Uses window.postMessage — CustomEvents do not cross Chrome's isolated worlds.
 */

const WEB_SOURCE = 'flowlary-website'
const EXT_SOURCE = 'flowlary-extension'

type SessionPayload = {
  accessToken?: string
  refreshToken?: string
  sessionId?: string
  accountId?: string
  email?: string
  expiresAt?: number
  account?: Record<string, unknown>
  force?: boolean
}

type OpenDashboardPayload = {
  section?: 'overview' | 'progress' | 'practice' | 'report' | 'settings' | 'activity' | 'privacy' | 'account'
  practiceTargetPatternId?: string
}

function isAllowedOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname
    if (host === 'flowlary.com' || host.endsWith('.flowlary.com')) return true
    if (!import.meta.env.DEV) return false
    return (
      host === 'flowlary.test' ||
      host.endsWith('.flowlary.test') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    )
  } catch {
    return false
  }
}

function announceReady(): void {
  window.postMessage({ source: EXT_SOURCE, type: 'bridge-ready' }, window.location.origin)
}

function forwardSession(payload: SessionPayload): void {
  const valid =
    typeof payload.accessToken === 'string' &&
    typeof payload.refreshToken === 'string' &&
    typeof payload.sessionId === 'string' &&
    typeof payload.accountId === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.expiresAt === 'number'
  if (!valid) {
    return
  }
  void chrome.runtime
    .sendMessage({
      type: 'ACCOUNT_IMPORT_SESSION',
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      sessionId: payload.sessionId,
      accountId: payload.accountId,
      email: payload.email,
      expiresAt: payload.expiresAt,
      account: payload.account,
      force: payload.force === true,
    })
    .then((response) => {
      window.postMessage(
        {
          source: EXT_SOURCE,
          type: 'session-imported',
          ok: Boolean(response && typeof response === 'object' && 'account' in response),
        },
        window.location.origin,
      )
    })
    .catch(() => {
      window.postMessage(
        { source: EXT_SOURCE, type: 'session-imported', ok: false },
        window.location.origin,
      )
    })
}

function forwardOpenDashboard(payload: OpenDashboardPayload): void {
  void chrome.runtime
    .sendMessage({
      type: 'OPEN_DASHBOARD',
      section: payload.section ?? 'practice',
      practiceTargetPatternId: payload.practiceTargetPatternId,
    })
    .catch(() => undefined)
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { source?: string; type?: string; payload?: unknown } | null
  if (event.source !== window) return
  if (!isAllowedOrigin(event.origin)) return
  if (!data || data.source !== WEB_SOURCE || typeof data.type !== 'string') return

  if (data.type === 'bridge-ping') {
    announceReady()
    return
  }
  if (data.type === 'account-session' && data.payload && typeof data.payload === 'object') {
    forwardSession(data.payload as SessionPayload)
    return
  }
  if (data.type === 'open-dashboard' && data.payload && typeof data.payload === 'object') {
    forwardOpenDashboard(data.payload as OpenDashboardPayload)
  }
})

announceReady()
