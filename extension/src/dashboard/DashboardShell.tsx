import type { ReactNode } from 'react'
import { BRAND } from '@flowlary/shared'
import { AccountAvatar, PopupLogo, ThemeToggle } from '../popup/components.tsx'
import { t } from '../popup/i18n/index.ts'
import { FLOWLARY_SITE_URL } from '../config/endpoints.ts'
import type { DashboardSection } from '../config/dashboard.ts'
import type { DomainState } from '../ui/domainState.ts'
import { ExtensionConnectionStatus } from './components/ExtensionConnectionStatus.tsx'

export type DashboardNavItem = {
  id: DashboardSection | 'support'
  label: string
  href?: string
}

export type DashboardNavGroup = {
  label: string
  items: DashboardNavItem[]
}

export function DashboardShell({
  title,
  navGroups,
  flatNav,
  section,
  version,
  domain,
  signedIn,
  email,
  onNavigate,
  onOpenAccount,
  children,
}: {
  title: string
  navGroups: DashboardNavGroup[]
  flatNav: DashboardNavItem[]
  section: DashboardSection | 'support'
  version: string
  domain: DomainState | null
  signedIn: boolean
  email: string | null
  onNavigate: (id: DashboardSection) => void
  onOpenAccount: () => void
  children: ReactNode
}) {
  function isActive(item: DashboardNavItem) {
    return item.id === section
  }

  function renderNavControl(item: DashboardNavItem, mobile = false) {
    const className = isActive(item) ? 'is-active' : undefined
    if (item.href) {
      return (
        <a
          key={item.id}
          className={className}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          aria-current={isActive(item) ? 'page' : undefined}
        >
          {item.label}
        </a>
      )
    }
    return (
      <button
        key={item.id}
        type="button"
        className={className}
        aria-current={isActive(item) ? 'page' : undefined}
        data-tour={mobile ? undefined : `nav-${item.id}`}
        onClick={() => onNavigate(item.id as DashboardSection)}
      >
        {item.label}
      </button>
    )
  }

  return (
    <div className="wd-workspace fl-dash-root">
      <header className="wd-topbar">
        <div className="wd-topbar-start">
          <div className="fl-dash-brand fl-dash-brand-compact">
            <PopupLogo />
            <div>
              <p className="fl-dash-brand-name">{t('brand.name')}</p>
              <p className="wd-topbar-kicker">{title}</p>
            </div>
          </div>
          {domain ? <ExtensionConnectionStatus domain={domain} /> : null}
        </div>
        <div className="wd-topbar-actions">
          <a
            className="wd-lab-chip"
            href={`${FLOWLARY_SITE_URL}/lab`}
            target="_blank"
            rel="noreferrer"
          >
            {t('dashboard.shell.writingLab')}
            <span className="fl-fidelity fl-fidelity-live" role="status">
              {t('fidelity.live')}
            </span>
          </a>
          <ThemeToggle />
          <span data-tour="account">
            <AccountAvatar signedIn={signedIn} email={email} onClick={onOpenAccount} />
          </span>
        </div>
      </header>

      <div className="wd-shell">
        <aside className="wd-nav" aria-label={t('dashboard.shell.navAria')} data-tour="nav">
          <nav className="wd-nav-groups">
            {navGroups.map((group) => (
              <div key={group.label} className="wd-nav-group">
                <p className="wd-nav-group-label">{group.label}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id}>{renderNavControl(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <nav className="wd-nav-mobile" aria-label={t('dashboard.shell.navAria')}>
            {flatNav.map((item) => renderNavControl(item, true))}
          </nav>
          <p className="fl-dash-version wd-nav-version">v{version || BRAND.version}</p>
        </aside>

        <main className="wd-main">{children}</main>
      </div>
    </div>
  )
}
