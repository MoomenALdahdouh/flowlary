import type { ServerEntitlementTier } from './entitlement.ts'

export type RateLimitTier = ServerEntitlementTier | 'trial' | 'pro'

type Bucket = {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

const LIMITS: Record<RateLimitTier, { windowMs: number; max: number }> = {
  anonymous: { windowMs: 60_000, max: 10 },
  free: { windowMs: 60_000, max: 45 },
  trial: { windowMs: 60_000, max: 60 },
  pro: { windowMs: 60_000, max: 120 },
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

export function checkAdvisorRateLimit(userId: string, maxRequestsPerMinute: number): void {
  const windowMs = 60_000
  const key = `advisor:${userId}`
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return
  }
  if (bucket.count >= maxRequestsPerMinute) {
    const err = new Error('rate_limited')
    ;(err as Error & { retryAfterMs?: number }).retryAfterMs =
      windowMs - (now - bucket.windowStart)
    throw err
  }
  bucket.count += 1
}

export function resetRateLimitsForTests(): void {
  buckets.clear()
}

const STUDENT_OPERATION_LIMITS: Record<string, { windowMs: number; max: number }> = {
  'student-verify-request': { windowMs: 24 * 60 * 60 * 1000, max: 5 },
  'student-verify-confirm': { windowMs: 60 * 1000, max: 20 },
  'student-enrollment-review': { windowMs: 24 * 60 * 60 * 1000, max: 3 },
}

export function checkStudentOperationRateLimit(accountId: string, operation: keyof typeof STUDENT_OPERATION_LIMITS): void {
  const config = STUDENT_OPERATION_LIMITS[operation]
  if (!config) return
  const key = `student:${accountId}:${operation}`
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

const FEEDBACK_OPERATION_LIMITS: Record<string, { windowMs: number; max: number }> = {
  feedback: { windowMs: 60_000, max: 20 },
  'feature-request': { windowMs: 60_000, max: 10 },
  'support-ticket': { windowMs: 60_000, max: 10 },
  'feature-vote': { windowMs: 60_000, max: 30 },
}

export function checkFeedbackOperationRateLimit(accountId: string, operation: keyof typeof FEEDBACK_OPERATION_LIMITS): void {
  const config = FEEDBACK_OPERATION_LIMITS[operation]
  if (!config) return
  const key = `feedback:${accountId}:${operation}`
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
