import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ChevronDown, LayoutDashboard, User } from 'lucide-react'
import { ChromeIcon } from '../icons/ChromeIcon'
import { FEATURES, NAV_LINKS } from '@/bolt/data/site'
import Logo from './Logo'
import { ThemeToggle } from '../../../components/ThemeToggle.tsx'
import { AddToChromeButton } from '../../../components/install/AddToChromeButton.tsx'
import { useI18n, useMessages } from '../../../i18n/index.tsx'
import { ENABLED_LOCALES, type Locale } from '../../../config.ts'
import { hasStoredWebSession } from '../../../account/client.ts'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [featuresOpen, setFeaturesOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const location = useLocation()
  const t = useMessages()
  const { locale, setLocale } = useI18n()

  useEffect(() => {
    setOpen(false)
    setFeaturesOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    setSignedIn(hasStoredWebSession())
  }, [location.pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const accountHref = signedIn ? '/dashboard' : '/account'
  const accountLabel = signedIn ? t.nav.dashboard : t.nav.signIn
  const accountCurrent = signedIn
    ? location.pathname.startsWith('/dashboard')
    : location.pathname.startsWith('/account')
  const AccountIcon = signedIn ? LayoutDashboard : User

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90'
          : 'border-b border-transparent bg-white/60 backdrop-blur-sm dark:bg-slate-900/60'
      }`}
    >
      <nav className="container-flow flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4" aria-label={t.a11y.primaryNav}>
        <Logo />

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) =>
            link.to === '/features' ? (
              <div
                key={link.to}
                className="relative"
                onMouseEnter={() => setFeaturesOpen(true)}
                onMouseLeave={() => setFeaturesOpen(false)}
              >
                <Link
                  to="/features"
                  className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    location.pathname.startsWith('/features')
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {t.nav[link.nav]}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${featuresOpen ? 'rotate-180' : ''}`} />
                </Link>
                {featuresOpen && (
                  <div className="absolute start-0 top-full z-50 pt-2">
                    <div className="fl-features-menu origin-top-start animate-fade-in-down">
                    {FEATURES.map((feature) => (
                      <Link
                        key={feature.slug}
                        to={`/features/${feature.slug}`}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-sky-50/80 dark:hover:bg-slate-800/80"
                      >
                        <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{t.pages.cards[feature.slug].title}</span>
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t.pages.cards[feature.slug].tagline}</span>
                        </span>
                      </Link>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {t.nav[link.nav]}
              </Link>
            ),
          )}
        </div>

        <div className="fl-nav-actions hidden lg:flex">
          <div className="fl-nav-cluster">
            <LocaleSwitcher locale={locale} setLocale={setLocale} />
            <span className="fl-nav-cluster__rule" aria-hidden="true" />
            <ThemeToggle />
            <Link
              to={accountHref}
              className={`fl-nav-icon-link${accountCurrent ? ' is-current' : ''}`}
              aria-label={accountLabel}
              title={accountLabel}
              aria-current={accountCurrent ? 'page' : undefined}
            >
              <AccountIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <AddToChromeButton
            className="fl-nav-cta"
            chromeIcon={<ChromeIcon className="h-4 w-4" />}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:hidden">
          <LocaleSwitcher locale={locale} setLocale={setLocale} />
          <ThemeToggle />
          <Link
            to={accountHref}
            className={`fl-nav-icon-link${accountCurrent ? ' is-current' : ''}`}
            aria-label={accountLabel}
            title={accountLabel}
            aria-current={accountCurrent ? 'page' : undefined}
          >
            <AccountIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-[2.375rem] w-[2.375rem] items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={open ? t.a11y.menuClose : t.a11y.menuOpen}
            aria-expanded={open}
            aria-controls="site-mobile-nav"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="site-mobile-nav"
          className="border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:hidden"
          role="navigation"
          aria-label={t.a11y.menu}
        >
          <div className="container-flow flex max-h-[min(70dvh,36rem)] flex-col gap-1 overflow-y-auto py-4">
            {NAV_LINKS.map((link) =>
              link.to === '/features' ? (
                <div key={link.to} className="flex flex-col">
                  <Link
                    to="/features"
                    className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      location.pathname.startsWith('/features')
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.nav[link.nav]}
                  </Link>
                  <div className="ms-3 flex flex-col border-s border-slate-200 ps-2 dark:border-slate-700">
                    {FEATURES.map((feature) => (
                      <Link
                        key={feature.slug}
                        to={`/features/${feature.slug}`}
                        className="rounded-lg px-3 py-2 text-start text-sm text-slate-500 hover:bg-slate-50 hover:text-sky-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-sky-400"
                      >
                        {t.pages.cards[feature.slug].title}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {t.nav[link.nav]}
                </Link>
              ),
            )}
            <Link to="/lab" className="rounded-lg px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">
              {t.pages.writingLab}
            </Link>
            <Link to={accountHref} className="rounded-lg px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">
              {accountLabel}
            </Link>
            <div className="mt-2 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <Link to="/try" className="btn-secondary w-full">
                {t.pages.tryDemos}
              </Link>
              <AddToChromeButton
                className="fl-nav-cta w-full"
                chromeIcon={<ChromeIcon className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export function LocaleSwitcher({
  locale,
  setLocale,
}: {
  locale: string
  setLocale: (code: Locale) => void
}) {
  const t = useMessages()
  return (
    <div className="fl-nav-seg" data-locale={locale} role="group" aria-label={t.a11y.locale}>
      <span className="fl-nav-seg__thumb" aria-hidden="true" />
      {ENABLED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          className="fl-nav-seg__btn"
        >
          {code === 'ar' ? 'AR' : 'EN'}
        </button>
      ))}
    </div>
  )
}
