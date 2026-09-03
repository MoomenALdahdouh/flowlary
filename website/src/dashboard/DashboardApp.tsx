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
import { Button } from '../components/Ui.tsx'
import { DashboardShell } from './DashboardShell.tsx'
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
        items: group.items.map((item) => ({
          id: item.id,
          label: copy.nav[item.labelKey],
          href: item.route,
        })),
      })),
    [copy.nav],
  )

  const flatNav = useMemo(
    () => navGroups.flatMap((group) => group.items),
    [navGroups],
  )

  const advancedProgress = isPro || inTrial
  const accountPanel = (
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

  let panel = accountPanel
  if (section === 'settings') {
    panel = <SettingsPanel accountId={accountId} copy={copy} onRefresh={refresh} />
  } else if (section !== 'account') {
    const retryBanner = error ? (
      <div className="wd-actions" style={{ marginBottom: '1rem' }}>
        <p className="wd-error" role="alert">
          {copy.common.error}
        </p>
        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          {copy.common.retry}
        </Button>
      </div>
    ) : null
    if (loading && !bundle) {
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
    } else if (!bundle) {
      panel = (
        <div className="wd-panel-stack">
          <p className="wd-error" role="alert">
            {copy.common.error}
          </p>
          <div className="wd-actions">
            <Button type="button" variant="secondary" onClick={() => void refresh()}>
              {copy.common.retry}
            </Button>
          </div>
        </div>
      )
    } else if (section === 'overview') {
      panel = (
        <div className="wd-panel-stack">
          {retryBanner}
          <OverviewPanel
            bundle={bundle}
            accountId={accountId}
            copy={copy}
            locale={locale === 'ar' ? 'ar' : 'en'}
            isProOrTrial={isPro || inTrial}
            extensionConnected={extensionConnected}
            creditsRemaining={creditsRemaining}
            dailyLimit={dailyLimit}
            usageDescription={usageView.description}
            onNavigate={navigate}
          />
        </div>
      )
    } else if (section === 'practice') {
      panel = (
        <div className="wd-panel-stack">
          {retryBanner}
          <PracticePanel
            bundle={bundle}
            accountId={accountId}
            copy={copy}
            initialTargetPatternId={practiceTarget}
            onRefresh={refresh}
          />
        </div>
      )
    } else if (section === 'progress') {
      panel = (
        <div className="wd-panel-stack">
          {retryBanner}
          <ProgressPanel
            bundle={bundle}
            copy={copy}
            advanced={advancedProgress}
            onRefresh={refresh}
            onOpenPractice={() => navigate('practice')}
          />
        </div>
      )
    } else if (section === 'report') {
      panel = (
        <div className="wd-panel-stack">
          {retryBanner}
          <ReportPanel
            bundle={bundle}
            accountId={accountId}
            copy={copy}
            locale={locale === 'ar' ? 'ar' : 'en'}
            isProOrTrial={isPro || inTrial}
            onOpenPractice={(target) => navigate('practice', target)}
          />
        </div>
      )
    }
  }

  return (
    <DashboardShell
      title={messages.account.dashboardKicker}
      navGroups={navGroups}
      nav={flatNav}
      section={section}
      onSectionChange={(id) => navigate(id as DashboardSection)}
      extensionConnected={extensionConnected}
      onSignOut={onLogout}
    >
      {panel}
    </DashboardShell>
  )
}
