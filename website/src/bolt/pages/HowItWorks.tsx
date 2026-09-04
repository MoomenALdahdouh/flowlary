import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { ChromeIcon } from '@/bolt/components/icons/ChromeIcon'
import { SURFACES } from '@/bolt/data/site'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import { Reveal } from '../../components/Reveal.tsx'
import { Stagger } from '../../components/Stagger.tsx'
import { useMessages } from '../../i18n/index.tsx'

export default function HowItWorks() {
  const t = useMessages()
  const p = t.pages.productPage

  return (
    <>
      <PageHeader
        label={t.nav.howItWorks}
        title={p.title}
        subtitle={p.subtitle}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.howItWorks }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 id="control" className="text-3xl font-bold text-slate-900 dark:text-white">
              {p.surfacesTitle}
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.surfacesLead}</p>
          </Reveal>

          <Stagger className="fl-section-gap grid gap-6 md:grid-cols-2">
            {SURFACES.map((surface, i) => {
              const copy = t.pages.surfaces[surface.id]
              return (
                <div
                  key={surface.id}
                  className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-sky-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:hover:border-sky-500/40"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    <surface.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-300 dark:text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{copy.name}</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{copy.job}</p>
                  </div>
                </div>
              )
            })}
          </Stagger>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 id="actions" className="text-3xl font-bold text-slate-900 dark:text-white">
              {p.stepsTitle}
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.stepsLead}</p>
          </Reveal>

          <Stagger className="fl-section-gap space-y-4">
            {p.steps.map((s, i) => {
              const step = String(i + 1).padStart(2, '0')
              return (
                <div
                  key={step}
                  id={step === '03' ? 'repair' : step === '06' ? 'learn' : undefined}
                  className="flex gap-6 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:hover:border-sky-500/40 lg:p-8"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">{step}</div>
                  <div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.description}</p>
                  </div>
                </div>
              )
            })}
          </Stagger>

          <div className="mt-12 text-center">
            <Link to="/guide" className="btn-primary">
              <ChromeIcon className="h-4 w-4" />
              {p.openGuide}
            </Link>
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.limitsTitle}</h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.limitsLead}</p>
            </Reveal>
            <Stagger className="mt-10 grid gap-4 sm:grid-cols-2">
              {p.limits.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400 dark:bg-slate-800">
                    ✕
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{item}</span>
                </div>
              ))}
            </Stagger>
            <div className="mt-10 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-500/30 dark:bg-sky-500/10">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
              <p className="text-sm text-slate-700 dark:text-slate-300">{p.doesDo}</p>
            </div>
          </div>
        </div>
      </section>

      <CTASection title={p.ctaTitle} subtitle={p.ctaLead} primaryLabel={t.pages.chrome} secondaryLabel={t.pages.tryDemos} />
    </>
  )
}
