import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useI18n, useMessages } from '../i18n/index.tsx'
import { ENABLED_LOCALES } from '../config.ts'
import { hasStoredWebSession } from '../account/client.ts'
import { Logo } from './Logo.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { InstallFlowlaryButton } from './Ui.tsx'
import { DocumentHead } from './DocumentHead.tsx'
import { ScrollManager } from './ScrollManager.tsx'
import { LegacyHashRedirect } from './LegacyHashRedirect.tsx'

const NAV = [
  { to: '/features', key: 'features' as const },
  { to: '/guide', key: 'extension' as const },
  { to: '/lab', key: 'writingLab' as const },
  { to: '/pricing', key: 'pricing' as const },
]

export function Layout() {
  const t = useMessages()
  const { pathname } = useLocation()
  const { direction, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLDivElement>(null)

  const isCurrentNav = (to: string) => pathname === to

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    setSignedIn(hasStoredWebSession())
  }, [pathname])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    let frame = 0
    let lastScrolled = false
    const observer = new IntersectionObserver(([entry]) => {
      const next = !entry.isIntersecting
      if (next === lastScrolled) return
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        lastScrolled = next
        setScrolled(next)
      })
    })
    observer.observe(node)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
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

  const accountLabel = signedIn ? t.nav.dashboard : t.nav.signIn
  const accountHref = signedIn ? '/dashboard' : '/account'

  return (
    <div className="site snow-grain" lang={locale} dir={direction}>
      <LegacyHashRedirect />
      <ScrollManager />
      <DocumentHead />
      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />
      <a className="skip-link" href="#content">
        {t.a11y.skip}
      </a>
      <header className={`header${scrolled || open ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
        <div className="container header-wrap">
          <div className="header-shell">
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
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
              <Link className="nav-account" to={accountHref}>
                {accountLabel}
              </Link>
              <span className="nav-cta">
                <InstallFlowlaryButton className="btn-sm" showChromeIcon />
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
        <div className="mobile-nav-panel">
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
              <Link className="nav-link mobile-nav-link" to={accountHref}>
                {accountLabel}
              </Link>
            </nav>
            <div className="mobile-nav-cta">
              <InstallFlowlaryButton />
            </div>
          </div>
        </div>
      </div>
      <main id="content" className="main">
        <Outlet />
      </main>
      <SiteFooter accountHref={accountHref} accountLabel={accountLabel} />
    </div>
  )
}

function LocaleSwitcher() {
  const t = useMessages()
  const { locale, setLocale } = useI18n()
  const hero = t.marketingHome.hero

  return (
    <div className="locale-toggle" role="group" aria-label={t.a11y.locale}>
      {ENABLED_LOCALES.map((code) => {
        const label = code === 'ar' ? hero.localeArabic : hero.localeEnglish
        const active = locale === code
        return (
          <button
            key={code}
            type="button"
            className={`locale-toggle-btn${active ? ' is-active' : ''}`}
            aria-pressed={active}
            lang={code}
            onClick={() => setLocale(code)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function SiteFooter({
  accountHref,
  accountLabel,
}: {
  accountHref: string
  accountLabel: string
}) {
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
                <Link to="/pricing">{t.nav.pricing}</Link>
              </li>
              <li>
                <Link to="/try">{t.nav.try}</Link>
              </li>
              <li>
                <Link to="/product">{t.nav.product}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t.footer.account}</h2>
            <ul>
              <li>
                <Link to={accountHref}>{accountLabel}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t.footer.help}</h2>
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
              <li>
                <Link to="/feedback">{t.nav.feedback}</Link>
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
        </div>
        <div className="footer-bottom">
          <span>{t.footer.copyright}</span>
          <span>{t.footer.tagline}</span>
        </div>
      </div>
    </footer>
  )
}
