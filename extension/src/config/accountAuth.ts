import { STORAGE_KEYS } from '@flowlary/shared'
import type { FlowlaryStorage } from '../storage/index.ts'
import { isValidAccountId } from '../storage/activeAccountContext.ts'
import {
  attachActiveAccount,
  detachActiveAccount,
} from '../storage/accountSessionLifecycle.ts'
import { readStoredString } from '../storage/schemas.ts'
import { FLOWLARY_API_BASE } from './endpoints.ts'
import { ensureInstallAuth, type InstallAuth } from './auth.ts'
import { markApiHealthOk } from './apiHealth.ts'

export type AccountSession = {
  accessToken: string
  refreshToken: string
  sessionId: string
  accountId: string
  email: string
  expiresAt: number
}

export async function readAccountSession(storage: FlowlaryStorage): Promise<AccountSession | null> {
  const accessToken = readStoredString(await storage.get(STORAGE_KEYS.authAccessToken, 'local'))
  const refreshToken = readStoredString(await storage.get(STORAGE_KEYS.authRefreshToken, 'local'))
  const sessionId = readStoredString(await storage.get(STORAGE_KEYS.authSessionId, 'local'))
  const accountId = readStoredString(await storage.get(STORAGE_KEYS.authAccountId, 'local'))
  const email = readStoredString(await storage.get(STORAGE_KEYS.authAccountEmail, 'local'))
  const expiresRaw = await storage.get(STORAGE_KEYS.authTokenExpiresAt, 'local')
  const expiresAt = readExpiresAt(expiresRaw)
  if (!accessToken || !refreshToken || !sessionId || !email || !isValidAccountId(accountId)) {
    return null
  }
  return { accessToken, refreshToken, sessionId, accountId, email, expiresAt }
}

function readExpiresAt(expiresRaw: unknown): number {
  if (typeof expiresRaw === 'number' && Number.isFinite(expiresRaw)) return expiresRaw
  if (typeof expiresRaw === 'string') return Number(expiresRaw) || 0
  if (expiresRaw && typeof expiresRaw === 'object' && 'value' in expiresRaw) {
    return readExpiresAt((expiresRaw as { value: unknown }).value)
  }
  return 0
}

export class AccountAuthError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = 'AccountAuthError'
    this.code = code
  }
}

function mapAuthHttpError(
  status: number,
  body: AuthResponse & { error?: { message?: string } },
  fallback: string,
): AccountAuthError {
  const message = String(body.error?.message ?? '').toLowerCase()
  if (status === 409 || message.includes('already registered')) {
    return new AccountAuthError('account_duplicate')
  }
  if (status === 400) {
    if (message.includes('email')) return new AccountAuthError('invalid_email')
    if (message.includes('password')) return new AccountAuthError('invalid_password')
    return new AccountAuthError('invalid_password')
  }
  if (status >= 500 || status === 502 || status === 503) {
    return new AccountAuthError('network')
  }
  if (status === 401) return new AccountAuthError('account_credentials')
  return new AccountAuthError(fallback)
}

async function postAuthJson(
  path: string,
  init: RequestInit,
  fallback: string,
): Promise<AuthResponse> {
  let response: Response
  try {
    response = await fetch(`${FLOWLARY_API_BASE}${path}`, init)
  } catch {
    throw new AccountAuthError('network')
  }
  const body = (await response.json().catch(() => ({}))) as AuthResponse & { error?: { message?: string } }
  if (!response.ok) throw mapAuthHttpError(response.status, body, fallback)
  return body
}

async function persistAccountSession(storage: FlowlaryStorage, session: AccountSession): Promise<void> {
  await storage.setPrimitive(STORAGE_KEYS.authAccessToken, session.accessToken, 'local')
  await storage.setPrimitive(STORAGE_KEYS.authRefreshToken, session.refreshToken, 'local')
  await storage.setPrimitive(STORAGE_KEYS.authSessionId, session.sessionId, 'local')
  await storage.setPrimitive(STORAGE_KEYS.authAccountId, session.accountId, 'local')
  await storage.setPrimitive(STORAGE_KEYS.authAccountEmail, session.email, 'local')
  await storage.setPrimitive(STORAGE_KEYS.authTokenExpiresAt, String(session.expiresAt), 'local')
}

export async function clearAccountSession(storage: FlowlaryStorage): Promise<void> {
  await detachActiveAccount(storage)
  await storage.remove(STORAGE_KEYS.authAccessToken, 'local')
  await storage.remove(STORAGE_KEYS.authRefreshToken, 'local')
  await storage.remove(STORAGE_KEYS.authSessionId, 'local')
  await storage.remove(STORAGE_KEYS.authAccountEmail, 'local')
  await storage.remove(STORAGE_KEYS.authAccountPlan, 'local')
  await storage.remove(STORAGE_KEYS.authTokenExpiresAt, 'local')
  await storage.remove(STORAGE_KEYS.authServerEntitlement, 'local')
  await storage.remove(STORAGE_KEYS.authEntitlementSyncedAt, 'local')
  // authAccountId removed inside detachActiveAccount
}

type AccountEntitlementSeed = {
  plan?: string
  inTrial?: boolean
  isPro?: boolean
  studentProActive?: boolean
  studentProExpiresAt?: number | null
  trialEndsAt?: number | null
  creditsRemaining?: number
  creditsUsed?: number
  dailyLimit?: number
  resetAt?: number
  remainingMs?: number
  monthlyCreditsUsed?: number
    monthlySoftCap?: number | null
    capabilities?: string[]
    billingAvailable?: boolean
    emailVerified?: boolean
  }

type AuthResponse = {
  ok?: boolean
  access_token?: string
  refresh_token?: string
  session_id?: string
  expires_in?: number
  account?: AccountEntitlementSeed & { id?: string; email?: string }
}

export async function seedEntitlementFromAccountView(
  storage: FlowlaryStorage,
  account: AccountEntitlementSeed,
): Promise<void> {
  const plan = typeof account.plan === 'string' ? account.plan : 'free'
  const creditsRemaining =
    typeof account.creditsRemaining === 'number'
      ? account.creditsRemaining
      : typeof account.remainingMs === 'number'
        ? account.remainingMs
        : 0
  await persistServerEntitlement(storage, {
    plan,
    isPro: account.isPro === true,
    inTrial: account.inTrial === true && account.isPro !== true,
    studentProActive: account.studentProActive === true,
    studentProExpiresAt:
      typeof account.studentProExpiresAt === 'number' ? account.studentProExpiresAt : null,
    trialEndsAt: typeof account.trialEndsAt === 'number' ? account.trialEndsAt : null,
    remainingMs: typeof account.remainingMs === 'number' ? account.remainingMs : creditsRemaining,
    creditsRemaining,
    creditsUsed: typeof account.creditsUsed === 'number' ? account.creditsUsed : 0,
    dailyLimit: typeof account.dailyLimit === 'number' ? account.dailyLimit : 0,
    resetAt: typeof account.resetAt === 'number' ? account.resetAt : 0,
    monthlyCreditsUsed: typeof account.monthlyCreditsUsed === 'number' ? account.monthlyCreditsUsed : 0,
    monthlySoftCap: typeof account.monthlySoftCap === 'number' ? account.monthlySoftCap : null,
    monthlyResetAt: null,
    capabilities: Array.isArray(account.capabilities)
      ? account.capabilities.filter((c): c is string => typeof c === 'string')
      : [],
    billingAvailable: account.billingAvailable === true,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    paymentFailed: false,
    currentPeriodEnd: null,
    emailVerified: account.emailVerified !== false,
    syncedAt: Date.now(),
  })
}

function parseAuthResponse(body: AuthResponse): AccountSession | null {
  const accessToken = typeof body.access_token === 'string' ? body.access_token : ''
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : ''
  const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
  const accountId = typeof body.account?.id === 'string' ? body.account.id.trim() : ''
  const email = typeof body.account?.email === 'string' ? body.account.email : ''
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600
  if (!accessToken || !refreshToken || !sessionId || !isValidAccountId(accountId)) return null
  return {
    accessToken,
    refreshToken,
    sessionId,
    accountId,
    email,
    expiresAt: Date.now() + expiresIn * 1000,
  }
}

export async function registerAccount(
  storage: FlowlaryStorage,
  email: string,
  password: string,
): Promise<AccountSession> {
  const install = await ensureInstallAuth(storage)
  const body = await postAuthJson(
    '/api/auth/register',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flowlary-Install-Id': install.installId,
      },
      body: JSON.stringify({ email, password, install_id: install.installId }),
    },
    'account_register_failed',
  )
  const session = parseAuthResponse(body)
  if (!session) throw new AccountAuthError('account_register_invalid')
  await persistAccountSession(storage, session)
  if (body.account) {
    await seedEntitlementFromAccountView(storage, body.account)
  }
  await attachActiveAccount(storage, session.accountId)
  return session
}

export async function loginAccount(
  storage: FlowlaryStorage,
  email: string,
  password: string,
): Promise<AccountSession> {
  const install = await ensureInstallAuth(storage)
  const body = await postAuthJson(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flowlary-Install-Id': install.installId,
      },
      body: JSON.stringify({ email, password, install_id: install.installId }),
    },
    'account_login_failed',
  )
  const session = parseAuthResponse(body)
  if (!session) throw new AccountAuthError('account_login_invalid')
  await persistAccountSession(storage, session)
  if (body.account) {
    await seedEntitlementFromAccountView(storage, body.account)
  }
  await attachActiveAccount(storage, session.accountId)
  return session
}

const SESSION_REFRESH_SKEW_MS = 60_000

export async function importWebAccountSession(
  storage: FlowlaryStorage,
  input: {
    accessToken: string
    refreshToken: string
    sessionId: string
    accountId: string
    email: string
    expiresAt: number
  },
  accountView?: AccountEntitlementSeed,
  options?: { force?: boolean },
): Promise<AccountSession> {
  const current = await readAccountSession(storage)
  if (
    !options?.force &&
    current &&
    current.accountId === input.accountId &&
    current.expiresAt > Date.now() + SESSION_REFRESH_SKEW_MS
  ) {
    return current
  }

  let exchanged: AccountSession | null
  try {
    exchanged = await exchangeWebsiteSessionForDevice(storage, input.accessToken)
  } catch (err) {
    if (current && current.accountId === input.accountId) return current
    throw err
  }
  if (!exchanged) {
    if (current && current.accountId === input.accountId) return current
    throw new AccountAuthError('account_import_failed')
  }
  const session = exchanged
  await persistAccountSession(storage, session)
  if (accountView) {
    await seedEntitlementFromAccountView(storage, accountView)
  }
  await attachActiveAccount(storage, session.accountId)
  if (options?.force) {
    await syncServerEntitlement(storage)
  }
  return session
}

/**
 * Mint an extension-owned session from a website access token.
 * Returns null only when the API has no device-session endpoint (older gateway).
 */
async function exchangeWebsiteSessionForDevice(
  storage: FlowlaryStorage,
  websiteAccessToken: string,
): Promise<AccountSession | null> {
  const install = await ensureInstallAuth(storage)
  let response: Response
  try {
    response = await fetch(`${FLOWLARY_API_BASE}/api/auth/device-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${websiteAccessToken}`,
        'X-Flowlary-Install-Id': install.installId,
      },
      body: JSON.stringify({ install_id: install.installId }),
    })
  } catch {
    throw new AccountAuthError('network')
  }
  if (response.status === 404) return null
  const body = (await response.json().catch(() => ({}))) as AuthResponse & { error?: { message?: string } }
  if (!response.ok) throw mapAuthHttpError(response.status, body, 'account_import_failed')
  const session = parseAuthResponse(body)
  if (!session) throw new AccountAuthError('account_import_failed')
  return session
}

let refreshInFlight: Promise<AccountSession | null> | null = null

async function refreshAccountSessionOnce(storage: FlowlaryStorage): Promise<AccountSession | null> {
  const current = await readAccountSession(storage)
  if (!current) return null
  let response: Response
  try {
    response = await fetch(`${FLOWLARY_API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: current.refreshToken,
        session_id: current.sessionId,
      }),
    })
  } catch {
    return current
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await clearAccountSession(storage)
      return null
    }
    return current
  }
  const body = (await response.json()) as AuthResponse
  const session = parseAuthResponse(body)
  if (!session) {
    await clearAccountSession(storage)
    return null
  }
  await persistAccountSession(storage, session)
  if (body.account) {
    await seedEntitlementFromAccountView(storage, body.account)
  }
  await attachActiveAccount(storage, session.accountId)
  return session
}

export async function refreshAccountSession(storage: FlowlaryStorage): Promise<AccountSession | null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = refreshAccountSessionOnce(storage).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

const SESSION_REFRESH_ALARM = 'flowlary-session-refresh'
const PROACTIVE_REFRESH_WINDOW_MS = 5 * 60_000

export async function refreshAccountSessionIfNeeded(storage: FlowlaryStorage): Promise<void> {
  const session = await readAccountSession(storage)
  if (!session) return
  if (session.expiresAt > Date.now() + PROACTIVE_REFRESH_WINDOW_MS) return
  await refreshAccountSession(storage)
}

export function scheduleAccountSessionRefresh(): void {
  if (typeof chrome === 'undefined' || !chrome.alarms?.create) return
  void chrome.alarms.create(SESSION_REFRESH_ALARM, { periodInMinutes: 10 })
}

export function registerAccountSessionRefreshAlarm(
  onRefresh: () => void | Promise<void>,
): void {
  if (typeof chrome === 'undefined' || !chrome.alarms?.onAlarm) return
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SESSION_REFRESH_ALARM) void onRefresh()
  })
}

export type ServerEntitlementCache = {
  plan: string
  isPro: boolean
  inTrial: boolean
  studentProActive: boolean
  studentProExpiresAt: number | null
  trialEndsAt: number | null
  remainingMs: number
  creditsRemaining: number
  creditsUsed: number
  dailyLimit: number
  resetAt: number
  monthlyCreditsUsed: number
  monthlySoftCap: number | null
  monthlyResetAt: number | null
  capabilities: string[]
  billingAvailable: boolean
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean
  paymentFailed: boolean
  currentPeriodEnd: number | null
  emailVerified: boolean
  syncedAt: number
}

export async function readServerEntitlementCache(storage: FlowlaryStorage): Promise<ServerEntitlementCache | null> {
  const raw = await storage.get(STORAGE_KEYS.authServerEntitlement, 'local')
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<ServerEntitlementCache>
  return {
    plan: typeof value.plan === 'string' ? value.plan : 'free',
    isPro: value.isPro === true,
    inTrial: value.inTrial === true,
    studentProActive: value.studentProActive === true,
    studentProExpiresAt:
      typeof value.studentProExpiresAt === 'number' ? value.studentProExpiresAt : null,
    trialEndsAt: typeof value.trialEndsAt === 'number' ? value.trialEndsAt : null,
    remainingMs: typeof value.remainingMs === 'number' ? value.remainingMs : 0,
    creditsRemaining: typeof value.creditsRemaining === 'number' ? value.creditsRemaining : 0,
    creditsUsed: typeof value.creditsUsed === 'number' ? value.creditsUsed : 0,
    dailyLimit: typeof value.dailyLimit === 'number' ? value.dailyLimit : 0,
    resetAt: typeof value.resetAt === 'number' ? value.resetAt : 0,
    monthlyCreditsUsed: typeof value.monthlyCreditsUsed === 'number' ? value.monthlyCreditsUsed : 0,
    monthlySoftCap: typeof value.monthlySoftCap === 'number' ? value.monthlySoftCap : null,
    monthlyResetAt: typeof value.monthlyResetAt === 'number' ? value.monthlyResetAt : null,
    capabilities: Array.isArray(value.capabilities)
      ? value.capabilities.filter((c): c is string => typeof c === 'string')
      : [],
    billingAvailable: value.billingAvailable === true,
    subscriptionStatus: typeof value.subscriptionStatus === 'string' ? value.subscriptionStatus : null,
    cancelAtPeriodEnd: value.cancelAtPeriodEnd === true,
    paymentFailed: value.paymentFailed === true,
    currentPeriodEnd: typeof value.currentPeriodEnd === 'number' ? value.currentPeriodEnd : null,
    emailVerified: value.emailVerified !== false,
    syncedAt: typeof value.syncedAt === 'number' ? value.syncedAt : 0,
  }
}

async function persistServerEntitlement(storage: FlowlaryStorage, cache: ServerEntitlementCache): Promise<void> {
  await storage.set(STORAGE_KEYS.authServerEntitlement, cache, 'local')
  if (cache.plan) await storage.setPrimitive(STORAGE_KEYS.authAccountPlan, cache.plan, 'local')
}

export async function logoutAccount(storage: FlowlaryStorage): Promise<void> {
  const current = await readAccountSession(storage)
  if (current) {
    try {
      await fetch(`${FLOWLARY_API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${current.accessToken}`,
        },
        body: JSON.stringify({ session_id: current.sessionId }),
      })
    } catch {
      /* best effort */
    }
  }
  await clearAccountSession(storage)
}

export type ApiAuth = {
  install: InstallAuth
  account: AccountSession | null
  bearerToken: string
}

export async function ensureApiAuth(storage: FlowlaryStorage): Promise<ApiAuth> {
  const install = await ensureInstallAuth(storage)
  let account = await readAccountSession(storage)
  if (account && account.expiresAt <= Date.now() + 30_000) {
    account = await refreshAccountSession(storage)
  }
  const bearerToken = account?.accessToken ?? install.token
  return { install, account, bearerToken }
}

export async function syncServerEntitlement(storage: FlowlaryStorage): Promise<{
  ok: boolean
  plan?: string
  remainingMs?: number
  creditsRemaining?: number
  isPro?: boolean
}> {
  const account = await readAccountSession(storage)
  if (!account) return { ok: false }
  let token = account.accessToken
  if (account.expiresAt <= Date.now() + 30_000) {
    const refreshed = await refreshAccountSession(storage)
    if (!refreshed) return { ok: false }
    token = refreshed.accessToken
  }
  let response: Response
  try {
    response = await fetch(`${FLOWLARY_API_BASE}/api/account/entitlement`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { ok: false }
  }
  markApiHealthOk()
  if (!response.ok) return { ok: false }
  const body = (await response.json()) as {
    entitlement?: {
      plan?: string
      remainingMs?: number
      creditsRemaining?: number
      creditsUsed?: number
      dailyLimit?: number
      resetAt?: number
      monthlyCreditsUsed?: number
      monthlySoftCap?: number | null
      monthlyResetAt?: number | null
      capabilities?: string[]
      isPro?: boolean
      inTrial?: boolean
      studentProActive?: boolean
      studentProExpiresAt?: number | null
      trialEndsAt?: number | null
      billingAvailable?: boolean
      emailVerified?: boolean
      subscription?: {
        status?: string
        cancelAtPeriodEnd?: boolean
        paymentFailed?: boolean
        currentPeriodEnd?: number | null
      }
    }
  }
  const entitlement = body.entitlement
  if (!entitlement?.plan) return { ok: false }
  const creditsRemaining =
    typeof entitlement.creditsRemaining === 'number'
      ? entitlement.creditsRemaining
      : typeof entitlement.remainingMs === 'number'
        ? entitlement.remainingMs
        : 0
  await persistServerEntitlement(storage, {
    plan: entitlement.plan,
    isPro: entitlement.isPro === true,
    inTrial: entitlement.inTrial === true,
    studentProActive: entitlement.studentProActive === true,
    studentProExpiresAt:
      typeof entitlement.studentProExpiresAt === 'number' ? entitlement.studentProExpiresAt : null,
    trialEndsAt: typeof entitlement.trialEndsAt === 'number' ? entitlement.trialEndsAt : null,
    remainingMs: typeof entitlement.remainingMs === 'number' ? entitlement.remainingMs : creditsRemaining,
    creditsRemaining,
    creditsUsed: typeof entitlement.creditsUsed === 'number' ? entitlement.creditsUsed : 0,
    dailyLimit: typeof entitlement.dailyLimit === 'number' ? entitlement.dailyLimit : 0,
    resetAt: typeof entitlement.resetAt === 'number' ? entitlement.resetAt : 0,
    monthlyCreditsUsed: typeof entitlement.monthlyCreditsUsed === 'number' ? entitlement.monthlyCreditsUsed : 0,
    monthlySoftCap: typeof entitlement.monthlySoftCap === 'number' ? entitlement.monthlySoftCap : null,
    monthlyResetAt: typeof entitlement.monthlyResetAt === 'number' ? entitlement.monthlyResetAt : null,
    capabilities: Array.isArray(entitlement.capabilities) ? entitlement.capabilities : [],
    billingAvailable: entitlement.billingAvailable === true,
    subscriptionStatus: entitlement.subscription?.status ?? null,
    cancelAtPeriodEnd: entitlement.subscription?.cancelAtPeriodEnd === true,
    paymentFailed: entitlement.subscription?.paymentFailed === true,
    currentPeriodEnd:
      typeof entitlement.subscription?.currentPeriodEnd === 'number'
        ? entitlement.subscription.currentPeriodEnd
        : null,
    emailVerified: entitlement.emailVerified !== false,
    syncedAt: Date.now(),
  })
  return {
    ok: true,
    plan: entitlement.plan,
    remainingMs: entitlement.remainingMs,
    creditsRemaining,
    isPro: entitlement.isPro === true,
  }
}

const ENTITLEMENT_SYNC_TTL_MS = 5 * 60 * 1000

export async function maybeSyncServerEntitlement(storage: FlowlaryStorage): Promise<void> {
  try {
    const session = await readAccountSession(storage)
    if (!session) return
    const cache = await readServerEntitlementCache(storage)
    const now = Date.now()
    const resetBoundaryReached = Boolean(cache && cache.resetAt > 0 && cache.resetAt <= now)
    const monthlyBoundaryReached = Boolean(
      cache && cache.monthlyResetAt != null && cache.monthlyResetAt > 0 && cache.monthlyResetAt <= now,
    )
    if (
      cache &&
      !resetBoundaryReached &&
      !monthlyBoundaryReached &&
      now - cache.syncedAt < ENTITLEMENT_SYNC_TTL_MS
    ) {
      return
    }
    await syncServerEntitlement(storage)
  } catch {
    /* fail closed — keep last server cache */
  }
}
