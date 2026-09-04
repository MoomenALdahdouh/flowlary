import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, FileText, Home, LayoutDashboard, LifeBuoy, PenLine, Settings, TrendingUp, User } from 'lucide-react'
import { LocaleSwitcher } from '../bolt/components/layout/Navbar.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'
import { useI18n, useMessages } from '../i18n/index.tsx'
import { ConnectionStatus } from './components/ConnectionStatus.tsx'

const ICONS: Record<string, ReactNode> = {
  overview: <LayoutDashboard className="h-4 w-4" />,
  lab: <PenLine className="h-4 w-4" />,
  practice: <BookOpen className="h-4 w-4" />,
  progress: <TrendingUp className="h-4 w-4" />,
  report: <FileText className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  account: <User className="h-4 w-4" />,
  support: <LifeBuoy className="h-4 w-4" />,
}

function NavItem({
  item,
  active,
  onSectionChange,
}: {
  item: { id: string; label: string; href?: string }
  active: boolean
  onSectionChange: (id: string) => void
}) {
  const className = `wd-nav-item${active ? ' is-active' : ''}${item.id === 'lab' ? ' wd-nav-item--lab' : ''}`
  if (item.href) {
    return (
      <Link className={className} to={item.href} aria-current={active ? 'page' : undefined}>
        {ICONS[item.id]}
        {item.label}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={className}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSectionChange(item.id)}
    >
      {ICONS[item.id]}
      {item.label}
    </button>
  )
}

export function DashboardShell({
  navGroups,
  nav,
  section,
  onSectionChange,
  extensionConnected,
  children,
}: {
  title?: string
  navGroups: { label: string; items: { id: string; label: string; href?: string }[] }[]
  nav: { id: string; label: string; href?: string }[]
  section: string
  onSectionChange: (id: string) => void
  extensionConnected: boolean | null
  onSignOut?: () => void
  children: ReactNode
}) {
  const t = useMessages()
  const { locale, setLocale } = useI18n()
  const shell = t.dashboard.shell
  const { pathname } = useLocation()

  function isActive(item: { id: string; href?: string }) {
    if (item.href) return pathname === item.href || pathname.startsWith(`${item.href}/`)
    return !pathname.startsWith('/dashboard/support') && section === item.id
  }

  const utilities = (
    <>
      <ConnectionStatus connected={extensionConnected} />
      <div className="wd-nav-utils">
        <LocaleSwitcher locale={locale} setLocale={setLocale} />
        <ThemeToggle />
      </div>
    </>
  )

  return (
    <div className="wd-workspace">
      <div className="wd-shell">
        <aside className="wd-nav" aria-label={shell.navAria}>
          <p className="wd-nav-brand">{t.brand.name}</p>
          <nav className="wd-nav-groups">
            {navGroups.map((group) => (
              <div key={group.label} className="wd-nav-group">
                <p className="wd-nav-group-label">{group.label}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <NavItem item={item} active={isActive(item)} onSectionChange={onSectionChange} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="wd-nav-foot">
            {utilities}
            <Link to="/" className="wd-nav-item wd-nav-item--quiet">
              <Home className="h-4 w-4" />
              {t.pages.home}
            </Link>
          </div>
        </aside>
        <nav className="wd-nav-mobile" aria-label={shell.navAria}>
          {nav.map((item) => (
            <NavItem key={item.id} item={item} active={isActive(item)} onSectionChange={onSectionChange} />
          ))}
        </nav>
        <div className="wd-mobile-bar">{utilities}</div>
        <main className="wd-main">{children}</main>
      </div>
    </div>
  )
}
