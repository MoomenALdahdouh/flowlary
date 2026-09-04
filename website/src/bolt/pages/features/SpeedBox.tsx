import { Box, Check, Keyboard, Zap } from 'lucide-react'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import { useMessages } from '../../../i18n/index.tsx'

export default function SpeedBox() {
  const t = useMessages()
  const p = t.pages.speedPage

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
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.manualTitle}</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{p.manualLead}</p>
              <ul className="mt-8 space-y-3">
                {p.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-400">Google Docs</div>
                <div className="p-6">
                  <p className="text-sm text-slate-400">{p.yourText}</p>
                  <p className="mt-1 font-arabic text-lg text-slate-800 dark:text-slate-200" dir="auto">
                    wfhp hgod
                  </p>
                </div>
              </div>
              <div className="absolute end-8 top-32 w-64 animate-fade-up rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Box className="h-3.5 w-3.5 text-violet-500" />
                  {p.title}
                </div>
                <div className="space-y-2">
                  <button className="flex w-full items-center justify-between rounded-lg bg-violet-50 px-3 py-2 text-start text-sm text-slate-700 dark:bg-violet-500/10">
                    <span className="font-arabic" dir="auto">صباح الخي</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-500 text-xs font-bold text-white">1</span>
                  </button>
                  <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm text-slate-600">
                    <span className="font-arabic" dir="auto">صبا حلك</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-xs font-bold text-slate-600">2</span>
                  </button>
                  <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm text-slate-600">
                    <span>{p.keep}</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-xs font-bold text-slate-600">3</span>
                  </button>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-2 text-center text-xs text-slate-400">{p.press}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-start gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Zap className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{p.whyTitle}</h2>
                {p.why.map((para) => (
                  <p key={para} className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.shortcutsTitle}</h2>
            <div className="mt-8 space-y-3">
              {p.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.action}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-950"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-300">{shortcut.action}</span>
                  <div className="flex items-center gap-1.5">
                    {shortcut.keys.map((key) => (
                      <kbd
                        key={key}
                        className="flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-600 dark:border-slate-700"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900">
              <Keyboard className="h-5 w-5 text-slate-400" />
              {p.custom}
            </div>
          </div>
        </div>
      </section>

      <CTASection title={p.ctaTitle} subtitle={p.ctaLead} />
    </>
  )
}
