import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../bolt/components/layout/Navbar'
import Footer from '../bolt/components/layout/Footer'
import { ScrollProgress } from '../bolt/components/layout/ScrollProgress.tsx'
import { DocumentHead } from './DocumentHead.tsx'
import { ScrollManager } from './ScrollManager.tsx'
import { LegacyHashRedirect } from './LegacyHashRedirect.tsx'
import { CookieBanner } from './cookies/CookieBanner.tsx'
import { SectionMotion } from './SectionMotion.tsx'
import { useI18n, useMessages } from '../i18n/index.tsx'

export function Layout() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const { pathname } = useLocation()
  const isApp = pathname.startsWith('/dashboard') || pathname.startsWith('/admin')

  return (
    <div
      className={`flex min-h-screen flex-col bg-[var(--fl-bg)] text-[var(--fl-text)]${isApp ? ' layout-app' : ''}`}
      lang={locale}
      dir={direction}
    >
      <LegacyHashRedirect />
      <ScrollManager />
      {isApp ? null : <SectionMotion />}
      <DocumentHead />
      <a className="skip-link" href="#content">
        {t.a11y.skip}
      </a>
      {isApp ? null : <Navbar />}
      {isApp ? null : <ScrollProgress />}
      <main id="content" className={isApp ? 'flex-1' : 'flex-1 pt-14 sm:pt-16'}>
        <Outlet />
      </main>
      {isApp ? null : <Footer />}
      <CookieBanner />
    </div>
  )
}
