import { PenLine, Keyboard, Languages, ArrowRight, Heart, Users, Target } from 'lucide-react'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import { useMessages } from '../../i18n/index.tsx'

const VALUE_ICONS = [Heart, Users, Target]
const TEAM_ICONS = [Keyboard, PenLine, Languages]

export default function About() {
  const t = useMessages()
  const p = t.pages.aboutPage

  return (
    <>
      <PageHeader
        label={t.nav.about}
        title={p.title}
        subtitle={p.subtitle}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.about }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.storyTitle}</h2>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              {p.story.map((para) => (
                <p key={para}>{para}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.believeTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.believeLead}</p>
          </div>
          <div className="fl-section-gap grid gap-6 md:grid-cols-3">
            {p.values.map((value, i) => {
              const Icon = VALUE_ICONS[i]
              return (
                <div key={value.title} className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-950">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-500 dark:bg-sky-500/10">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{value.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{value.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.claimTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.claimLead}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {p.pairs.map((item) => (
                <div key={item.not} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-400">{t.pages.not}</div>
                    <div className="text-sm text-slate-500 line-through">{item.not}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-400">{t.pages.but}</div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.is}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.teamTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.teamLead}</p>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8">
              {p.team.map((label, i) => {
                const Icon = TEAM_ICONS[i]
                return (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-sky-500 shadow-sm dark:bg-slate-950">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <CTASection title={p.ctaTitle} subtitle={p.ctaLead} primaryLabel={t.pages.chrome} secondaryLabel={t.pages.readBlog} secondaryTo="/blog" />
    </>
  )
}
