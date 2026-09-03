import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import { ConnectionStatus } from './components/ConnectionStatus.tsx'
import { FidelityBadge } from '../components/Ui.tsx'

export function DashboardShell({
  title,
  navGroups,
  nav,
  section,
  onSectionChange,
  extensionConnected,
  onSignOut,
  children,
}: {
  title: string
  navGroups: { label: string; items: { id: string; label: string; href?: string }[] }[]
  nav: { id: string; label: string; href?: string }[]
  section: string
  onSectionChange: (id: string) => void
  extensionConnected: boolean | null
  onSignOut: () => void
  children: ReactNode
}) {
  const t = useMessages()
  const shell = t.dashboard.shell
  const { pathname } = useLocation()
  const onSupportRoute = pathname.startsWith('/dashboard/support')

  function isActive(item: { id: string; href?: string }) {
    if (item.href) return onSupportRoute
    return !onSupportRoute && section === item.id
  }

  function navClick(item: { id: string; href?: string }) {
    if (item.href) return
    onSectionChange(item.id)
  }

  return (
    <div className="wd-workspace">
      <header className="wd-topbar">
        <div className="wd-topbar-start">
          <p className="wd-topbar-kicker">{title}</p>
          <ConnectionStatus connected={extensionConnected} />
        </div>
        <div className="wd-topbar-actions">
          <Link className="wd-lab-chip" to="/lab">
            {shell.writingLab}
            <FidelityBadge mode="live" />
          </Link>
          <Button variant="ghost" onClick={onSignOut}>
            {shell.signOut}
          </Button>
        </div>
      </header>
      <div className="wd-shell">
        <aside className="wd-nav" aria-label={shell.navAria}>
          <nav className="wd-nav-groups">
            {navGroups.map((group) => (
              <div key={group.label} className="wd-nav-group">
                <p className="wd-nav-group-label">{group.label}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          className={isActive(item) ? 'is-active' : ''}
                          to={item.href}
                          aria-current={isActive(item) ? 'page' : undefined}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={isActive(item) ? 'is-active' : ''}
                          aria-current={isActive(item) ? 'page' : undefined}
                          onClick={() => navClick(item)}
                        >
                          {item.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <nav className="wd-nav-mobile" aria-label={shell.navAria}>
            {nav.map((item) =>
              item.href ? (
                <Link
                  key={item.id}
                  className={isActive(item) ? 'is-active' : ''}
                  to={item.href}
                  aria-current={isActive(item) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className={isActive(item) ? 'is-active' : ''}
                  aria-current={isActive(item) ? 'page' : undefined}
                  onClick={() => navClick(item)}
                >
                  {item.label}
                </button>
              ),
            )}
          </nav>
        </aside>
        <main className="wd-main">{children}</main>
      </div>
    </div>
  )
}
