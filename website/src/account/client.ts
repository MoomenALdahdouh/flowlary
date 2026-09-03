import { resolvePublicApiUrl } from '../config.ts'
import { ensureWebInstall, readWebInstallId } from './webInstall.ts'

const SESSION_KEY = 'flowlary.web.session'
const AUTH_BROADCAST_CHANNEL = 'flowlary-auth'

let refreshInFlight: Promise<StoredSession | null> | null = null

function broadcastSessionUpdate(session: StoredSession): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
    channel.postMessage({ type: 'session-updated', session })
    channel.close()
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; session?: StoredSession } | null
      if (data?.type !== 'session-updated' || !data.session) return
      const current = readSession()
      if (current && current.expiresAt >= data.session.expiresAt) return
      writeSession(data.session)
    }
  } catch {
    /* ignore */
  }
}

export type WebSubscriptionView = {
  status: string
  plan: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: number | null
  paymentFailed: boolean
}

export type WebAccountView = {
  id: string
  email: string
  emailVerified?: boolean
  plan: string
  status: string
  trialEndsAt?: number | null
  inTrial: boolean
  isPro: boolean
  remainingMs: number
  creditsRemaining?: number
  creditsUsed?: number
  dailyLimit?: number
  resetAt?: number
  monthlyCreditsUsed?: number
  monthlySoftCap?: number | null
  capabilities?: string[]
  billingAvailable: boolean
  subscription?: WebSubscriptionView
}

export type WebEntitlementView = {
  plan: string
  allowed: boolean
  trialEndsAt?: number | null
  remainingMs: number
  creditsRemaining?: number
  creditsUsed?: number
  dailyLimit?: number
  resetAt?: number
  monthlyCreditsUsed?: number
  monthlySoftCap?: number | null
  capabilities?: string[]
  inTrial: boolean
  isPro: boolean
  studentProActive?: boolean
  studentProExpiresAt?: number | null
  billingAvailable?: boolean
  subscription?: WebSubscriptionView
}

export type BillingConfigView = {
  available: boolean
  environment: 'sandbox' | 'production' | string | null
  checkoutAvailable: boolean
  yearlyCheckoutAvailable: boolean
  portalAvailable: boolean
  webhookConfigured: boolean
  clientToken: string | null
  priceConfigured: boolean
  /** @deprecated Prefer proPriceMonthly */
  proPrice: { amount: string; currency: string; interval: string; frequency: number } | null
  proPriceMonthly: { amount: string; currency: string; interval: string; frequency: number } | null
  proPriceYearly: { amount: string; currency: string; interval: string; frequency: number } | null
  trial: { interval: string; frequency: number } | null
}

export type AccountClientError =
  | 'unavailable'
  | 'network'
  | 'auth'
  | 'credentials'
  | 'invalid'
  | 'invalid_email'
  | 'invalid_password'
  | 'duplicate'
  | 'expired'
  | 'disabled'
  | 'email_not_verified'

export type VerificationClientError =
  | AccountClientError
  | 'invalid_token'
  | 'expired_token'
  | 'rate_limited'

type StoredSession = {
  accessToken: string
  refreshToken: string
  sessionId: string
  expiresAt: number
  accountId?: string
  email?: string
}

function readWebSessionStore(): Storage | null {
  if (typeof localStorage !== 'undefined') return localStorage
  if (typeof sessionStorage !== 'undefined') return sessionStorage
  return null
}

function readSession(): StoredSession | null {
  const store = readWebSessionStore()
  if (!store) return null
  try {
    let raw = store.getItem(SESSION_KEY)
    if (!raw && typeof sessionStorage !== 'undefined' && store !== sessionStorage) {
      raw = sessionStorage.getItem(SESSION_KEY)
      if (raw) {
        store.setItem(SESSION_KEY, raw)
        sessionStorage.removeItem(SESSION_KEY)
      }
    }
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.sessionId) return null
    return parsed
  } catch {
    return null
  }
}

function writeSession(session: StoredSession): void {
  const store = readWebSessionStore()
  if (!store) return
  store.setItem(SESSION_KEY, JSON.stringify(session))
  if (typeof sessionStorage !== 'undefined' && store !== sessionStorage) {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }
  broadcastSessionUpdate(session)
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function peekWebSession(): StoredSession | null {
  return readSession()
}

export function hasStoredWebSession(): boolean {
  return readSession() !== null
}

export function mapAccountClientError(
  status: number,
  body: Record<string, unknown>,
  kind: 'network' | 'http' = 'http',
): AccountClientError {
  if (kind === 'network') return 'network'
  const err = (body.error ?? {}) as { code?: string; message?: string }
  const message = String(err.message ?? '').toLowerCase()
  if (status === 409 || message.includes('already registered')) return 'duplicate'
  if (status === 400) {
    if (message.includes('email')) return 'invalid_email'
    if (message.includes('password')) return 'invalid_password'
    return 'invalid'
  }
  if (status === 401) {
    if (message.includes('expired')) return 'expired'
    if (message.includes('invalid credentials')) return 'credentials'
    return 'auth'
  }
  if (status === 403) {
    if (message.includes('verify your email')) return 'email_not_verified'
    if (message.includes('suspend') || message.includes('disabled')) return 'disabled'
  }
  return 'unavailable'
}

async function withInstallContext(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const existing = readWebInstallId()
  if (existing) return { ...body, install_id: existing }
  try {
    const install = await Promise.race([
      ensureWebInstall(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('install_timeout')), 2500)
      }),
    ])
    return { ...body, install_id: install.installId }
  } catch {
    return body
  }
}

async function request(
  path: string,
  init: RequestInit,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: AccountClientError; body?: Record<string, unknown> }> {
  try {
    const installId = readWebInstallId()
    const response = await fetch(`${resolvePublicApiUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(installId ? { 'X-Flowlary-Install-Id': installId } : {}),
        ...(init.headers ?? {}),
      },
    })
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) return { ok: false, error: mapAccountClientError(response.status, body), body }
    return { ok: true, body }
  } catch {
    return { ok: false, error: 'network' }
  }
}

function parseSession(body: Record<string, unknown>, accountId?: string): StoredSession | null {
  const accessToken = typeof body.access_token === 'string' ? body.access_token : ''
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : ''
  const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600
  if (!accessToken || !refreshToken || !sessionId) return null
  const fromAccount = body.account as WebAccountView | undefined
  return {
    accessToken,
    refreshToken,
    sessionId,
    expiresAt: Date.now() + expiresIn * 1000,
    accountId: accountId ?? (typeof fromAccount?.id === 'string' ? fromAccount.id : undefined),
    email: typeof fromAccount?.email === 'string' ? fromAccount.email : undefined,
  }
}

async function refreshWebSessionOnce(): Promise<StoredSession | null> {
  const current = readSession()
  if (!current) return null
  if (current.expiresAt > Date.now() + 30_000) return current
  const refreshed = await request('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refresh_token: current.refreshToken,
      session_id: current.sessionId,
    }),
  })
  if (!refreshed.ok) {
    if (refreshed.error === 'auth' || refreshed.error === 'credentials' || refreshed.error === 'expired') {
      clearSession()
      return null
    }
    if (current.expiresAt > Date.now()) return current
    return null
  }
  const next = parseSession(refreshed.body, current.accountId)
  if (!next) {
    clearSession()
    return null
  }
  writeSession(next)
  broadcastSessionUpdate(next)
  return next
}

export async function ensureFreshWebSession(): Promise<StoredSession | null> {
  const current = readSession()
  if (!current) return null
  if (current.expiresAt > Date.now() + 30_000) return current
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = refreshWebSessionOnce().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

export async function registerWebAccount(
  email: string,
  password: string,
): Promise<{ ok: true; account: WebAccountView } | { ok: false; error: AccountClientError }> {
  const payload = await withInstallContext({ email, password })
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!result.ok) return result
  const account = result.body.account as WebAccountView | undefined
  const session = parseSession(result.body, account?.id)
  if (!session || !account) return { ok: false, error: 'unavailable' }
  writeSession(session)
  return { ok: true, account }
}

export async function loginWebAccount(
  email: string,
  password: string,
): Promise<{ ok: true; account: WebAccountView } | { ok: false; error: AccountClientError }> {
  const payload = await withInstallContext({ email, password })
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!result.ok) return result
  const account = result.body.account as WebAccountView | undefined
  const session = parseSession(result.body, account?.id)
  if (!session || !account) return { ok: false, error: 'unavailable' }
  writeSession(session)
  return { ok: true, account }
}

export async function logoutWebAccount(): Promise<void> {
  const current = readSession()
  if (current) {
    await request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${current.accessToken}` },
      body: JSON.stringify({ session_id: current.sessionId }),
    })
  }
  clearSession()
}

export async function probePublicApi(): Promise<boolean> {
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2500),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function loadWebAccount(): Promise<
  | { ok: true; account: WebAccountView; entitlement: WebEntitlementView | null }
  | { ok: false; error: AccountClientError | null }
> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, error: null }
  const accountRes = await request('/api/account', {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  if (!accountRes.ok) {
    if (
      accountRes.error === 'auth' ||
      accountRes.error === 'credentials' ||
      accountRes.error === 'expired'
    ) {
      clearSession()
    }
    return accountRes
  }
  const entitlementRes = await request('/api/account/entitlement', {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  const account = accountRes.body.account as WebAccountView
  if (account?.id && session.accountId !== account.id) {
    writeSession({ ...session, accountId: account.id })
  }
  if (account?.email && session.email !== account.email) {
    writeSession({ ...session, email: account.email, accountId: account.id })
  }
  return {
    ok: true,
    account,
    entitlement: entitlementRes.ok ? (entitlementRes.body.entitlement as WebEntitlementView) : null,
  }
}

export async function fetchBillingConfig(): Promise<BillingConfigView | null> {
  const result = await request('/api/billing/config', { method: 'GET' })
  if (!result.ok) return null
  const monthly =
    result.body.proPriceMonthly && typeof result.body.proPriceMonthly === 'object'
      ? (result.body.proPriceMonthly as BillingConfigView['proPriceMonthly'])
      : result.body.proPrice && typeof result.body.proPrice === 'object'
        ? (result.body.proPrice as BillingConfigView['proPrice'])
        : null
  const yearly =
    result.body.proPriceYearly && typeof result.body.proPriceYearly === 'object'
      ? (result.body.proPriceYearly as BillingConfigView['proPriceYearly'])
      : null
  return {
    available: result.body.available === true,
    environment: typeof result.body.environment === 'string' ? result.body.environment : null,
    checkoutAvailable: result.body.checkoutAvailable === true,
    yearlyCheckoutAvailable: result.body.yearlyCheckoutAvailable === true,
    portalAvailable: result.body.portalAvailable === true,
    webhookConfigured: result.body.webhookConfigured === true,
    clientToken: typeof result.body.clientToken === 'string' ? result.body.clientToken : null,
    priceConfigured: result.body.priceConfigured === true,
    proPrice: monthly,
    proPriceMonthly: monthly,
    proPriceYearly: yearly,
    trial:
      result.body.trial && typeof result.body.trial === 'object'
        ? (result.body.trial as BillingConfigView['trial'])
        : null,
  }
}

export async function startWebCheckout(
  interval: 'month' | 'year' = 'month',
): Promise<
  | { ok: true; transactionId: string; clientToken: string; environment: 'sandbox' | 'production'; interval: 'month' | 'year' }
  | { ok: false; error: AccountClientError | 'already_pro' | 'email_not_verified' }
> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, error: 'auth' }
  const result = await request('/api/billing/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ interval }),
  })
  if (!result.ok) {
    const message = String((result.body?.error as { message?: string } | undefined)?.message ?? '').toLowerCase()
    if (message.includes('verify your email')) return { ok: false, error: 'email_not_verified' }
    if (result.error === 'duplicate' || result.error === 'invalid') return { ok: false, error: 'already_pro' }
    return result
  }
  const transactionId = typeof result.body.transactionId === 'string' ? result.body.transactionId : ''
  const clientToken = typeof result.body.clientToken === 'string' ? result.body.clientToken : ''
  const environment = result.body.environment === 'production' ? 'production' : 'sandbox'
  const resolvedInterval = result.body.interval === 'year' ? 'year' : 'month'
  if (!transactionId || !clientToken) return { ok: false, error: 'unavailable' }
  return { ok: true, transactionId, clientToken, environment, interval: resolvedInterval }
}

export async function startWebPortal(): Promise<{ ok: true; url: string } | { ok: false; error: AccountClientError }> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, error: 'auth' }
  const result = await request('/api/billing/portal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({}),
  })
  if (!result.ok) return result
  const url = typeof result.body.url === 'string' ? result.body.url : ''
  if (!url) return { ok: false, error: 'unavailable' }
  return { ok: true, url }
}

export async function verifyEmailToken(
  token: string,
): Promise<
  | { ok: true; status: 'verified' | 'already_verified'; account: WebAccountView }
  | { ok: false; error: VerificationClientError }
> {
  try {
    const response = await fetch(
      `${resolvePublicApiUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: 'GET' },
    )
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const status = typeof body.status === 'string' ? body.status : ''
    if (response.ok && (status === 'verified' || status === 'already_verified')) {
      const account = body.account as WebAccountView | undefined
      if (!account) return { ok: false, error: 'unavailable' }
      const session = readSession()
      if (session) {
        writeSession({
          ...session,
          accountId: account.id,
          email: account.email,
        })
      }
      return { ok: true, status, account }
    }
    if (status === 'expired_token') return { ok: false, error: 'expired_token' }
    if (status === 'invalid_token') return { ok: false, error: 'invalid_token' }
    return { ok: false, error: mapAccountClientError(response.status, body) }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** @deprecated Use verifyEmailToken — kept for tests */
export async function verifyWebEmail(
  _code: string,
): Promise<{ ok: true; account: WebAccountView } | { ok: false; error: VerificationClientError }> {
  return { ok: false, error: 'invalid_token' }
}

export async function resendWebVerification(): Promise<
  { ok: true; sent: boolean } | { ok: false; error: VerificationClientError }
> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, error: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({}),
    })
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      if (response.status === 429) return { ok: false, error: 'rate_limited' }
      return { ok: false, error: mapAccountClientError(response.status, body) }
    }
    return { ok: true, sent: body.sent === true }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export type StudentStatusView = {
  status: 'none' | 'pending' | 'active' | 'expired' | 'revoked'
  verified: boolean
  expiresAt: number | null
  institutionHint?: string
  verificationMethod?: string
  pendingEmail?: string
}

export async function fetchStudentStatus(): Promise<
  { ok: true; student: StudentStatusView } | { ok: false; error: AccountClientError }
> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, error: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/student/status`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) return { ok: false, error: mapAccountClientError(response.status, body) }
    return { ok: true, student: body.student as StudentStatusView }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function requestStudentVerification(
  academicEmail: string,
): Promise<
  | { ok: true; sent: boolean; maskedEmail: string }
  | { ok: false; error: AccountClientError | 'rate_limited' }
> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, error: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/student/verify/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ academicEmail }),
    })
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      if (response.status === 429) return { ok: false, error: 'rate_limited' }
      if (response.status === 409) return { ok: false, error: 'duplicate' }
      if (response.status === 400) return { ok: false, error: 'invalid' }
      return { ok: false, error: mapAccountClientError(response.status, body) }
    }
    return { ok: true, sent: body.sent === true, maskedEmail: String(body.maskedEmail ?? '') }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function confirmStudentVerification(
  token: string,
): Promise<
  | { ok: true; status: 'verified' | 'already_verified' | 'invalid_token' | 'expired_token' }
  | { ok: false; error: AccountClientError }
> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, error: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/student/verify/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ token }),
    })
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) return { ok: false, error: mapAccountClientError(response.status, body) }
    return { ok: true, status: body.status as 'verified' | 'already_verified' | 'invalid_token' | 'expired_token' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function submitStudentEnrollmentReview(
  institutionHint: string,
): Promise<{ ok: true } | { ok: false; error: AccountClientError }> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, error: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/student/enrollment/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ institutionHint }),
    })
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) return { ok: false, error: mapAccountClientError(response.status, body) }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}
