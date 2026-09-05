import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  CreditCard,
  Home,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { LocaleSwitcher } from '../bolt/components/layout/Navbar.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'
import { Button } from '../components/Ui.tsx'
import { Logo } from '../components/Logo.tsx'
import { useI18n, useMessages } from '../i18n/index.tsx'
import { AdminSearch } from './AdminSearch.tsx'

const NAV = [
  { to: '/admin', id: 'overview', icon: LayoutDashboard, end: true, group: 'operations' },
  { to: '/admin/users', id: 'users', icon: Users, end: false, group: 'operations' },
  { to: '/admin/subscriptions', id: 'subscriptions', icon: CreditCard, end: false, group: 'operations' },
  { to: '/admin/usage', id: 'usage', icon: Sparkles, end: false, group: 'operations' },
  { to: '/admin/support', id: 'support', icon: LifeBuoy, end: false, group: 'inbox' },
  { to: '/admin/feedback', id: 'feedback', icon: MessageSquare, end: false, group: 'inbox' },
  { to: '/admin/activity', id: 'activity', icon: Activity, end: false, group: 'system' },
  { to: '/admin/settings', id: 'settings', icon: Settings, end: false, group: 'system' },
] as const

const GROUPS = ['operations', 'inbox', 'system'] as const

export function AdminShell({
  children,
  email,
  onLogout,
}: {
  children: ReactNode
  email: string
  onLogout: () => void
}) {
  const t = useMessages().adminPanel
  const { locale, setLocale } = useI18n()
  const { pathname } = useLocation()
  const utilities = (
    <div className="wd-nav-utils">
      <LocaleSwitcher locale={locale} setLocale={setLocale} />
      <ThemeToggle />
    </div>
  )
  const initial = email.trim().charAt(0).toUpperCase() || 'A'

  function navClass(id: string, isActive: boolean) {
    const usersActive = id === 'users' && pathname.startsWith('/admin/users')
    return `wd-nav-item${isActive || usersActive ? ' is-active' : ''}`
  }

  return (
    <div className="wd-workspace ad-workspace">
      <div className="wd-shell">
        <aside className="wd-nav" aria-label={t.navAria}>
          <div className="ad-brand">
            <Logo className="ad-brand-mark" />
            <p className="wd-nav-brand">{t.title}</p>
          </div>
          <nav className="wd-nav-groups">
            {GROUPS.map((group) => (
              <div key={group} className="wd-nav-group">
                <p className="wd-nav-group-label">{t.navGroups[group]}</p>
                <ul>
                  {NAV.filter((item) => item.group === group).map((item) => (
                    <li key={item.id}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => navClass(item.id, isActive)}
                      >
                        <item.icon className="h-4 w-4" />
                        {t.nav[item.id]}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="wd-nav-foot">
            <div className="ad-admin-card">
              <span className="ad-avatar" aria-hidden="true">{initial}</span>
              <span>
                <strong>{email}</strong>
                <small>{t.administrator}</small>
              </span>
            </div>
            <Button type="button" variant="ghost" onClick={onLogout}>
              {t.logout}
            </Button>
            <Link to="/" className="wd-nav-item wd-nav-item--quiet">
              <Home className="h-4 w-4" />
              {t.backToSite}
            </Link>
          </div>
        </aside>
        <div className="ad-stage">
          <header className="ad-topbar">
            <AdminSearch />
            {utilities}
          </header>
          <nav className="wd-nav-mobile" aria-label={t.navAria}>
            {NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.end}
                className={({ isActive }) => navClass(item.id, isActive)}
              >
                <item.icon className="h-4 w-4" />
                {t.nav[item.id]}
              </NavLink>
            ))}
          </nav>
          <div className="wd-main ad-page">{children}</div>
        </div>
      </div>
    </div>
  )
}
