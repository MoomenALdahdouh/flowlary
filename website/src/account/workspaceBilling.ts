import type { WebAccountView, WebEntitlementView, BillingConfigView } from './client.ts'
import { FREE_DAILY_CREDITS } from '@flowlary/shared'
import { catalogDisplayPrice, resolveCommercialPlanState, type CommercialPlanState } from './billing.ts'
import { FLOWLARY_PRICING } from '@flowlary/shared'

function formatResetTime(resetAt: number | undefined, soonLabel: string): string | null {
  if (!resetAt) return null
  const ms = Math.max(0, resetAt - Date.now())
  const totalMinutes = Math.ceil(ms / 60_000)
  if (totalMinutes <= 0) return soonLabel
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

function trialDaysRemaining(trialEndsAt: number | null | undefined): number | null {
  if (!trialEndsAt || trialEndsAt <= Date.now()) return null
  return Math.max(1, Math.ceil((trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

export type WorkspaceBillingProps = {
  planState: CommercialPlanState
  planLabel: string
  isPro: boolean
  studentProActive: boolean
  inTrial: boolean
  trialDays: number | null
  checkoutReady: boolean
  portalReady: boolean
  proPriceLabel: string | null
  creditsRemaining: number | null
  creditsUsed: number | undefined
  dailyLimit: number
  usagePercent: number
  resetIn: string | null
}

export function buildWorkspaceBillingProps(input: {
  account: WebAccountView
  entitlement: WebEntitlementView | null
  billingConfig: BillingConfigView | null
  sessionChecking: boolean
  planLabels: {
    planPro: string
    planStudentPro: string
    planTrial: string
    planFree: string
    creditsResetSoon: string
  }
}): WorkspaceBillingProps {
  const { account, entitlement, billingConfig, sessionChecking, planLabels } = input
  const isPro = entitlement?.isPro === true
  const studentProActive = entitlement?.studentProActive === true
  const inTrial = entitlement?.inTrial === true || account.inTrial === true
  const planState = resolveCommercialPlanState({
    loading: sessionChecking,
    account,
    entitlement,
  })
  const checkoutReady = billingConfig?.checkoutAvailable === true
  const portalReady = billingConfig?.portalAvailable === true
  const trialEndsAt = entitlement?.trialEndsAt ?? account.trialEndsAt ?? null
  const trialDays = trialDaysRemaining(trialEndsAt)
  const planLabel = isPro
    ? planLabels.planPro
    : studentProActive
      ? planLabels.planStudentPro
      : inTrial
        ? planLabels.planTrial
        : planLabels.planFree
  const creditsKnown = !sessionChecking
  const creditsRemaining = creditsKnown
    ? (entitlement?.creditsRemaining ??
        account.creditsRemaining ??
        entitlement?.remainingMs ??
        account.remainingMs ??
        0)
    : null
  const dailyLimit = entitlement?.dailyLimit ?? account.dailyLimit ?? FREE_DAILY_CREDITS
  const creditsUsed = entitlement?.creditsUsed ?? account.creditsUsed
  const proPriceLabel =
    billingConfig?.proPriceMonthly || billingConfig?.proPrice
      ? `${catalogDisplayPrice(
          billingConfig.proPriceMonthly ?? billingConfig.proPrice ?? null,
          FLOWLARY_PRICING.monthly.amountCents,
        )}/mo`
      : null
  const resetIn = formatResetTime(entitlement?.resetAt ?? account.resetAt, planLabels.creditsResetSoon)
  const usagePercent =
    creditsKnown && dailyLimit > 0
      ? Math.min(
          100,
          Math.round(
            ((creditsUsed ?? Math.max(0, dailyLimit - (creditsRemaining ?? 0))) / dailyLimit) * 100,
          ),
        )
      : 0

  return {
    planState,
    planLabel,
    isPro,
    studentProActive,
    inTrial,
    trialDays,
    checkoutReady,
    portalReady,
    proPriceLabel,
    creditsRemaining,
    creditsUsed,
    dailyLimit,
    usagePercent,
    resetIn,
  }
}
