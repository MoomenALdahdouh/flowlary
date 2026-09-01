/**
 * Phase 29B — canonical AI usage UX states.
 * Entitlement/credits remain Phase 29A server truth; this module is display only.
 */

import {
  FREE_DAILY_CREDITS,
  LOW_CREDITS_THRESHOLD,
  PRO_MONTHLY_NEAR_THRESHOLD,
  formatCreditsRemaining,
  formatResetCountdown,
} from './credits.ts'

export type AiUsageUxState =
  | 'AI_USAGE_HEALTHY'
  | 'AI_USAGE_LOW'
  | 'AI_USAGE_EXHAUSTED'
  | 'AI_TRIAL_ACTIVE'
  | 'AI_TRIAL_ENDING'
  | 'AI_TRIAL_EXPIRED'
  | 'AI_PRO_ACTIVE'
  | 'AI_PRO_SOFT_LIMIT'
  | 'AI_TEMPORARILY_UNAVAILABLE'
  | 'ACCOUNT_REQUIRED'
  | 'BILLING_ATTENTION'

export type UsageUxTone = 'ok' | 'warn' | 'muted' | 'info'

export type UsageUxPrimaryCta =
  | 'none'
  | 'upgrade'
  | 'sign_in'
  | 'manage_billing'
  | 'view_usage'
  | 'keep_writing'

export type UsageUxSecondaryCta =
  | 'none'
  | 'keep_using'
  | 'compare_plans'
  | 'continue_local'
  | 'view_plan'

/** Trial ending reminder window (days remaining inclusive). */
export const TRIAL_ENDING_DAYS = 3

/** How long after a contextual exhaustion prompt we suppress a duplicate prompt. */
export const UPGRADE_PROMPT_SUPPRESS_MS = 30 * 60 * 1000

/** How long a recently-expired trial transition message remains relevant. */
export const TRIAL_EXPIRED_NOTICE_MS = 7 * 24 * 60 * 60 * 1000

export type UsageUxInput = {
  signedIn: boolean
  apiHealth?: 'ok' | 'offline' | 'unknown'
  isPro: boolean
  inTrial: boolean
  trialEndsAt?: number | null
  plan?: string | null
  creditsRemaining: number
  creditsUsed?: number
  dailyLimit: number
  resetAt: number
  monthlyCreditsUsed?: number
  monthlySoftCap?: number | null
  paymentFailed?: boolean
  subscriptionStatus?: string | null
  billingAvailable?: boolean
  now?: number
}

export type UsageUxView = {
  state: AiUsageUxState
  tone: UsageUxTone
  title: string
  description: string
  planLabel: string
  assistsLabel: string | null
  resetLabel: string | null
  trialDaysRemaining: number | null
  progressPercent: number | null
  primaryCta: UsageUxPrimaryCta
  secondaryCta: UsageUxSecondaryCta
  showUpgrade: boolean
  localToolsNote: string | null
  /** Compact one-line status for popup footers / strips. */
  compactLine: string
}

export function daysRemainingUntil(endsAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endsAt - now) / (24 * 60 * 60 * 1000)))
}

export function creditsRemainingLabel(remaining: number): string {
  const left = Math.max(0, Math.floor(remaining))
  return left === 1
    ? '1 AI writing check remaining today'
    : `${left} AI writing checks remaining today`
}

/** @deprecated Use creditsRemainingLabel */
export function assistsRemainingLabel(remaining: number): string {
  return creditsRemainingLabel(remaining)
}

export function resolveUsageUx(input: UsageUxInput): UsageUxView {
  const now = input.now ?? Date.now()
  const dailyLimit = input.dailyLimit > 0 ? input.dailyLimit : FREE_DAILY_CREDITS
  const remaining = Math.max(0, Math.floor(input.creditsRemaining))
  const resetLabel =
    input.resetAt > 0 ? `Resets in ${formatResetCountdown(input.resetAt, now)}` : null
  const progressPercent =
    dailyLimit > 0 ? Math.max(0, Math.min(100, Math.round((remaining / dailyLimit) * 100))) : null

  if (!input.signedIn) {
    return {
      state: 'ACCOUNT_REQUIRED',
      tone: 'info',
      title: 'Sign in to use Flowlary AI',
      description: 'Your local tools remain available without an account.',
      planLabel: 'Local',
      assistsLabel: null,
      resetLabel: null,
      trialDaysRemaining: null,
      progressPercent: null,
      primaryCta: 'sign_in',
      secondaryCta: 'continue_local',
      showUpgrade: false,
      localToolsNote: 'Keyboard Layout Repair and Speed Box stay free.',
      compactLine: 'Sign in for Flowlary AI',
    }
  }

  if (input.apiHealth === 'offline') {
    return {
      state: 'AI_TEMPORARILY_UNAVAILABLE',
      tone: 'warn',
      title: 'AI is temporarily unavailable.',
      description: 'Try again in a moment. Local tools still work.',
      planLabel: planLabelFor(input),
      assistsLabel: null,
      resetLabel: null,
      trialDaysRemaining: null,
      progressPercent: null,
      primaryCta: 'none',
      secondaryCta: 'keep_using',
      showUpgrade: false,
      localToolsNote: 'Local features remain available.',
      compactLine: 'AI is temporarily unavailable.',
    }
  }

  if (input.paymentFailed || input.subscriptionStatus === 'past_due') {
    return {
      state: 'BILLING_ATTENTION',
      tone: 'warn',
      title: 'Your subscription needs attention',
      description:
        'Your current access remains available according to your billing status while payment is retried.',
      planLabel: input.isPro ? 'Pro' : planLabelFor(input),
      assistsLabel: null,
      resetLabel: null,
      trialDaysRemaining: null,
      progressPercent: null,
      primaryCta: 'manage_billing',
      secondaryCta: 'view_plan',
      showUpgrade: false,
      localToolsNote: null,
      compactLine: 'Subscription needs attention',
    }
  }

  if (input.isPro) {
    const monthlySoftCap = input.monthlySoftCap ?? null
    const monthlyUsed = input.monthlyCreditsUsed ?? 0
    const monthlyLeft =
      monthlySoftCap != null ? Math.max(0, monthlySoftCap - monthlyUsed) : null
    const nearMonthly =
      monthlyLeft != null && monthlyLeft <= PRO_MONTHLY_NEAR_THRESHOLD
    const dailyExhausted = remaining <= 0

    if (nearMonthly || dailyExhausted) {
      return {
        state: 'AI_PRO_SOFT_LIMIT',
        tone: 'warn',
        title: dailyExhausted
          ? "You're approaching today's AI safety limit"
          : "You're approaching your AI safety limit",
        description:
          'AI access will become available again after the current limit window resets.',
        planLabel: 'Pro',
        assistsLabel: dailyExhausted ? 'AI safety limit reached for now' : creditsRemainingLabel(remaining),
        resetLabel,
        trialDaysRemaining: null,
        progressPercent,
        primaryCta: 'view_usage',
        secondaryCta: 'none',
        showUpgrade: false,
        localToolsNote: 'Local tools remain available.',
        compactLine: resetLabel
          ? `Pro · safety limit · ${resetLabel.toLowerCase()}`
          : 'Pro · safety limit',
      }
    }

    return {
      state: 'AI_PRO_ACTIVE',
      tone: 'ok',
      title: 'Pro',
      description: 'Higher everyday AI limits for writing and learning.',
      planLabel: 'Pro',
      assistsLabel: 'AI available for everyday use',
      resetLabel,
      trialDaysRemaining: null,
      progressPercent,
      primaryCta: 'keep_writing',
      secondaryCta: 'none',
      showUpgrade: false,
      localToolsNote: null,
      compactLine: 'Pro · Flowlary AI ready',
    }
  }

  if (input.inTrial) {
    const endsAt = input.trialEndsAt ?? 0
    const days = endsAt > now ? daysRemainingUntil(endsAt, now) : null
    const ending = days != null && days <= TRIAL_ENDING_DAYS

    if (ending) {
      return {
        state: 'AI_TRIAL_ENDING',
        tone: 'info',
        title:
          days === 1
            ? 'Your Flowlary trial ends in 1 day'
            : `Your Flowlary trial ends in ${days} days`,
        description:
          "After your trial, you'll continue with daily AI writing checks and free local tools.",
        planLabel: 'Trial',
        assistsLabel: 'Full Flowlary access',
        resetLabel: null,
        trialDaysRemaining: days,
        progressPercent: null,
        primaryCta: 'upgrade',
        secondaryCta: 'view_plan',
        showUpgrade: true,
        localToolsNote: null,
        compactLine:
          days === 1 ? 'Trial · 1 day remaining' : `Trial · ${days} days remaining`,
      }
    }

    return {
      state: 'AI_TRIAL_ACTIVE',
      tone: 'ok',
      title: 'Trial',
      description: 'Full Flowlary access during your trial.',
      planLabel: 'Trial',
      assistsLabel: 'AI available',
      resetLabel: null,
      trialDaysRemaining: days,
      progressPercent: null,
      primaryCta: 'keep_writing',
      secondaryCta: 'view_plan',
      showUpgrade: false,
      localToolsNote: null,
      compactLine:
        days == null
          ? 'Trial · Full access'
          : days === 1
            ? 'Trial · 1 day remaining'
            : `Trial · ${days} days remaining`,
    }
  }

  const trialEndsAt = input.trialEndsAt ?? 0
  if (
    trialEndsAt > 0 &&
    trialEndsAt <= now &&
    now - trialEndsAt <= TRIAL_EXPIRED_NOTICE_MS
  ) {
    return {
      state: 'AI_TRIAL_EXPIRED',
      tone: 'info',
      title: 'Your Flowlary trial has ended',
      description:
        "You're now on Free. Your free local tools remain available, and AI continues with your daily Free allowance.",
      planLabel: 'Free',
      assistsLabel: creditsRemainingLabel(remaining),
      resetLabel,
      trialDaysRemaining: 0,
      progressPercent,
      primaryCta: 'upgrade',
      secondaryCta: 'keep_using',
      showUpgrade: true,
      localToolsNote: 'Keyboard Layout Repair and Speed Box remain available.',
      compactLine: remaining > 0
        ? `Free · ${formatCreditsRemaining(remaining, dailyLimit)} today`
        : 'Free · Trial ended',
    }
  }

  if (remaining <= 0) {
    return {
      state: 'AI_USAGE_EXHAUSTED',
      tone: 'warn',
      title: "You've used today's AI writing checks",
      description: resetLabel
        ? `AI checks ${resetLabel.toLowerCase()}.`
        : 'AI checks reset tomorrow.',
      planLabel: 'Free',
      assistsLabel: '0 AI writing checks remaining today',
      resetLabel,
      trialDaysRemaining: null,
      progressPercent: 0,
      primaryCta: 'upgrade',
      secondaryCta: 'keep_using',
      showUpgrade: true,
      localToolsNote:
        'Your local Flowlary tools and Google translation are still available. AI writing checks reset tomorrow.',
      compactLine: resetLabel
        ? `Today's AI writing checks are used up · ${resetLabel}`
        : "Today's AI writing checks are used up",
    }
  }

  if (remaining <= LOW_CREDITS_THRESHOLD) {
    return {
      state: 'AI_USAGE_LOW',
      tone: 'warn',
      title: "You're running low on AI writing checks",
      description: creditsRemainingLabel(remaining),
      planLabel: 'Free',
      assistsLabel: creditsRemainingLabel(remaining),
      resetLabel,
      trialDaysRemaining: null,
      progressPercent,
      primaryCta: 'upgrade',
      secondaryCta: 'keep_using',
      showUpgrade: true,
      localToolsNote: null,
      compactLine: resetLabel
        ? `${remaining} AI writing checks left · ${resetLabel}`
        : `${remaining} AI writing checks left today`,
    }
  }

  return {
    state: 'AI_USAGE_HEALTHY',
    tone: 'ok',
    title: 'Free',
    description: 'Daily AI allowance available.',
    planLabel: 'Free',
    assistsLabel: creditsRemainingLabel(remaining),
    resetLabel,
    trialDaysRemaining: null,
    progressPercent,
    primaryCta: 'none',
    secondaryCta: 'view_plan',
    showUpgrade: false,
    localToolsNote: null,
    compactLine: resetLabel
      ? `${formatCreditsRemaining(remaining, dailyLimit)} · ${resetLabel}`
      : formatCreditsRemaining(remaining, dailyLimit),
  }
}

function planLabelFor(input: UsageUxInput): string {
  if (input.isPro) return 'Pro'
  if (input.inTrial) return 'Trial'
  if (input.plan === 'pro') return 'Pro'
  if (input.plan === 'trial') return 'Trial'
  return 'Free'
}

/** Contextual copy when a blocked AI attempt happens after exhaustion. */
export function blockedAiAttemptCopy(resetAt: number, now = Date.now()): {
  title: string
  description: string
  localToolsNote: string
} {
  const reset =
    resetAt > 0 ? formatResetCountdown(resetAt, now) : 'soon'
  return {
    title: "You've used today's AI writing checks",
    description: `Your AI writing checks reset in ${reset}. Upgrade to Pro for more checks and advanced learning tools.`,
    localToolsNote:
      'Your local Flowlary tools and Google translation are still available.',
  }
}

/** Optional plain-language help about shared daily pool (no weights/tokens). */
export const AI_ALLOWANCE_HELP =
  'AI writing checks are used when Flowlary analyzes your writing — not for every character you type. Google translation does not use AI writing checks.'
