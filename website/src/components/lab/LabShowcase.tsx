import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Sparkles, RefreshCw } from 'lucide-react'
import { FidelityBadge } from '../Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import PageHeader from '../../bolt/components/ui/PageHeader'
import CTASection from '../../bolt/components/ui/CTASection'

const FEATURE_ICONS = [Sparkles, BookOpen, RefreshCw]

export function LabShowcase({ workspace }: { workspace: ReactNode }) {
  const t = useMessages()
  const copy = t.labPage
  const titleParts = copy.title.split(copy.titleHighlight)

  return (
    <>
      <PageHeader
        label={copy.kicker}
        title={
          <>
            {titleParts[0]}
            <span className="text-gradient">{copy.titleHighlight}</span>
            {titleParts.slice(1).join(copy.titleHighlight)}
          </>
        }
        subtitle={copy.lead}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: copy.kicker }]}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <FidelityBadge mode="live" />
            <p className="hidden max-w-xl text-sm text-slate-500 sm:block dark:text-slate-400">{copy.disclaimer}</p>
          </div>
        }
      />

      <section className="border-b border-amber-200 bg-amber-50 py-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="container-flow">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>{copy.disclaimer}</strong>
          </p>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-950">
        <div className="container-flow">
          <div className="grid gap-4 md:grid-cols-3">
            {copy.features.map((item, index) => {
              const Icon = FEATURE_ICONS[index] ?? Sparkles
              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.body}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-950" aria-labelledby="lab-workspace-title">
        <div className="container-flow">
          <p className="section-label">{copy.workspaceKicker}</p>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="lab-workspace-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                {copy.workspaceTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{copy.workspaceLead}</p>
            </div>
            <FidelityBadge mode="live" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {workspace}
          </div>
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            {copy.tryCompare}{' '}
            <Link to="/try" className="font-semibold text-sky-600 dark:text-sky-400">
              {copy.tryCompareAction}
            </Link>
          </p>
        </div>
      </section>

      <CTASection
        title={copy.finalTitle}
        subtitle={copy.finalLead}
        primaryTo="/guide"
        secondaryTo="/account"
        secondaryLabel={t.writingLab.viewProgress}
      />
    </>
  )
}
