/**
 * Phase 29C — canonical commercial pricing (display + validation).
 * Entitlement/credits remain Phase 29A. Checkout/webhook remain server-authoritative.
 */

import { ACCOUNT_TRIAL_DURATION_MS } from './account/types.ts'
import { FREE_DAILY_CREDITS, PRO_DAILY_CREDITS, PRO_MONTHLY_SOFT_CAP, TRIAL_DAILY_CREDITS } from './credits.ts'

export type BillingInterval = 'month' | 'year'

/** Approved list prices (USD cents). Must match Paddle catalog amounts. */
export const PRO_MONTHLY_PRICE_CENTS = 499
export const PRO_YEARLY_PRICE_CENTS = 3900

/** Display-only: student program duration in months (Phase 1 marketing; Phase 2 entitlement). */
export const STUDENT_PROGRAM_DURATION_MONTHS = 12

const PRICING_CURRENCY = 'USD'

export const FLOWLARY_PRICING = {
  currency: PRICING_CURRENCY,
  monthly: {
    amountCents: PRO_MONTHLY_PRICE_CENTS,
    display: formatUsdFromCents(PRO_MONTHLY_PRICE_CENTS),
    interval: 'month' as const,
  },
  yearly: {
    amountCents: PRO_YEARLY_PRICE_CENTS,
    display: formatUsdFromCents(PRO_YEARLY_PRICE_CENTS),
    interval: 'year' as const,
  },
  /** Derived: (monthly × 12) − yearly. Only show when positive. */
  yearlySavingsCents: PRO_MONTHLY_PRICE_CENTS * 12 - PRO_YEARLY_PRICE_CENTS,
  /** Derived: yearly ÷ 12. */
  yearlyEquivalentMonthlyCents: Math.round(PRO_YEARLY_PRICE_CENTS / 12),
  trialDays: Math.max(1, Math.round(ACCOUNT_TRIAL_DURATION_MS / (24 * 60 * 60 * 1000))),
  studentProgramMonths: STUDENT_PROGRAM_DURATION_MONTHS,
  freeDailyCredits: FREE_DAILY_CREDITS,
  proDailyCredits: PRO_DAILY_CREDITS,
  trialDailyCredits: TRIAL_DAILY_CREDITS,
  proMonthlySoftCap: PRO_MONTHLY_SOFT_CAP,
  /** Canonical website destinations (extension uses getUpgradeUrl). */
  pricingPath: '/pricing',
  accountPath: '/account',
} as const

export function formatUsdFromCents(cents: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: PRICING_CURRENCY,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function annualSavingsCents(
  monthlyCents = PRO_MONTHLY_PRICE_CENTS,
  yearlyCents = PRO_YEARLY_PRICE_CENTS,
): number {
  return monthlyCents * 12 - yearlyCents
}

export function yearlyEquivalentMonthlyCents(yearlyCents = PRO_YEARLY_PRICE_CENTS): number {
  return Math.round(yearlyCents / 12)
}

/** Validate a live catalog amount against approved product pricing. */
export function catalogAmountMatchesApproved(
  amountCents: number,
  interval: BillingInterval,
): boolean {
  if (interval === 'year') return amountCents === PRO_YEARLY_PRICE_CENTS
  return amountCents === PRO_MONTHLY_PRICE_CENTS
}
