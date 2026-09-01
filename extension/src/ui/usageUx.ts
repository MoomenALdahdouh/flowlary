import {
  FREE_DAILY_CREDITS,
  resolveUsageUx,
  type UsageUxInput,
  type UsageUxView,
} from '@flowlary/shared'
import type { ExtensionStatus } from '../messaging/types.ts'
import { isLocalDevApi, localDevApiHint } from '../config/apiHealth.ts'
import { translateUsageUxView } from './translateUsageUx.ts'

export function usageUxInputFromStatus(status: ExtensionStatus, now = Date.now()): UsageUxInput {
  return {
    signedIn: status.account.signedIn,
    apiHealth: status.apiHealth,
    isPro: status.entitlement.isPro,
    inTrial: status.entitlement.inTrial,
    trialEndsAt: status.entitlement.trialEndsAt ?? null,
    plan: status.account.serverPlan ?? status.entitlement.status,
    creditsRemaining: status.entitlement.creditsRemaining,
    creditsUsed: status.entitlement.creditsUsed,
    dailyLimit: status.entitlement.dailyLimit || FREE_DAILY_CREDITS,
    resetAt: status.entitlement.resetAt,
    monthlyCreditsUsed: status.entitlement.monthlyCreditsUsed,
    monthlySoftCap: status.entitlement.monthlySoftCap,
    paymentFailed: status.account.paymentFailed,
    subscriptionStatus: status.account.subscriptionStatus,
    billingAvailable: status.account.billingAvailable,
    now,
  }
}

export function resolveUsageUxFromStatus(status: ExtensionStatus, now = Date.now()): UsageUxView {
  let view = resolveUsageUx(usageUxInputFromStatus(status, now))
  if (view.state === 'AI_TEMPORARILY_UNAVAILABLE' && isLocalDevApi()) {
    const hint = localDevApiHint()
    if (hint) {
      view = {
        ...view,
        description: `${view.description} ${hint}`,
      }
    }
  }
  return translateUsageUxView(view)
}
