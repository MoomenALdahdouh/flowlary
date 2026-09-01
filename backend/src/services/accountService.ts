import { randomUUID } from 'node:crypto'
import {
  ACCOUNT_TRIAL_DURATION_MS,
  FREE_DAILY_CREDITS,
  PRO_DAILY_CREDITS,
  PRO_MONTHLY_SOFT_CAP,
  capabilitiesForPlan,
  capabilitiesToArray,
  creditWeightForOperation,
  dailyLimitForPlan,
  nextUtcMidnightMs,
  nextUtcMonthMs,
  utcDayKey,
  utcMonthKey,
  type AccountPlan,
  type AccountPublicView,
  type AuthTokenPair,
  type ServerEntitlementView,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { GatewayError } from '../gateway/errors.ts'
import { getAccountBillingView } from '../billing/index.ts'
import { subscriptionGrantsPro } from '../billing/subscriptionMap.ts'
import { getActiveStudentBenefit } from './studentVerificationService.ts'
import {
  appendUsage,
  createAccount,
  createSession,
  deleteSession,
  deleteSessionsForAccount,
  findAccountByEmail,
  findAccountById,
  findSessionById,
  findSubscriptionByAccountId,
  linkInstallToAccount,
  summarizeUsageForAccount,
  updateAccount,
  type AccountRecord,
} from '../db/store.ts'
import {
  createRefreshToken,
  hashOpaqueToken,
  hashPassword,
  signAccessToken,
  verifyPassword,
  verifyRefreshTokenHash,
} from './crypto.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ACCESS_TTL_SEC = 15 * 60
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000
const UNLIMITED_TEST_CREDITS = 999_999

function unlimitedTestEmailSet(): Set<string> {
  return new Set(
    (process.env.FLOWLARY_UNLIMITED_TEST_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isUnlimitedTestAccount(account: AccountRecord): boolean {
  return unlimitedTestEmailSet().has(account.email.trim().toLowerCase())
}

type UsageReservation = {
  id: string
  accountId: string
  weight: number
  monthlyWeight: number
}

const activeUsageReservations = new Map<string, UsageReservation>()

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validateEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email) && email.length <= 254
}

export function validatePassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128
}

function issueTokens(config: AppConfig, account: AccountRecord, sessionId: string): AuthTokenPair {
  const accessToken = signAccessToken(
    { sub: account.id, sid: sessionId, email: account.email },
    config.jwtSecret,
    ACCESS_TTL_SEC,
  )
  const refreshToken = createRefreshToken()
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC }
}

/** Ensure daily/monthly windows are current; mutate account in memory (caller persists). */
export function refreshCreditWindows(account: AccountRecord, now = Date.now()): AccountRecord {
  const day = utcDayKey(now)
  const month = utcMonthKey(now)
  if (account.dailyCreditsDayKey !== day) {
    account.dailyCreditsUsed = 0
    account.dailyCreditsDayKey = day
  }
  if (account.monthlyCreditsMonthKey !== month) {
    account.monthlyCreditsUsed = 0
    account.monthlyCreditsMonthKey = month
  }
  return account
}

function emptyUsageFields(now = Date.now()) {
  return {
    usageBalanceMs: 0,
    dailyCreditsUsed: 0,
    dailyCreditsDayKey: utcDayKey(now),
    monthlyCreditsUsed: 0,
    monthlyCreditsMonthKey: utcMonthKey(now),
  }
}

function buildUsageFields(account: AccountRecord, plan: AccountPlan | 'anonymous', now: number) {
  refreshCreditWindows(account, now)
  if (isUnlimitedTestAccount(account)) {
    return {
      creditsRemaining: UNLIMITED_TEST_CREDITS,
      creditsUsed: 0,
      dailyLimit: UNLIMITED_TEST_CREDITS,
      resetAt: nextUtcMidnightMs(now),
      monthlyCreditsUsed: 0,
      monthlySoftCap: null,
      monthlyResetAt: null,
      remainingMs: UNLIMITED_TEST_CREDITS,
    }
  }
  const dailyLimit = dailyLimitForPlan(plan === 'anonymous' ? 'free' : plan)
  const creditsUsed = account.dailyCreditsUsed
  const creditsRemaining = Math.max(0, dailyLimit - creditsUsed)

  const isProLike = plan === 'pro' || plan === 'trial'
  const monthlySoftCap = isProLike ? PRO_MONTHLY_SOFT_CAP : null
  const monthlyCreditsUsed = isProLike ? account.monthlyCreditsUsed : 0
  const monthlyResetAt = isProLike ? nextUtcMonthMs(now) : null

  // Pro soft monthly can further reduce remaining
  let effectiveRemaining = creditsRemaining
  if (monthlySoftCap != null) {
    const monthlyLeft = Math.max(0, monthlySoftCap - monthlyCreditsUsed)
    effectiveRemaining = Math.min(effectiveRemaining, monthlyLeft)
  }

  return {
    creditsRemaining: effectiveRemaining,
    creditsUsed,
    dailyLimit,
    resetAt: nextUtcMidnightMs(now),
    monthlyCreditsUsed,
    monthlySoftCap,
    monthlyResetAt,
    /** Transitional: map remaining credits to a non-ms semantic for old clients (0 or 1). */
    remainingMs: effectiveRemaining > 0 ? effectiveRemaining : 0,
  }
}

export function toAccountPublicView(account: AccountRecord, now = Date.now()): AccountPublicView {
  const entitlement = resolveServerEntitlementForAccount(account, now)
  return {
    id: account.id,
    email: account.email,
    emailVerified: account.emailVerified,
    plan: entitlement.plan === 'anonymous' ? account.plan : entitlement.plan,
    status: account.status,
    trialEndsAt: account.trialEndsAt,
    inTrial: entitlement.inTrial,
    isPro: entitlement.isPro,
    remainingMs: entitlement.remainingMs,
    creditsRemaining: entitlement.creditsRemaining,
    creditsUsed: entitlement.creditsUsed,
    dailyLimit: entitlement.dailyLimit,
    resetAt: entitlement.resetAt,
    monthlyCreditsUsed: entitlement.monthlyCreditsUsed,
    monthlySoftCap: entitlement.monthlySoftCap,
    monthlyResetAt: entitlement.monthlyResetAt,
    capabilities: entitlement.capabilities,
    billingAvailable: entitlement.billingAvailable,
    subscription: entitlement.subscription,
  }
}

export function resolveServerEntitlementForAccount(
  account: AccountRecord,
  now = Date.now(),
): ServerEntitlementView {
  refreshCreditWindows(account, now)
  const subscription = findSubscriptionByAccountId(account.id)
  const billingView = getAccountBillingView(account.id, now)
  const billingAvailable = Boolean(subscription)

  if (isUnlimitedTestAccount(account)) {
    const usage = buildUsageFields(account, 'pro', now)
    return {
      plan: 'pro',
      status: account.status,
      trialEndsAt: account.trialEndsAt,
      allowed: true,
      ...usage,
      capabilities: capabilitiesToArray(
        capabilitiesForPlan('pro', { creditsRemaining: UNLIMITED_TEST_CREDITS }),
      ),
      inTrial: false,
      isPro: true,
      rateLimitTier: 'pro',
      billingAvailable: Boolean(subscription),
      subscription: billingView,
      emailVerified: account.emailVerified,
    }
  }

  if (account.status === 'suspended') {
    const usage = buildUsageFields(account, 'anonymous', now)
    return {
      plan: account.plan,
      status: 'suspended',
      trialEndsAt: account.trialEndsAt,
      allowed: false,
      reason: 'suspended',
      ...usage,
      capabilities: capabilitiesToArray(
        capabilitiesForPlan('anonymous', { suspended: true, creditsRemaining: 0 }),
      ),
      inTrial: false,
      isPro: false,
      rateLimitTier: 'anonymous',
      billingAvailable,
      subscription: billingView,
      emailVerified: account.emailVerified,
    }
  }

  if (subscription) {
    if (subscriptionGrantsPro(subscription, now)) {
      if (account.plan !== 'pro') {
        account.plan = 'pro'
        updateAccount(account)
      }
      const usage = buildUsageFields(account, 'pro', now)
      const caps = capabilitiesToArray(
        capabilitiesForPlan('pro', { creditsRemaining: usage.creditsRemaining }),
      )
      return {
        plan: 'pro',
        status: account.status,
        trialEndsAt: account.trialEndsAt,
        allowed: usage.creditsRemaining > 0,
        reason: usage.creditsRemaining > 0 ? undefined : 'usage_exhausted',
        ...usage,
        capabilities: caps,
        inTrial: false,
        isPro: true,
        rateLimitTier: 'pro',
        billingAvailable: true,
        subscription: billingView,
      emailVerified: account.emailVerified,
      }
    }
    if (account.plan === 'pro') {
      account.plan = 'free'
      updateAccount(account)
    }
  }

  if (account.plan === 'trial' && (account.trialEndsAt ?? 0) <= now) {
    account.plan = 'free'
    updateAccount(account)
  }

  const inTrial = account.plan === 'trial' && (account.trialEndsAt ?? 0) > now

  const studentBenefit = getActiveStudentBenefit(account.id, now)
  if (studentBenefit) {
    const usage = buildUsageFields(account, 'pro', now)
    return {
      plan: inTrial ? 'trial' : account.plan === 'pro' ? 'free' : account.plan,
      status: account.status,
      trialEndsAt: account.trialEndsAt,
      allowed: usage.creditsRemaining > 0,
      reason: usage.creditsRemaining > 0 ? undefined : 'usage_exhausted',
      ...usage,
      capabilities: capabilitiesToArray(
        capabilitiesForPlan('pro', { creditsRemaining: usage.creditsRemaining }),
      ),
      inTrial,
      isPro: false,
      studentProActive: true,
      studentProExpiresAt: studentBenefit.expiresAt,
      rateLimitTier: 'pro',
      billingAvailable,
      subscription: billingView,
      emailVerified: account.emailVerified,
    }
  }

  if (account.plan === 'pro') {
    const usage = buildUsageFields(account, 'pro', now)
    return {
      plan: 'pro',
      status: account.status,
      trialEndsAt: account.trialEndsAt,
      allowed: usage.creditsRemaining > 0,
      reason: usage.creditsRemaining > 0 ? undefined : 'usage_exhausted',
      ...usage,
      capabilities: capabilitiesToArray(
        capabilitiesForPlan('pro', { creditsRemaining: usage.creditsRemaining }),
      ),
      inTrial: false,
      isPro: true,
      rateLimitTier: 'pro',
      billingAvailable,
      subscription: billingView,
      emailVerified: account.emailVerified,
    }
  }

  if (inTrial) {
    // Trial = full Pro experience (Phase 26) — usage is credit-based, not a clock.
    const usage = buildUsageFields(account, 'trial', now)
    return {
      plan: 'trial',
      status: account.status,
      trialEndsAt: account.trialEndsAt,
      allowed: usage.creditsRemaining > 0,
      reason: usage.creditsRemaining > 0 ? undefined : 'usage_exhausted',
      ...usage,
      capabilities: capabilitiesToArray(
        capabilitiesForPlan('trial', { creditsRemaining: usage.creditsRemaining }),
      ),
      inTrial: true,
      isPro: false,
      rateLimitTier: 'trial',
      billingAvailable,
      subscription: billingView,
      emailVerified: account.emailVerified,
    }
  }

  const usage = buildUsageFields(account, 'free', now)
  if (usage.creditsRemaining <= 0) {
    return {
      plan: 'free',
      status: account.status,
      trialEndsAt: account.trialEndsAt,
      allowed: false,
      reason: 'usage_exhausted',
      ...usage,
      capabilities: capabilitiesToArray(
        capabilitiesForPlan('free', { creditsRemaining: 0 }),
      ),
      inTrial: false,
      isPro: false,
      rateLimitTier: 'free',
      billingAvailable,
      subscription: billingView,
      emailVerified: account.emailVerified,
    }
  }

  return {
    plan: 'free',
    status: account.status,
    trialEndsAt: account.trialEndsAt,
    allowed: true,
    ...usage,
    capabilities: capabilitiesToArray(
      capabilitiesForPlan('free', { creditsRemaining: usage.creditsRemaining }),
    ),
    inTrial: false,
    isPro: false,
    rateLimitTier: 'free',
    billingAvailable,
    subscription: billingView,
    emailVerified: account.emailVerified,
  }
}

export function registerAccount(
  config: AppConfig,
  email: string,
  password: string,
  installId?: string,
): { account: AccountPublicView; tokens: AuthTokenPair; sessionId: string } {
  const normalized = normalizeEmail(email)
  if (!validateEmail(normalized)) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Invalid email', 400, 'register')
  }
  if (!validatePassword(password)) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Invalid password', 400, 'register')
  }
  if (findAccountByEmail(normalized)) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Email already registered', 409, 'register')
  }

  const now = Date.now()
  const account = createAccount({
    email: normalized,
    passwordHash: hashPassword(password),
    plan: 'trial',
    status: 'active',
    trialEndsAt: now + ACCOUNT_TRIAL_DURATION_MS,
    emailVerified: false,
    emailVerifiedAt: null,
    ...emptyUsageFields(now),
  })

  return issueAdditionalSession(config, account.id, installId)
}

/**
 * Issue a new refresh session for an already-authenticated account.
 * Does not invalidate other sessions (website and extension must not share tokens).
 */
export function issueAdditionalSession(
  config: AppConfig,
  accountId: string,
  installId?: string,
): { account: AccountPublicView; tokens: AuthTokenPair; sessionId: string } {
  const account = findAccountById(accountId)
  if (!account) {
    throw new GatewayError('AI_AUTH_FAILED', 'Account not found', 401, 'session')
  }
  if (installId) linkInstallToAccount(installId, account.id)

  const now = Date.now()
  const refreshToken = createRefreshToken()
  const session = createSession({
    accountId: account.id,
    refreshTokenHash: hashOpaqueToken(refreshToken, config.jwtSecret),
    expiresAt: now + REFRESH_TTL_MS,
  })
  const tokens = issueTokens(config, account, session.id)
  tokens.refreshToken = refreshToken
  return { account: toAccountPublicView(account, now), tokens, sessionId: session.id }
}

export function loginAccount(
  config: AppConfig,
  email: string,
  password: string,
  installId?: string,
): { account: AccountPublicView; tokens: AuthTokenPair; sessionId: string } {
  const account = findAccountByEmail(normalizeEmail(email))
  if (!account || !verifyPassword(password, account.passwordHash)) {
    throw new GatewayError('AI_AUTH_FAILED', 'Invalid credentials', 401, 'login')
  }
  return issueAdditionalSession(config, account.id, installId)
}

export function refreshAccountSession(
  config: AppConfig,
  refreshToken: string,
  sessionId: string,
): { account: AccountPublicView; tokens: AuthTokenPair; sessionId: string } {
  const session = findSessionById(sessionId)
  if (!session || session.expiresAt < Date.now()) {
    throw new GatewayError('AI_AUTH_FAILED', 'Session expired', 401, 'refresh')
  }
  if (!verifyRefreshTokenHash(refreshToken, session.refreshTokenHash, config.jwtSecret)) {
    throw new GatewayError('AI_AUTH_FAILED', 'Invalid refresh token', 401, 'refresh')
  }
  const account = findAccountById(session.accountId)
  if (!account) {
    throw new GatewayError('AI_AUTH_FAILED', 'Account not found', 401, 'refresh')
  }

  deleteSession(session.id)
  const nextRefresh = createRefreshToken()
  const nextSession = createSession({
    accountId: account.id,
    refreshTokenHash: hashOpaqueToken(nextRefresh, config.jwtSecret),
    expiresAt: Date.now() + REFRESH_TTL_MS,
  })
  const tokens = issueTokens(config, account, nextSession.id)
  tokens.refreshToken = nextRefresh
  return { account: toAccountPublicView(account), tokens, sessionId: nextSession.id }
}

export function logoutSession(sessionId: string): void {
  deleteSession(sessionId)
}

export function logoutAccount(accountId: string): void {
  deleteSessionsForAccount(accountId)
}

export function getAccountEntitlement(accountId: string): ServerEntitlementView {
  const account = findAccountById(accountId)
  if (!account) {
    return {
      plan: 'anonymous',
      status: 'none',
      trialEndsAt: null,
      allowed: false,
      reason: 'anonymous',
      remainingMs: 0,
      creditsRemaining: 0,
      creditsUsed: 0,
      dailyLimit: 0,
      resetAt: nextUtcMidnightMs(),
      monthlyCreditsUsed: 0,
      monthlySoftCap: null,
      monthlyResetAt: null,
      capabilities: capabilitiesToArray(capabilitiesForPlan('anonymous')),
      inTrial: false,
      isPro: false,
      rateLimitTier: 'anonymous',
      billingAvailable: false,
      emailVerified: false,
      subscription: getAccountBillingView(''),
    }
  }
  return resolveServerEntitlementForAccount(account)
}

function reserveUsageAgainstAccount(input: {
  accountId: string
  operation: 'correction' | 'translation' | 'layout-classification' | 'hypothesis-advisor' | 'writing-review'
  mode?: string | null
  now?: number
}): UsageReservation {
  const account = findAccountById(input.accountId)
  if (!account) {
    throw new GatewayError('AI_AUTH_FAILED', 'Account not found', 401, 'quota')
  }

  const now = input.now ?? Date.now()
  refreshCreditWindows(account, now)

  if (isUnlimitedTestAccount(account)) {
    const reservation: UsageReservation = {
      id: randomUUID(),
      accountId: account.id,
      weight: 0,
      monthlyWeight: 0,
    }
    activeUsageReservations.set(reservation.id, reservation)
    return reservation
  }

  const subscription = findSubscriptionByAccountId(account.id)
  const isPro = subscriptionGrantsPro(subscription, now) || account.plan === 'pro'
  const inTrial = account.plan === 'trial' && (account.trialEndsAt ?? 0) > now && !isPro
  const plan: AccountPlan = isPro ? 'pro' : inTrial ? 'trial' : 'free'
  const weight = creditWeightForOperation(input.operation, input.mode)
  const dailyLimit = dailyLimitForPlan(plan)
  const nextDailyUsed = account.dailyCreditsUsed + weight
  if (dailyLimit <= 0 || nextDailyUsed > dailyLimit) {
    throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Daily AI limit reached', 403, 'quota')
  }

  const monthlyWeight = plan === 'pro' || plan === 'trial' ? weight : 0
  if (monthlyWeight > 0 && account.monthlyCreditsUsed + monthlyWeight > PRO_MONTHLY_SOFT_CAP) {
    throw new GatewayError('AI_ENTITLEMENT_DENIED', 'Monthly AI limit reached', 403, 'quota')
  }

  account.dailyCreditsUsed = nextDailyUsed
  if (monthlyWeight > 0) account.monthlyCreditsUsed += monthlyWeight
  updateAccount(account)

  const reservation: UsageReservation = {
    id: randomUUID(),
    accountId: account.id,
    weight,
    monthlyWeight,
  }
  activeUsageReservations.set(reservation.id, reservation)
  return reservation
}

export function reserveManagedUsage(input: {
  accountId: string | null
  operation: 'correction' | 'translation' | 'layout-classification' | 'hypothesis-advisor' | 'writing-review'
  mode?: string | null
  now?: number
}): UsageReservation | null {
  if (!input.accountId) return null
  return reserveUsageAgainstAccount(input as {
    accountId: string
    operation: 'correction' | 'translation' | 'layout-classification' | 'hypothesis-advisor' | 'writing-review'
    mode?: string | null
    now?: number
  })
}

export function finalizeManagedUsageReservation(reservationId: string | null | undefined): void {
  if (!reservationId) return
  activeUsageReservations.delete(reservationId)
}

export function releaseManagedUsageReservation(reservationId: string | null | undefined): void {
  if (!reservationId) return
  const reservation = activeUsageReservations.get(reservationId)
  if (!reservation) return
  activeUsageReservations.delete(reservationId)
  const account = findAccountById(reservation.accountId)
  if (!account) return
  refreshCreditWindows(account)
  account.dailyCreditsUsed = Math.max(0, account.dailyCreditsUsed - reservation.weight)
  if (reservation.monthlyWeight > 0) {
    account.monthlyCreditsUsed = Math.max(0, account.monthlyCreditsUsed - reservation.monthlyWeight)
  }
  updateAccount(account)
}

export function recordManagedUsage(input: {
  accountId: string | null
  userId: string
  operation: 'correction' | 'translation' | 'layout-classification' | 'hypothesis-advisor' | 'writing-review'
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  status: 'success' | 'failure'
  latencyMs: number
  requestId: string
  plan?: AccountPlan | 'anonymous'
  mode?: string | null
}): void {
  const weight =
    input.status === 'success'
      ? creditWeightForOperation(input.operation, input.mode)
      : 0

  appendUsage({
    accountId: input.accountId,
    userId: input.userId,
    operation: input.operation,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.totalTokens,
    status: input.status,
    latencyMs: input.latencyMs,
    creditsCharged: weight || undefined,
    mode: input.mode ?? null,
    requestId: input.requestId,
    createdAt: Date.now(),
    plan: input.plan,
  })
}

export function getAccountUsageSummary(accountId: string) {
  return summarizeUsageForAccount(accountId)
}

/** Server-only: elevate plan (no self-service pro). */
export function setAccountPlan(accountId: string, plan: AccountPlan): AccountRecord | null {
  const account = findAccountById(accountId)
  if (!account) return null
  account.plan = plan
  if (plan === 'trial' && !account.trialEndsAt) {
    account.trialEndsAt = Date.now() + ACCOUNT_TRIAL_DURATION_MS
  }
  return updateAccount(account)
}

export function resetAccountServicesForTests(): void {
  activeUsageReservations.clear()
}

export function markAccountEmailVerifiedForTests(accountId: string): void {
  const account = findAccountById(accountId)
  if (!account) return
  account.emailVerified = true
  account.emailVerifiedAt = Date.now()
  updateAccount(account)
}

/** Expose for tests and gateway pre-checks. */
export { FREE_DAILY_CREDITS, PRO_DAILY_CREDITS, PRO_MONTHLY_SOFT_CAP }
