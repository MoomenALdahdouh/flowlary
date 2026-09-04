import { Zap, Check, Eye, EyeOff } from 'lucide-react'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import { useMessages } from '../../../i18n/index.tsx'

export default function LiveTranslation() {
  const t = useMessages()
  const p = t.pages.livePage

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
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                    <EyeOff className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{p.offTitle}</div>
                    <div className="text-xs text-slate-500">{p.offLead}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-500">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{p.toggleTitle}</div>
                    <div className="text-xs text-slate-500">{p.toggleLead}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700">
                <span className="text-xs text-slate-400">{p.compose}</span>
                <div className="flex items-center gap-2 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-500 dark:bg-rose-500/10">
                  <Zap className="h-3 w-3" />
                  {p.liveOn}
                </div>
              </div>
              <div className="p-6">
                <div className="mb-3">
                  <div className="font-arabic text-lg leading-relaxed text-slate-800 dark:text-slate-200" dir="auto">
                    شكراً على رسالتك، سأرد عليك قريباً
                    <span className="animate-blink text-sky-500">|</span>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="text-xs font-medium text-slate-400">{p.preview}</div>
                  <div className="mt-1 text-sm italic leading-relaxed text-slate-500">Thank you for your message, I will reply to you soon</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.whenTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.whenLead}</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-500/30 dark:bg-green-500/10">
                <h3 className="mb-3 text-base font-semibold text-green-800 dark:text-green-400">{p.helps}</h3>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {p.helpItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-950">
                <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-300">{p.distracts}</h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {p.distractItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 h-4 w-4 shrink-0 text-slate-300">○</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection title={p.ctaTitle} subtitle={p.ctaLead} />
    </>
  )
}
