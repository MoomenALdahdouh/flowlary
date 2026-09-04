import { Pin, Check, ArrowRight, MousePointer2, Keyboard as KeyboardIcon, Zap } from 'lucide-react'
import { ChromeIcon } from '@/bolt/components/icons/ChromeIcon'
import { Link } from 'react-router-dom'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import { useMessages } from '../../i18n/index.tsx'

const STEP_ICONS = [ChromeIcon, Pin, MousePointer2, KeyboardIcon]

export default function InstallGuide() {
  const t = useMessages()
  const p = t.pages.guidePage

  return (
    <>
      <PageHeader
        label={t.pages.installGuide}
        title={p.title}
        subtitle={p.subtitle}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.pages.installGuide }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl space-y-6">
            {p.steps.map((step, i) => {
              const Icon = STEP_ICONS[i]
              return (
                <div key={step.title} className="flex gap-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-950 lg:p-8">
                  <div className="flex flex-col items-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-500/10">
                      <Icon className="h-7 w-7" />
                    </div>
                    {i < p.steps.length - 1 && <div className="mt-2 h-full w-px flex-1 bg-slate-100 dark:bg-slate-800" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="mb-1 text-xs font-bold text-slate-300 dark:text-slate-600">{p.step.replace('{n}', String(i + 1))}</div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.description}</p>
                    <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      <span className="text-xs text-slate-500">{step.tip}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-500/30 dark:bg-green-500/10">
            <Check className="mx-auto mb-3 h-10 w-10 text-green-500" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{p.firstWinTitle}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{p.firstWinLead}</p>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.shortcutsTitle}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{p.shortcutsLead}</p>
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
                        className="flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">{p.shortcutsNote}</p>
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{p.troubleTitle}</h2>
            <div className="mt-8 space-y-4">
              {p.trouble.map((item) => (
                <details key={item.q} className="group rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
                  <summary className="list-none cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">
                    {item.q}
                    <ArrowRight className="ms-2 inline h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-90 rtl:group-open:-rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link to="/support" className="text-sm font-semibold text-sky-600 hover:text-sky-500">
                {p.moreHelp}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title={p.ctaTitle}
        subtitle={p.ctaLead}
        primaryTo="/try"
        primaryLabel={t.pages.tryDemos}
        secondaryTo="/lab"
        secondaryLabel={t.pages.writingLab}
      />
    </>
  )
}
