import type { ReactNode } from 'react'
import PageHeader from '../../bolt/components/ui/PageHeader'
import { useMessages } from '../../i18n/index.tsx'

type LegalPageShellProps = {
  kicker: string
  title: string
  titleHighlight?: string
  lead: string
  effectiveIso: string
  effectiveLabel: string
  effectiveLabelText: string
  children: ReactNode
}

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return title
  const parts = title.split(highlight)
  if (parts.length === 1) return title
  return (
    <>
      {parts[0]}
      <span className="text-gradient">{highlight}</span>
      {parts.slice(1).join(highlight)}
    </>
  )
}

export function LegalPageShell({
  kicker,
  title,
  titleHighlight,
  lead,
  effectiveIso,
  effectiveLabel,
  effectiveLabelText,
  children,
}: LegalPageShellProps) {
  const t = useMessages()
  return (
    <div className="lg-page">
      <PageHeader
        label={kicker}
        title={splitTitle(title, titleHighlight)}
        subtitle={lead}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: title }]}
        meta={
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <strong className="font-semibold text-slate-500 dark:text-slate-400">{effectiveLabelText}</strong>
            <time dateTime={effectiveIso}>{effectiveLabel}</time>
          </span>
        }
      />
      <section className="py-16 lg:py-20">{children}</section>
    </div>
  )
}
