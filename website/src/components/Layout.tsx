import { useEffect, useId, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { isLocaleEnabled, useI18n, useMessages } from '../i18n/index.tsx'
import { UI_LOCALES } from '@flowlary/shared'
import { Logo } from './Logo.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { GetFlowlaryButton } from './Ui.tsx'
import { DocumentHead } from './DocumentHead.tsx'
import { ScrollManager } from './ScrollManager.tsx'

const NAV = [
  { to: '/#write', key: 'product' as const },
  { to: '/#how', key: 'howItWorks' as const },
  { to: '/features', key: 'features' as const },
  { to: '/pricing#students', key: 'students' as const },
  { to: '/pricing', key: 'pricing' as const },
]

export function Layout() {
  const t = useMessages()
  const { pathname, hash } = useLocation()
  const { direction, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLDivElement>(null)
  const isCurrentNav = (to: string) => {
    const [targetPath, targetHash] = to.split('#')
    if (pathname !== targetPath) return false
    if (!targetHash) return hash === ''
    if (to === '/#write' && hash === '') return true
    return hash === `#${targetHash}`
  }

  useEffect(() => {
    setOpen(false)
  }, [pathname, hash])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(!entry.isIntersecting)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !mobileNavRef.current) return
      const focusable = [...mobileNavRef.current.querySelectorAll<HTMLElement>('a, button')].filter(
        (node) => !node.hasAttribute('disabled'),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    const first = mobileNavRef.current?.querySelector<HTMLElement>('a, button')
    first?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      menuButtonRef.current?.focus()
    }
  }, [open])

  return (
    <div className="site snow-grain" lang={locale} dir={direction}>
      <ScrollManager />
      <DocumentHead />
      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />
      <a className="skip-link" href="#content">
        {t.a11y.skip}
      </a>
      <header className={`header${scrolled || open ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
        <div className="container header-wrap">
          <div className="header-glass">
            <Link className="brand" to="/">
              <Logo className="brand-mark" />
              <span className="brand-name">{t.brand.name}</span>
            </Link>
            <nav className="nav-desktop nav-rail" aria-label={t.a11y.primaryNav}>
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="nav-link"
                  aria-current={isCurrentNav(item.to) ? 'page' : undefined}
                >
                  {t.nav[item.key]}
                </Link>
              ))}
            </nav>
            <div className="header-actions">
              <div className="header-utilities">
                <ThemeToggle />
                <LocaleSwitcher />
              </div>
              <Link className="nav-account" to="/account">
                {t.nav.account}
              </Link>
              <span className="nav-cta">
                <GetFlowlaryButton className="btn-sm" />
              </span>
              <button
                ref={menuButtonRef}
                type="button"
                className="menu-toggle"
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={open ? t.a11y.menuClose : t.a11y.menuOpen}
                onClick={() => setOpen((value) => !value)}
              >
                <span className="menu-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <div
        id="mobile-nav"
        ref={mobileNavRef}
        className="mobile-nav"
        hidden={!open}
        role="dialog"
        aria-modal={open || undefined}
        aria-label={t.a11y.menu}
      >
        <div className="mobile-nav-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
        <div className="mobile-nav-panel glass-3">
          <div className="container mobile-nav-inner">
            <nav className="mobile-nav-links">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="nav-link mobile-nav-link"
                  aria-current={isCurrentNav(item.to) ? 'page' : undefined}
                >
                  {t.nav[item.key]}
                </Link>
              ))}
              <Link className="nav-link mobile-nav-link" to="/account">
                {t.nav.account}
              </Link>
            </nav>
            <div className="mobile-nav-cta">
              <GetFlowlaryButton />
            </div>
          </div>
        </div>
      </div>
      <main id="content" className="main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

function LocaleSwitcher() {
  const t = useMessages()
  const { locale, setLocale, enabledLocales } = useI18n()
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="locale-switcher" ref={ref}>
      <button
        type="button"
        className="locale-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t.a11y.locale}
        onClick={() => setOpen((value) => !value)}
      >
        {UI_LOCALES.find((item) => item.code === locale)?.code.toUpperCase() ?? locale.toUpperCase()}
      </button>
      {open ? (
        <div className="locale-menu" id={id} role="listbox" aria-label={t.a11y.locale}>
          {enabledLocales.map((code) => (
            <button
              key={code}
              type="button"
              className="locale-option"
              role="option"
              aria-selected={locale === code}
              disabled={!isLocaleEnabled(code)}
              onClick={() => {
                setLocale(code)
                setOpen(false)
              }}
            >
              {t.locale[code as keyof typeof t.locale] ?? code}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SiteFooter() {
  const t = useMessages()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-brand">
          <Link className="brand" to="/">
            <Logo className="brand-mark" />
            <span className="brand-name">{t.brand.name}</span>
          </Link>
          <p className="muted">{t.footer.tagline}</p>
        </div>
        <div className="footer-grid">
          <div>
            <h2>{t.footer.product}</h2>
            <ul>
              <li>
                <Link to="/features">{t.nav.features}</Link>
              </li>
              <li>
                <Link to="/#how">{t.nav.howItWorks}</Link>
              </li>
              <li>
                <Link to="/pricing#students">{t.nav.students}</Link>
              </li>
              <li>
                <Link to="/pricing">{t.nav.pricing}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t.footer.account}</h2>
            <ul>
              <li>
                <Link to="/account">{t.nav.account}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t.footer.legal}</h2>
            <ul>
              <li>
                <Link to="/privacy">{t.nav.privacy}</Link>
              </li>
              <li>
                <Link to="/terms">{t.nav.terms}</Link>
              </li>
              <li>
                <Link to="/cookies">{t.nav.cookies}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t.footer.support}</h2>
            <ul>
              <li>
                <Link to="/guide">{t.nav.guide}</Link>
              </li>
              <li>
                <Link to="/support">{t.nav.support}</Link>
              </li>
              <li>
                <Link to="/contact">{t.nav.contact}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{t.footer.copyright}</span>
          <span>{t.footer.tagline}</span>
        </div>
      </div>
    </footer>
  )
}
