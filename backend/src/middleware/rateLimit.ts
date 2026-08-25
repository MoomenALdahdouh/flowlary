import type { AuthContext } from './auth.ts'

export type RateLimitTier = AuthContext['entitlement']

type Bucket = {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

const LIMITS: Record<RateLimitTier, { windowMs: number; max: number }> = {
  anonymous: { windowMs: 60_000, max: 10 },
  free: { windowMs: 60_000, max: 30 },
  trial: { windowMs: 60_000, max: 60 },
  pro: { windowMs: 60_000, max: 120 },
  byok: { windowMs: 60_000, max: 30 },
}

export function checkRateLimit(userId: string, tier: RateLimitTier, operation: string): void {
  const config = LIMITS[tier] ?? LIMITS.anonymous
  const key = `${userId}:${operation}:${tier}`
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= config.windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return
  }
  if (bucket.count >= config.max) {
    const err = new Error('rate_limited')
    ;(err as Error & { retryAfterMs?: number }).retryAfterMs = config.windowMs - (now - bucket.windowStart)
    throw err
  }
  bucket.count += 1
}

export function resetRateLimitsForTests(): void {
  buckets.clear()
}
