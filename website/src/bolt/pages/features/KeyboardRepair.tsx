import { Link } from 'react-router-dom'
import { Check, ArrowRight, Zap, Shield } from 'lucide-react'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import KeyboardRepairDemo from '@/bolt/components/demos/KeyboardRepairDemo'
import { useMessages } from '../../../i18n/index.tsx'

export default function KeyboardRepair() {
  const t = useMessages()
  const p = t.pages.keyboardPage

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
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.seeTitle}</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{p.seeLead}</p>
              <ul className="mt-8 space-y-3">
                {p.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <KeyboardRepairDemo />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.howTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.howLead}</p>
          </div>
          <div className="fl-section-gap grid gap-6 md:grid-cols-3">
            {p.how.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-950">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">{i + 1}</div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.lookTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.lookLead}</p>
          </div>
          <div className="mx-auto mt-12 max-w-3xl space-y-4">
            {p.examples.map((ex) => (
              <div key={ex.wrong} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-950 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="mb-1 text-xs font-medium text-slate-400">{p.wrong}</div>
                  <div className="font-arabic text-lg text-rose-500" dir="auto">{ex.wrong}</div>
                </div>
                <ArrowRight className="hidden h-5 w-5 text-slate-300 rtl:rotate-180 sm:block" />
                <ArrowRight className="flex h-5 w-5 text-slate-300 rtl:rotate-180 sm:hidden" />
                <div className="flex-1">
                  <div className="mb-1 text-xs font-medium text-slate-400">{p.repaired}</div>
                  <div className="font-arabic text-lg text-green-600" dir="auto">{ex.right}</div>
                </div>
                <div className="sm:w-48">
                  <div className="text-xs text-slate-400">{ex.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl text-center">
            <Shield className="mx-auto mb-4 h-10 w-10 text-sky-400" />
            <h2 className="text-2xl font-bold text-white">{p.localTitle}</h2>
            <p className="mt-4 text-lg text-slate-300">{p.localLead}</p>
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950">
            <Zap className="h-8 w-8 text-sky-500" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{p.speedTitle}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{p.speedLead}</p>
            </div>
            <Link to="/features/speed-box" className="btn-secondary">
              {p.learnSpeed}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <CTASection title={p.ctaTitle} subtitle={p.ctaLead} />
    </>
  )
}
