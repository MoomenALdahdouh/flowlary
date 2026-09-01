import { ACCOUNT_TRIAL_DURATION_MS, FLOWLARY_PRODUCT_ID } from '@flowlary/shared'

/**
 * Local entitlement storage is UX / migration only.
 * Managed AI authority is the server account JWT (Phase 26/27).
 * Local trial no longer unlocks AI without sign-in.
 */
export const TRIAL_DURATION_MS = ACCOUNT_TRIAL_DURATION_MS
/** @deprecated Latency balance retired — always normalize to 0. */
export const FREE_MAX_BALANCE_MS = 0
export const LICENSE_CACHE_TTL_MS = 900 * 1000
export const USAGE_STATE_VERSION = 2

export type EntitlementStatus = 'trial' | 'free' | 'pro' | 'unknown'

export type UsageState = {
  version: number
  firstActivatedAt: number
  trialEndsAt: number
  /** @deprecated Always 0 after Phase 27 migration. */
  usageBalanceMs: number
  lastUsageUpdateAt: number
  lastActivityAt: number
  lastRefillAt: number
}

export type LicenseCache = {
  valid: boolean
  status: string
  verifiedAt: number
}

export type FlowlaryEntitlement = {
  _v: number
  product: typeof FLOWLARY_PRODUCT_ID
  status: EntitlementStatus
  usage: UsageState
  license: {
    cache: LicenseCache
    migratedFrom?: 'lingo' | 'layfix' | 'both' | 'none'
  }
}

export type EntitlementPublicView = {
  status: EntitlementStatus
  hasLicenseKey: boolean
  isPro: boolean
  inTrial: boolean
  /** @deprecated Prefer creditsRemaining from server. */
  remainingMs: number
  creditsRemaining: number
  creditsUsed: number
  dailyLimit: number
  resetAt: number
  capabilities: string[]
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function createInitialUsageState(now: number): UsageState {
  const activated = isValidTimestamp(now) ? now : 1
  return {
    version: USAGE_STATE_VERSION,
    firstActivatedAt: activated,
    trialEndsAt: activated + TRIAL_DURATION_MS,
    usageBalanceMs: 0,
    lastUsageUpdateAt: activated,
    lastActivityAt: 0,
    lastRefillAt: activated,
  }
}

export function normalizeUsageState(raw: unknown, now: number): UsageState {
  const fallback = createInitialUsageState(now)
  if (!raw || typeof raw !== 'object') return fallback
  const value = raw as Partial<UsageState>
  const firstActivatedAt = isValidTimestamp(value.firstActivatedAt) ? value.firstActivatedAt : 0
  if (!firstActivatedAt) return fallback
  const trialEndsAt = Math.min(
    isValidTimestamp(value.trialEndsAt) ? value.trialEndsAt : firstActivatedAt + TRIAL_DURATION_MS,
    firstActivatedAt + TRIAL_DURATION_MS,
  )
  return {
    version: USAGE_STATE_VERSION,
    firstActivatedAt,
    trialEndsAt,
    // Phase 27: never treat legacy latency ms as credits.
    usageBalanceMs: 0,
    lastUsageUpdateAt: isValidTimestamp(value.lastUsageUpdateAt)
      ? value.lastUsageUpdateAt
      : firstActivatedAt,
    lastActivityAt: isValidTimestamp(value.lastActivityAt) ? value.lastActivityAt : 0,
    lastRefillAt: isValidTimestamp(value.lastRefillAt) ? value.lastRefillAt : firstActivatedAt,
  }
}

export function emptyLicenseCache(): LicenseCache {
  return { valid: false, status: 'unknown', verifiedAt: 0 }
}

export function normalizeLicenseCache(raw: unknown): LicenseCache {
  if (!raw || typeof raw !== 'object') return emptyLicenseCache()
  const value = raw as Partial<LicenseCache>
  return {
    valid: value.valid === true,
    status: typeof value.status === 'string' && value.status ? value.status : 'unknown',
    verifiedAt: isValidTimestamp(value.verifiedAt) ? value.verifiedAt : 0,
  }
}

const DENIED_LICENSE_STATUSES = new Set(['cancelled', 'expired', 'payment_failed', 'paused', 'on_hold'])

export function isVerifiedPro(cache: LicenseCache, now: number, online = true): boolean {
  if (!cache.valid || !isValidTimestamp(cache.verifiedAt)) return false
  if (cache.verifiedAt > now) return false
  if (DENIED_LICENSE_STATUSES.has(cache.status.toLowerCase())) return false
  if (!online) return true
  return now - cache.verifiedAt <= LICENSE_CACHE_TTL_MS
}

export function isInTrial(usage: UsageState, now: number): boolean {
  if (!isValidTimestamp(usage.firstActivatedAt) || !isValidTimestamp(usage.trialEndsAt)) return false
  if (usage.firstActivatedAt > now) return false
  const ends = Math.min(usage.trialEndsAt, usage.firstActivatedAt + TRIAL_DURATION_MS)
  return now < ends
}

/**
 * Local status without server: never invents free AI credits.
 * Unsigned clients get `unknown` so AI UX asks for sign-in.
 */
export function resolveEntitlementStatus(
  entitlement: FlowlaryEntitlement,
  now: number,
  online = true,
): EntitlementStatus {
  if (isVerifiedPro(entitlement.license.cache, now, online)) return 'pro'
  if (isInTrial(entitlement.usage, now)) return 'trial'
  return 'unknown'
}

export function createDefaultEntitlement(now = Date.now()): FlowlaryEntitlement {
  return {
    _v: 1,
    product: FLOWLARY_PRODUCT_ID,
    status: 'unknown',
    usage: createInitialUsageState(now),
    license: { cache: emptyLicenseCache(), migratedFrom: 'none' },
  }
}

export function normalizeEntitlement(raw: unknown, now = Date.now()): FlowlaryEntitlement {
  if (!raw || typeof raw !== 'object') return createDefaultEntitlement(now)
  const value = raw as Partial<FlowlaryEntitlement>
  const usage = normalizeUsageState(value.usage, now)
  const licenseCache = normalizeLicenseCache(value.license?.cache)
  const entitlement: FlowlaryEntitlement = {
    _v: 1,
    product: FLOWLARY_PRODUCT_ID,
    status: 'unknown',
    usage,
    license: {
      cache: licenseCache,
      migratedFrom: value.license?.migratedFrom ?? 'none',
    },
  }
  entitlement.status = resolveEntitlementStatus(entitlement, now)
  return entitlement
}

/** Conservative merge: earliest trial start — never invents credits. */
export function mergeUsageStates(a: UsageState, b: UsageState): UsageState {
  const firstActivatedAt = Math.min(a.firstActivatedAt, b.firstActivatedAt)
  const trialEndsAt = Math.min(a.trialEndsAt, b.trialEndsAt, firstActivatedAt + TRIAL_DURATION_MS)
  return {
    version: USAGE_STATE_VERSION,
    firstActivatedAt,
    trialEndsAt,
    usageBalanceMs: 0,
    lastUsageUpdateAt: Math.min(a.lastUsageUpdateAt, b.lastUsageUpdateAt),
    lastActivityAt: Math.max(a.lastActivityAt, b.lastActivityAt),
    lastRefillAt: Math.min(a.lastRefillAt, b.lastRefillAt),
  }
}

export function mergeLicenseCaches(a: LicenseCache, b: LicenseCache, now: number): LicenseCache {
  const aPro = isVerifiedPro(a, now, false)
  const bPro = isVerifiedPro(b, now, false)
  if (aPro && !bPro) return a
  if (bPro && !aPro) return b
  if (a.valid && b.valid) {
    return a.verifiedAt >= b.verifiedAt ? a : b
  }
  return a.valid ? a : b.valid ? b : emptyLicenseCache()
}

export function toPublicView(
  entitlement: FlowlaryEntitlement,
  hasLicenseKey: boolean,
  now = Date.now(),
): EntitlementPublicView {
  const status = resolveEntitlementStatus(entitlement, now)
  const isPro = status === 'pro'
  const inTrial = status === 'trial'
  return {
    status,
    hasLicenseKey,
    isPro,
    inTrial,
    remainingMs: 0,
    creditsRemaining: 0,
    creditsUsed: 0,
    dailyLimit: 0,
    resetAt: 0,
    capabilities: [],
  }
}

export function canFeatureUseEntitlement(
  entitlement: FlowlaryEntitlement,
  now = Date.now(),
): boolean {
  const status = resolveEntitlementStatus(entitlement, now)
  // Local license/trial alone no longer unlocks managed AI.
  return status === 'pro'
}
