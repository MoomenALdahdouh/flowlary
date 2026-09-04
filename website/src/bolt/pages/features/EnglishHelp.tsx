import { PenLine, Check, ArrowRight, Eye, BookOpen } from 'lucide-react'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import { useMessages } from '../../../i18n/index.tsx'

export default function EnglishHelp() {
  const t = useMessages()
  const p = t.pages.englishPage

  return (
    <>
      <PageHeader
        label={t.pages.feature}
        title={p.title}
        subtitle={p.subtitle}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.features, to: '/features' }, { label: p.title }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.reviewTitle}</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{p.reviewLead}</p>
              <ul className="mt-8 space-y-3">
                {p.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-400 dark:border-slate-700">
                {p.demoBar} · {p.untitled}
              </div>
              <div className="p-6">
                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  I am writing to inform you that the meeting has been{' '}
                  <span className="relative cursor-pointer border-b-2 border-amber-400 bg-amber-50 dark:bg-amber-500/10">
                    postpond
                    <span className="absolute -top-12 left-0 z-10 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                      postpond → postponed
                      <span className="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-slate-900" />
                    </span>
                  </span>{' '}
                  to next <span className="border-b-2 border-amber-400 bg-amber-50 dark:bg-amber-500/10">weak</span>. Please let me know if{' '}
                  <span className="border-b-2 border-sky-400 bg-sky-50 dark:bg-sky-500/10">their</span> is a better time.
                </p>
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white">{p.accept}</button>
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700">{p.dismiss}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.kindsTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.kindsLead}</p>
          </div>
          <div className="fl-section-gap grid gap-6 md:grid-cols-3">
            {p.kinds.map((type) => (
              <div key={type.title} className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-950">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-500 dark:bg-teal-500/10">
                  <PenLine className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{type.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{type.desc}</p>
                <div className="space-y-1.5">
                  {type.examples.map((ex) => (
                    <div key={ex} className="rounded-lg bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600 dark:bg-slate-900">
                      {ex}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-start gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Eye className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{p.principleTitle}</h2>
                {p.principle.map((para) => (
                  <p key={para} className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950">
            <BookOpen className="h-8 w-8 text-teal-500" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{p.labTitle}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{p.labLead}</p>
            </div>
            <a href="/lab" className="btn-secondary">
              {p.openLab}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <CTASection title={p.ctaTitle} subtitle={p.ctaLead} />
    </>
  )
}
