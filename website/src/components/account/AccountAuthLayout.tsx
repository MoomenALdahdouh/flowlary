import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useMessages } from '../../i18n/index.tsx'

type AccountAuthLayoutProps = {
  kicker: string
  title: string
  titleHighlight?: string
  lead?: string
  note?: ReactNode
  benefits?: readonly string[]
  benefitsTitle?: string
  trustLine?: string
  footer?: ReactNode
  wide?: boolean
  children: ReactNode
}

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

export function AccountAuthLayout({
  kicker,
  title,
  titleHighlight,
  lead,
  note,
  benefits,
  benefitsTitle,
  trustLine,
  footer,
  wide = false,
  children,
}: AccountAuthLayoutProps) {
  const t = useMessages()
  const titleParts = splitTitle(title, titleHighlight)

  return (
    <div
      className={`flex min-h-[calc(100vh-4rem)] justify-center bg-gradient-to-b from-slate-50 to-white px-5 dark:from-slate-900 dark:to-slate-950 ${
        wide ? 'items-start py-10 sm:py-14' : 'items-center py-12 sm:py-16'
      }`}
    >
      <div className={`w-full ${wide ? 'max-w-5xl' : 'max-w-[26rem]'}`}>
        <header className={`mb-6 ${wide ? 'max-w-xl' : 'text-center'}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">{kicker}</p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {titleParts.before}
            {titleParts.highlight ? <span className="text-gradient xp-gradient-text">{titleParts.highlight}</span> : null}
            {titleParts.after}
          </h1>
          {lead ? <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{lead}</p> : null}
          {trustLine ? <p className="mt-2 text-xs text-slate-500">{trustLine}</p> : null}
        </header>

        {note ? (
          <div className="mb-5 max-w-xl rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-slate-200">
            {note}
          </div>
        ) : null}

        <div className={wide ? 'grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.9fr)]' : ''}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-950 sm:p-7">
            {children}
          </div>

          {wide && benefits?.length ? (
            <aside className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/80 lg:sticky lg:top-24">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{benefitsTitle ?? t.account.createPerksTitle}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {benefits.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto border-t border-slate-200 pt-5 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.account.authLinksLabel}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.account.installQuiet}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
                  <Link to="/guide" className="text-sky-600 hover:underline dark:text-sky-400">
                    {t.account.installExtensionCta}
                  </Link>
                  <Link to="/pricing" className="text-sky-600 hover:underline dark:text-sky-400">
                    {t.account.viewPlans}
                  </Link>
                </div>
              </div>
            </aside>
          ) : null}
        </div>

        {footer ? <div className="mt-6 text-center text-sm text-slate-500">{footer}</div> : null}
      </div>
    </div>
  )
}
