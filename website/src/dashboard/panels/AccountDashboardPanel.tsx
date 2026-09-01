import type { ReactNode } from 'react'
import { Badge, Button, GetFlowlaryButton } from '../../components/Ui.tsx'
import { AccountBillingPanel } from '../../account/AccountBillingPanel.tsx'
import { syncStoredSessionToExtension } from '../../account/extensionBridge.ts'
import type { WebAccountView, WebEntitlementView } from '../../account/client.ts'
import type { CommercialPlanState } from '../../account/billing.ts'
import type { DashboardCopy } from '../types.ts'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

type AccountDashboardPanelProps = {
  account: WebAccountView
  entitlement: WebEntitlementView | null
  copy: DashboardCopy
  accountCopy: ReturnType<typeof import('../../i18n/index.tsx').useMessages>['account']
  planState: CommercialPlanState
  planLabel: string
  isPro: boolean
  studentProActive: boolean
  inTrial: boolean
  trialDays: number | null
  subscription: WebEntitlementView['subscription'] | WebAccountView['subscription'] | null | undefined
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
  usageDescription: string | null
  resetIn: string | null
  extensionConnected: boolean | null
  onLogout: () => void
  onUpgrade: () => void
  onManageBilling: () => void
  onRefreshAccount: () => void
}

export function AccountDashboardPanel({
  account,
  entitlement,
  accountCopy,
  planState,
  planLabel,
  isPro,
  studentProActive,
  inTrial,
  trialDays,
  subscription,
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
  usageDescription,
  resetIn,
  extensionConnected,
  onLogout,
  onUpgrade,
  onManageBilling,
  onRefreshAccount,
}: AccountDashboardPanelProps) {
  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{accountCopy.sectionProfile}</h2>
      </header>

      <article className="wd-card">
        <div className="ac-row">
          <span className="ac-label">{accountCopy.email}</span>
          <span className="ac-value">
            {account.email}
            {account.emailVerified !== false ? (
              <span className="ac-badge-inline"> {accountCopy.emailVerified}</span>
            ) : (
              <span className="ac-badge-inline"> {accountCopy.emailUnverified}</span>
            )}
          </span>
        </div>
        <div className="ac-row">
          <span className="ac-label">{accountCopy.status}</span>
          <span className="ac-value">
            <Badge tone={account.status === 'active' ? 'ok' : 'warn'}>{account.status}</Badge>
          </span>
        </div>
      </article>

      <AccountBillingPanel
        planState={planState}
        planLabel={planLabel}
        isPro={isPro}
        studentProActive={studentProActive}
        inTrial={inTrial}
        trialDays={trialDays}
        subscription={subscription ?? undefined}
        checkoutReady={checkoutReady}
        portalReady={portalReady}
        activating={activating}
        busy={billingBusy}
        billingMessage={billingMessage}
        proPriceLabel={proPriceLabel}
        onUpgrade={onUpgrade}
        onManageBilling={onManageBilling}
        onRefresh={onRefreshAccount}
      />

      <article className="wd-card">
        <h3>{accountCopy.sectionUsage}</h3>
        <p className="ac-dash-meta">
          {creditsRemaining != null
            ? fill(accountCopy.creditsRemainingLabel, { count: creditsRemaining })
            : accountCopy.loading}
          {typeof creditsUsed === 'number' && !inTrial && !isPro && !studentProActive
            ? ` · ${fill(accountCopy.creditsUsedLabel, { count: creditsUsed })}`
            : ''}
          {resetIn ? ` · ${fill(accountCopy.creditsResetLabel, { when: resetIn })}` : ''}
        </p>
        {usageDescription ? <p className="ac-dash-meta">{usageDescription}</p> : null}
        {usagePercent > 0 && dailyLimit > 0 && !inTrial ? (
          <div className="ac-usage-bar" role="progressbar" aria-valuenow={usagePercent}>
            <div className="ac-usage-fill" style={{ width: `${usagePercent}%` }} />
          </div>
        ) : null}
      </article>

      <article className="wd-card">
        <h3>{accountCopy.extensionProduct}</h3>
        <p>
          {extensionConnected == null
            ? accountCopy.loading
            : extensionConnected
              ? accountCopy.extensionConnected
              : accountCopy.extensionNotDetected}
        </p>
        <div className="wd-actions">
          {extensionConnected ? (
            <Button type="button" variant="secondary" onClick={() => syncStoredSessionToExtension(account, { force: true })}>
              {accountCopy.syncExtension}
            </Button>
          ) : (
            <GetFlowlaryButton variant="secondary" />
          )}
        </div>
      </article>

      <div className="wd-actions">
        <Button variant="ghost" onClick={onLogout}>
          {accountCopy.signOut}
        </Button>
      </div>
    </div>
  )
}

export function DashboardShell({
  title,
  navGroups,
  nav,
  section,
  onSectionChange,
  children,
}: {
  title: string
  navGroups: { label: string; items: { id: string; label: string }[] }[]
  nav: { id: string; label: string }[]
  section: string
  onSectionChange: (id: string) => void
  children: ReactNode
}) {
  return (
    <div className="wd-shell">
      <aside className="wd-nav" aria-label="Dashboard">
        <p className="wd-nav-kicker">{title}</p>
        <nav className="wd-nav-groups">
          {navGroups.map((group) => (
            <div key={group.label} className="wd-nav-group">
              <p className="wd-nav-group-label">{group.label}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={section === item.id ? 'is-active' : ''}
                      aria-current={section === item.id ? 'page' : undefined}
                      onClick={() => onSectionChange(item.id)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <nav className="wd-nav-mobile" aria-label="Dashboard sections">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'is-active' : ''}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => onSectionChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="wd-main">{children}</main>
    </div>
  )
}
