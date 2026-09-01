import type { FlowlaryCapability } from '../capabilities.ts'

/** Server-authoritative account plan. Pro is granted only from verified subscription state. */
export type AccountPlan = 'free' | 'trial' | 'pro'

export type AccountStatus = 'active' | 'suspended'

export type BillingEnvironment = 'sandbox' | 'production'

export type FlowlarySubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'expired'

export type BillingSubscriptionView = {
  status: FlowlarySubscriptionStatus
  plan: 'free' | 'pro'
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: number | null
  paymentFailed: boolean
  billingEnvironment: BillingEnvironment | null
}

export type ServerEntitlementView = {
  plan: AccountPlan | 'anonymous'
  status: AccountStatus | 'none'
  trialEndsAt: number | null
  allowed: boolean
  reason?: 'usage_exhausted' | 'suspended' | 'anonymous' | 'trial_expired' | 'account_required'
  /** @deprecated Prefer creditsRemaining — kept for transitional clients. */
  remainingMs: number
  creditsRemaining: number
  creditsUsed: number
  dailyLimit: number
  resetAt: number
  monthlyCreditsUsed: number
  monthlySoftCap: number | null
  monthlyResetAt: number | null
  capabilities: FlowlaryCapability[]
  inTrial: boolean
  isPro: boolean
  rateLimitTier: AccountPlan | 'anonymous'
  billingAvailable: boolean
  subscription: BillingSubscriptionView
  emailVerified: boolean
  /** Active student Pro benefit (server-verified; not paid Paddle Pro). */
  studentProActive?: boolean
  studentProExpiresAt?: number | null
}

export type AccountPublicView = {
  id: string
  email: string
  emailVerified: boolean
  plan: AccountPlan
  status: AccountStatus
  trialEndsAt: number | null
  inTrial: boolean
  isPro: boolean
  /** @deprecated Prefer creditsRemaining. */
  remainingMs: number
  creditsRemaining: number
  creditsUsed: number
  dailyLimit: number
  resetAt: number
  monthlyCreditsUsed: number
  monthlySoftCap: number | null
  monthlyResetAt: number | null
  capabilities: FlowlaryCapability[]
  billingAvailable: boolean
  subscription: BillingSubscriptionView
}

export type AuthTokenPair = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/** Phase 26: registration trial is 30 days full Pro experience. */
export const ACCOUNT_TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * @deprecated Phase 26 replaced latency balance with daily weighted credits.
 * Kept only so old stores can be migrated without inventing credit equivalence.
 */
export const ACCOUNT_FREE_BALANCE_MS = 0
