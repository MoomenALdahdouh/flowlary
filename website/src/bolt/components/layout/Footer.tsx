import { Link } from 'react-router-dom'
import Logo from './Logo'
import { CookieSettingsButton } from '../../../components/cookies/CookieBanner.tsx'
import { useMessages } from '../../../i18n/index.tsx'

export default function Footer() {
  const t = useMessages()
  const p = t.pages
  const sections = [
    {
      title: t.footer.product,
      links: [
        { label: t.nav.howItWorks, to: '/product' },
        { label: t.nav.features, to: '/features' },
        { label: p.tryDemos, to: '/try' },
        { label: p.writingLab, to: '/lab' },
        { label: p.installGuide, to: '/guide' },
        { label: t.nav.pricing, to: '/pricing' },
      ],
    },
    {
      title: t.nav.features,
      links: [
        { label: p.cards['keyboard-layout'].title, to: '/features/keyboard-layout' },
        { label: p.cards['writing-correction'].title, to: '/features/writing-correction' },
        { label: p.cards.translation.title, to: '/features/translation' },
        { label: p.cards['live-translation'].title, to: '/features/live-translation' },
        { label: p.cards['speed-box'].title, to: '/features/speed-box' },
      ],
    },
    {
      title: p.company,
      links: [
        { label: t.nav.about, to: '/about' },
        { label: p.blogStories, to: '/blog' },
        { label: t.nav.contact, to: '/contact' },
        { label: t.nav.feedback, to: '/feedback' },
        { label: t.nav.support, to: '/support' },
      ],
    },
    {
      title: t.nav.account,
      links: [
        { label: t.nav.signIn, to: '/account' },
        { label: p.createAccount, to: '/account?mode=register' },
        { label: p.forgotPassword, to: '/account/forgot-password' },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { label: t.nav.privacy, to: '/privacy' },
        { label: t.nav.terms, to: '/terms' },
        { label: t.nav.cookies, to: '/cookies' },
      ],
    },
  ]

  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <div className="container-flow py-20">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{p.footerBlurb}</p>
          </div>

          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="mb-3 text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 rtl:tracking-normal ltr:uppercase">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-slate-600 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} Flowlary. {p.footerRights}
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
              {t.nav.privacy}
            </Link>
            <Link to="/terms" className="text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
              {t.nav.terms}
            </Link>
            <Link to="/cookies" className="text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
              {t.nav.cookies}
            </Link>
            <CookieSettingsButton className="bg-transparent p-0 text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400" />
          </div>
        </div>
      </div>
    </footer>
  )
}
