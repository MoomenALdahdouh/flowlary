/**
 * Phase 26 — daily weighted AI credits (server-authoritative).
 * Source of truth: docs/monetization/PHASE26_FINAL_* .
 */

export type AiCreditOperation =
  | 'correction'
  | 'translation'
  | 'live-translation'
  | 'layout-classification'
  | 'hypothesis-advisor'
  | 'writing-review'
  | 'practice'

/** Weighted cost per successful AI operation. */
export const AI_CREDIT_WEIGHTS: Record<AiCreditOperation, number> = {
  correction: 1,
  'layout-classification': 1,
  'hypothesis-advisor': 1,
  'writing-review': 1,
  practice: 1,
  translation: 2,
  'live-translation': 2,
}

/** Free plan hard daily allowance (acquisition-first). */
export const FREE_DAILY_CREDITS = 500

/**
 * Trial/Pro high everyday daily allowance (abuse burst guard).
 * Soft monthly cap for Pro is the primary long-window guard.
 */
export const PRO_DAILY_CREDITS = 1000

/** Trial uses the same daily AI allowance as Pro during the trial window. */
export const TRIAL_DAILY_CREDITS = PRO_DAILY_CREDITS

/**
 * Pro soft monthly protection — coherent with 1,000/day (full daily use every day of a month).
 */
export const PRO_MONTHLY_SOFT_CAP = 30_000

/** Low-credit UX threshold (remaining ≤ this → soft warning). ~10% of Free daily. */
export const LOW_CREDITS_THRESHOLD = 50

/** Near monthly-limit UX threshold for Pro (~10% of monthly soft cap). */
export const PRO_MONTHLY_NEAR_THRESHOLD = 3000

export function creditWeightForOperation(
  operation: 'correction' | 'translation' | 'layout-classification' | 'hypothesis-advisor' | 'writing-review',
  mode?: string | null,
): number {
  if (operation === 'translation' && mode === 'explanation-localize') {
    return 1
  }
  if (operation === 'translation' && mode === 'live') {
    return AI_CREDIT_WEIGHTS['live-translation']
  }
  if (operation === 'correction' && mode === 'practice') {
    return AI_CREDIT_WEIGHTS.practice
  }
  if (operation === 'correction') return AI_CREDIT_WEIGHTS.correction
  if (operation === 'translation') return AI_CREDIT_WEIGHTS.translation
  if (operation === 'hypothesis-advisor') return AI_CREDIT_WEIGHTS['hypothesis-advisor']
  if (operation === 'writing-review') return AI_CREDIT_WEIGHTS['writing-review']
  return AI_CREDIT_WEIGHTS['layout-classification']
}

/** UTC calendar day key YYYY-MM-DD. */
export function utcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

/** UTC calendar month key YYYY-MM. */
export function utcMonthKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7)
}

/** Next UTC midnight after `now`. */
export function nextUtcMidnightMs(now = Date.now()): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0)
}

/** Start of next UTC month after `now`. */
export function nextUtcMonthMs(now = Date.now()): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0)
}

export type UsageSnapshot = {
  creditsRemaining: number
  creditsUsed: number
  dailyLimit: number
  resetAt: number
  monthlyCreditsUsed: number
  monthlySoftCap: number | null
  monthlyResetAt: number | null
}

export function formatCreditsRemaining(remaining: number, limit: number): string {
  const left = Math.max(0, Math.floor(remaining))
  const max = Math.max(0, Math.floor(limit))
  return `${left} / ${max}`
}

export function formatResetCountdown(resetAt: number, now = Date.now()): string {
  const ms = Math.max(0, resetAt - now)
  if (ms <= 0) return 'soon'
  const totalMinutes = Math.ceil(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 48) {
    const days = Math.floor(hours / 24)
    return `${days}d`
  }
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}
