import { useCallback, useEffect, useMemo, useState } from 'react'
import { FREE_DAILY_CREDITS, resolveUsageUx } from '@flowlary/shared'
import { useMessages, useI18n } from '../i18n/index.tsx'
import type { WebAccountView, WebEntitlementView, BillingConfigView } from '../account/client.ts'
import type { CommercialPlanState } from '../account/billing.ts'
import { probeExtensionBridge } from '../account/extensionBridge.ts'
import { useWebLearningBundle } from './useWebLearningBundle.ts'
import {
  DASHBOARD_NAV_GROUPS,
  parseDashboardSection,
  parsePracticeTarget,
  type DashboardCopy,
  type DashboardSection,
} from './types.ts'
import { DashboardShell } from './panels/AccountDashboardPanel.tsx'
import { OverviewPanel } from './panels/OverviewPanel.tsx'
import { PracticePanel } from './panels/PracticePanel.tsx'
import { ProgressPanel } from './panels/ProgressPanel.tsx'
import { ReportPanel } from './panels/ReportPanel.tsx'
import { SettingsPanel } from './panels/SettingsPanel.tsx'
import { AccountDashboardPanel } from './panels/AccountDashboardPanel.tsx'

export type DashboardAppProps = {
  account: WebAccountView
  entitlement: WebEntitlementView | null
  planState: CommercialPlanState
  planLabel: string
  isPro: boolean
  studentProActive: boolean
  inTrial: boolean
  trialDays: number | null
  checkoutReady: boolean
  portalReady: boolean
  activating: boolean
  billingBusy: 'checkout' | 'portal' | null
  billingMessage: string | null
  proPriceLabel: string | null
  creditsRemaining: number | null
  creditsUsed: number | undefined
  dailyLimit: number
  usagePercent: number
  resetIn: string | null
  onLogout: () => void
  onUpgrade: () => void
  onManageBilling: () => void
  onRefreshAccount: () => void
}

function buildDashboardCopy(messages: ReturnType<typeof useMessages>): DashboardCopy {
  const d = messages.dashboard
  return d as DashboardCopy
}

export function DashboardApp({
  account,
  entitlement,
  planState,
  planLabel,
  isPro,
  studentProActive,
  inTrial,
  trialDays,
  checkoutReady,
  portalReady,
  activating,
  billingBusy,
  billingMessage,
  proPriceLabel,
  creditsRemaining,
  creditsUsed,
  dailyLimit,
  usagePercent,
  resetIn,
  onLogout,
  onUpgrade,
  onManageBilling,
  onRefreshAccount,
}: DashboardAppProps) {
  const messages = useMessages()
  const { locale } = useI18n()
  const copy = buildDashboardCopy(messages)
  const accountId = account.id
  const { bundle, loading, error, refresh } = useWebLearningBundle(accountId)
  const [section, setSection] = useState<DashboardSection>(() =>
    typeof window === 'undefined' ? 'overview' : parseDashboardSection(window.location.hash),
  )
  const [practiceTarget, setPracticeTarget] = useState<string | undefined>(() =>
    typeof window === 'undefined' ? undefined : parsePracticeTarget(window.location.hash),
  )
  const [extensionConnected, setExtensionConnected] = useState<boolean | null>(null)

  const subscription = entitlement?.subscription ?? account.subscription
  const usageView = resolveUsageUx({
    signedIn: true,
    isPro,
    inTrial,
    trialEndsAt: entitlement?.trialEndsAt ?? account.trialEndsAt ?? null,
    plan: entitlement?.plan ?? account.plan ?? null,
    creditsRemaining: creditsRemaining ?? 0,
    creditsUsed: creditsUsed ?? 0,
    dailyLimit,
    resetAt: entitlement?.resetAt ?? account.resetAt ?? 0,
    monthlyCreditsUsed: entitlement?.monthlyCreditsUsed ?? account.monthlyCreditsUsed ?? 0,
    monthlySoftCap: entitlement?.monthlySoftCap ?? account.monthlySoftCap ?? null,
    paymentFailed: subscription?.paymentFailed === true,
    subscriptionStatus: subscription?.status ?? null,
    billingAvailable: entitlement?.billingAvailable ?? account.billingAvailable ?? false,
  })

  useEffect(() => {
    void probeExtensionBridge().then(setExtensionConnected)
  }, [])

  useEffect(() => {
    const onHash = () => {
      setSection(parseDashboardSection(window.location.hash))
      setPracticeTarget(parsePracticeTarget(window.location.hash))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((next: DashboardSection, target?: string) => {
    const hash = target ? `#${next}?target=${encodeURIComponent(target)}` : `#${next}`
    if (window.location.hash !== hash) {
      window.location.hash = hash
    }
    setSection(next)
    setPracticeTarget(target)
  }, [])

  const navGroups = useMemo(
    () =>
      DASHBOARD_NAV_GROUPS.map((group) => ({
        label: copy.nav[group.labelKey],
        items: group.items.map((item) => ({ id: item.id, label: copy.nav[item.labelKey] })),
      })),
    [copy.nav],
  )

  const flatNav = useMemo(
    () => navGroups.flatMap((group) => group.items),
    [navGroups],
  )

  const advancedProgress = isPro || inTrial

  let panel = null
  if (loading || !bundle) {
    panel = (
      <div className="wd-panel-stack" aria-busy="true" aria-label={copy.common.loading}>
        <div className="wd-skeleton wd-skeleton-title" />
        <div className="wd-skeleton wd-skeleton-line" />
        <article className="wd-card">
          <div className="wd-skeleton wd-skeleton-line" />
          <div className="wd-skeleton wd-skeleton-line wd-skeleton-short" />
        </article>
      </div>
    )
  } else {
    switch (section) {
      case 'overview':
        panel = (
          <OverviewPanel
            bundle={bundle}
            accountId={accountId}
            copy={copy}
            locale={locale === 'ar' ? 'ar' : 'en'}
            isProOrTrial={isPro || inTrial}
            extensionConnected={extensionConnected}
            onNavigate={navigate}
          />
        )
        break
      case 'practice':
        panel = (
          <PracticePanel
            bundle={bundle}
            accountId={accountId}
            copy={copy}
            initialTargetPatternId={practiceTarget}
            onRefresh={refresh}
          />
        )
        break
      case 'progress':
        panel = (
          <ProgressPanel
            bundle={bundle}
            copy={copy}
            advanced={advancedProgress}
            onRefresh={refresh}
            onOpenPractice={() => navigate('practice')}
          />
        )
        break
      case 'report':
        panel = (
          <ReportPanel
            bundle={bundle}
            accountId={accountId}
            copy={copy}
            isProOrTrial={isPro || inTrial}
            onOpenPractice={(target) => navigate('practice', target)}
          />
        )
        break
      case 'settings':
        panel = <SettingsPanel accountId={accountId} copy={copy} onRefresh={refresh} />
        break
      case 'account':
      default:
        panel = (
          <AccountDashboardPanel
            account={account}
            entitlement={entitlement}
            copy={copy}
            accountCopy={messages.account}
            planState={planState}
            planLabel={planLabel}
            isPro={isPro}
            studentProActive={studentProActive}
            inTrial={inTrial}
            trialDays={trialDays}
            subscription={subscription}
            checkoutReady={checkoutReady}
            portalReady={portalReady}
            activating={activating}
            billingBusy={billingBusy}
            billingMessage={billingMessage}
            proPriceLabel={proPriceLabel}
            creditsRemaining={creditsRemaining}
            creditsUsed={creditsUsed}
            dailyLimit={dailyLimit}
            usagePercent={usagePercent}
            usageDescription={usageView.description}
            resetIn={resetIn}
            extensionConnected={extensionConnected}
            onLogout={onLogout}
            onUpgrade={onUpgrade}
            onManageBilling={onManageBilling}
            onRefreshAccount={onRefreshAccount}
          />
        )
        break
    }
  }

  return (
    <DashboardShell
      title={messages.account.dashboardKicker}
      navGroups={navGroups}
      nav={flatNav}
      section={section}
      onSectionChange={(id) => navigate(id as DashboardSection)}
    >
      {panel}
    </DashboardShell>
  )
}
