import { FLOWLARY_PRODUCT_ID } from '@flowlary/shared'

/** Entitlement constants aligned with legacy Lingo/Layfix engines. */
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000
export const FREE_MAX_BALANCE_MS = 2 * 60 * 60 * 1000
export const LICENSE_CACHE_TTL_MS = 900 * 1000
export const USAGE_STATE_VERSION = 1

export type EntitlementStatus = 'trial' | 'free' | 'pro' | 'unknown'

export type UsageState = {
  version: number
  firstActivatedAt: number
  trialEndsAt: number
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
  remainingMs: number
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function clampBalance(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return FREE_MAX_BALANCE_MS
  if (value < 0) return 0
  if (value > FREE_MAX_BALANCE_MS) return FREE_MAX_BALANCE_MS
  return Math.floor(value)
}

export function createInitialUsageState(now: number): UsageState {
  const activated = isValidTimestamp(now) ? now : 1
  return {
    version: USAGE_STATE_VERSION,
    firstActivatedAt: activated,
    trialEndsAt: activated + TRIAL_DURATION_MS,
    usageBalanceMs: FREE_MAX_BALANCE_MS,
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
    usageBalanceMs: clampBalance(value.usageBalanceMs),
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

export function resolveEntitlementStatus(
  entitlement: FlowlaryEntitlement,
  now: number,
  online = true,
): EntitlementStatus {
  if (isVerifiedPro(entitlement.license.cache, now, online)) return 'pro'
  if (isInTrial(entitlement.usage, now)) return 'trial'
  if (entitlement.usage.usageBalanceMs > 0) return 'free'
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

/** Conservative merge: earliest trial start, lowest balance — never grants extra privilege. */
export function mergeUsageStates(a: UsageState, b: UsageState): UsageState {
  const firstActivatedAt = Math.min(a.firstActivatedAt, b.firstActivatedAt)
  const trialEndsAt = Math.min(a.trialEndsAt, b.trialEndsAt, firstActivatedAt + TRIAL_DURATION_MS)
  return {
    version: USAGE_STATE_VERSION,
    firstActivatedAt,
    trialEndsAt,
    usageBalanceMs: Math.min(a.usageBalanceMs, b.usageBalanceMs),
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
    remainingMs: entitlement.usage.usageBalanceMs,
  }
}

export function canFeatureUseEntitlement(
  entitlement: FlowlaryEntitlement,
  now = Date.now(),
): boolean {
  const status = resolveEntitlementStatus(entitlement, now)
  return status === 'pro' || status === 'trial' || status === 'free'
}
