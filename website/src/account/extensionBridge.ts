import { peekWebSession, type WebAccountView } from './client.ts'

/** Must match extension/src/content/websiteBridge.ts protocol. */
export const FLOWLARY_WEB_SOURCE = 'flowlary-website'
export const FLOWLARY_EXT_SOURCE = 'flowlary-extension'

export type WebSessionBridgePayload = {
  accessToken: string
  refreshToken: string
  sessionId: string
  accountId: string
  email: string
  expiresAt: number
  account?: WebAccountView
  force?: boolean
}

export type DashboardBridgeSection =
  | 'overview'
  | 'progress'
  | 'practice'
  | 'report'
  | 'settings'
  | 'activity'
  | 'privacy'
  | 'account'

type WebBridgePayload =
  | { type: 'bridge-ping' }
  | { type: 'account-session'; payload: WebSessionBridgePayload }
  | {
      type: 'open-dashboard'
      payload: { section: DashboardBridgeSection; practiceTargetPatternId?: string }
    }

function bridgeTargetOrigin(): string {
  const origin = window.location.origin
  return origin && origin !== 'null' ? origin : '*'
}

function postToExtension(message: WebBridgePayload): void {
  if (typeof window === 'undefined') return
  window.postMessage({ source: FLOWLARY_WEB_SOURCE, ...message }, bridgeTargetOrigin())
}

export function publishAccountSessionToExtension(
  session: Omit<WebSessionBridgePayload, 'account'>,
  account?: WebAccountView,
  options?: { force?: boolean },
): void {
  postToExtension({
    type: 'account-session',
    payload: { ...session, account, force: options?.force === true },
  })
}

/** Push the current website session to the extension (best-effort, no-op if extension absent). */
export function syncStoredSessionToExtension(
  account?: WebAccountView | null,
  options?: { force?: boolean },
): void {
  const session = peekWebSession()
  if (!session?.accessToken || !session.refreshToken || !session.sessionId) return
  const accountId = session.accountId ?? account?.id
  const email = session.email ?? account?.email
  if (!accountId || !email) return
  publishAccountSessionToExtension(
    {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
      accountId,
      email,
      expiresAt: session.expiresAt,
    },
    account ?? undefined,
    options,
  )
}

/** Best-effort probe: true when the extension content bridge responds on this page. */
export function probeExtensionBridge(timeoutMs = 1200): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      resolve(value)
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string } | null
      if (data?.source === FLOWLARY_EXT_SOURCE && data.type === 'bridge-ready') {
        finish(true)
      }
    }
    window.addEventListener('message', onMessage)
    const timer = window.setTimeout(() => finish(false), timeoutMs)
    postToExtension({ type: 'bridge-ping' })
  })
}

/** Ask the extension to open its dashboard (practice deep links when target is provided). */
export function publishOpenDashboard(
  section: DashboardBridgeSection = 'practice',
  practiceTargetPatternId?: string,
): void {
  postToExtension({
    type: 'open-dashboard',
    payload: { section, practiceTargetPatternId },
  })
}
