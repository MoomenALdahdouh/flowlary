import { Link } from 'react-router-dom'
import { ArrowRight, Check, X } from 'lucide-react'
import { FEATURES } from '@/bolt/data/site'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import FAQ from '@/bolt/components/ui/FAQ'
import { Stagger } from '../../../components/Stagger.tsx'
import { useMessages } from '../../../i18n/index.tsx'

const COLOR_MAP: Record<string, string> = {
  sky: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white',
  teal: 'bg-teal-50 dark:bg-teal-500/10 text-teal-500 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white',
  amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white',
  rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white',
  violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400 group-hover:bg-violet-500 group-hover:text-white',
}

export default function FeaturesOverview() {
  const t = useMessages()
  const p = t.pages.featuresPage
  const cards = t.pages.cards

  return (
    <>
      <PageHeader
        label={t.nav.features}
        title={p.title}
        subtitle={p.subtitle}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.features }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <Stagger className="grid gap-6 lg:grid-cols-2">
            {FEATURES.map((feature) => {
              const copy = cards[feature.slug]
              return (
                <Link key={feature.slug} to={`/features/${feature.slug}`} className="group card card-hover">
                  <div className="flex items-start gap-5">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${COLOR_MAP[feature.color]}`}>
                      <feature.icon className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 text-xs font-medium text-slate-400 dark:text-slate-500">{copy.tagline}</div>
                      <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{copy.title}</h3>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{copy.description}</p>
                      <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-sky-600 opacity-0 transition-opacity group-hover:opacity-100">
                        {t.pages.readMore}
                        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </Stagger>

          <Stagger className="fl-section-gap grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-700 dark:bg-slate-950">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{p.doesNotTitle}</h2>
              <div className="mt-6 grid gap-3">
                {p.doesNot.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <X className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-700 dark:bg-slate-950">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{p.tiesTitle}</h2>
              <div className="mt-6 grid gap-4">
                {p.ties.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Stagger>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-900">
        <div className="container-flow">
          <FAQ items={[...t.pages.faq.slice(0, 6)]} />
        </div>
      </section>

      <div className="container-flow pb-8 text-center">
        <Link to="/product" className="text-sm font-semibold text-sky-600 dark:text-sky-400">
          {p.oneProduct}
        </Link>
      </div>
      <CTASection />
    </>
  )
}
