import { Languages, Check, ArrowRight } from 'lucide-react'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import { useMessages } from '../../../i18n/index.tsx'

export default function Translation() {
  const t = useMessages()
  const p = t.pages.translationPage

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
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.selectTitle}</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{p.selectLead}</p>
              <ul className="mt-8 space-y-3">
                {p.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-400">WhatsApp Web</div>
              <div className="p-6">
                <div className="mb-4">
                  <div className="mb-1 text-xs font-medium text-slate-400">{p.selected}</div>
                  <div className="rounded-lg bg-slate-50 p-3 font-arabic text-base text-slate-800 dark:bg-slate-900" dir="auto">
                    سأرسل لك التقرير غداً صباحاً
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600 dark:bg-amber-500/10">
                    <Languages className="h-3.5 w-3.5" />
                    {p.translating}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1 text-xs font-medium text-slate-400">{p.translation}</div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-base text-slate-800 dark:border-amber-500/30 dark:bg-amber-500/10">
                    I will send you the report tomorrow morning
                  </div>
                </div>
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white">{p.insert}</button>
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
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.whenTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.whenLead}</p>
          </div>
          <div className="fl-section-gap grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-8 dark:border-green-500/30 dark:bg-green-500/10">
              <h3 className="mb-4 text-lg font-semibold text-green-800 dark:text-green-400">{p.useWhen}</h3>
              <ul className="space-y-3">
                {p.useItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-950">
              <h3 className="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">{p.skipWhen}</h3>
              <ul className="space-y-3">
                {p.skipItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <span className="mt-0.5 h-5 w-5 shrink-0 text-slate-300">○</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950">
            <Languages className="h-8 w-8 text-amber-500" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{p.liveTitle}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{p.liveLead}</p>
            </div>
            <a href="/features/live-translation" className="btn-secondary">
              {p.learnLive}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <CTASection title={p.ctaTitle} subtitle={p.ctaLead} />
    </>
  )
}
