import { Link } from 'react-router-dom'
import { Bug, Lightbulb, MessageSquare } from 'lucide-react'
import { FeedbackHub, type FeedbackTab } from './FeedbackHub.tsx'
import { useMessages } from '../../i18n/index.tsx'
import PageHeader from '../../bolt/components/ui/PageHeader'
import CTASection from '../../bolt/components/ui/CTASection'
import FAQ from '../../bolt/components/ui/FAQ'

type FeedbackShowcaseProps = {
  initialTab?: FeedbackTab
}

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return title
  const parts = title.split(highlight)
  if (parts.length === 1) return title
  return (
    <>
      {parts[0]}
      <span className="text-gradient">{highlight}</span>
      {parts.slice(1).join(highlight)}
    </>
  )
}

export function FeedbackShowcase({ initialTab = 'feedback' }: FeedbackShowcaseProps) {
  const t = useMessages()
  const f = t.feedback

  const paths = [
    {
      id: 'feedback' as const,
      to: '/feedback',
      title: f.tabs.feedback,
      body: f.pathFeedbackBody,
      icon: MessageSquare,
    },
    {
      id: 'features' as const,
      to: '/feedback?tab=features',
      title: f.tabs.features,
      body: f.pathFeaturesBody,
      icon: Lightbulb,
    },
    {
      id: 'support' as const,
      to: '/feedback?tab=support',
      title: f.tabs.support,
      body: f.pathSupportBody,
      icon: Bug,
    },
  ]

  return (
    <>
      <PageHeader
        label={f.kicker}
        title={splitTitle(f.title, f.titleHighlight)}
        subtitle={f.lead}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.feedback }]}
        meta={
          <ul className="flex flex-wrap gap-2" aria-label={f.pathsKicker}>
            {f.heroTrust.map((item) => (
              <li
                key={item}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {item}
              </li>
            ))}
          </ul>
        }
      />

      <section className="border-b border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-950">
        <div className="container-flow">
          <p className="section-label text-center">{f.pathsKicker}</p>
          <h2 id="feedback-paths-title" className="mb-6 text-center text-2xl font-bold text-slate-900 dark:text-white">
            {f.pathsTitle}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {paths.map((path) => {
              const active = initialTab === path.id
              return (
                <Link
                  key={path.id}
                  to={path.to}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-2xl border p-5 transition-all ${
                    active
                      ? 'border-sky-300 bg-sky-50 shadow-sm dark:border-sky-500/40 dark:bg-sky-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                    <path.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{path.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{path.body}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-950" id="feedback-workspace">
        <div className="container-flow">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,0.9fr)] lg:items-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
              <FeedbackHub initialTab={initialTab} />
            </div>
            <aside className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-24">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{f.howWeUseTitle}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.howWeUseLead}</p>
              <ul className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                {f.howWeUseItems.map((item) => (
                  <li key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                    <span className="text-sky-500">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950">
        <div className="container-flow">
          <p className="section-label text-center">{f.processKicker}</p>
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900 dark:text-white">{f.processTitle}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {f.process.map((item, index) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">0{index + 1}</span>
                <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 py-16 dark:border-slate-800">
        <div className="container-flow">
          <FAQ items={[...f.faq]} title={f.faqTitle} />
        </div>
      </section>

      <CTASection
        title={f.finalTitle}
        subtitle={f.finalLead}
        primaryTo="/support"
        primaryLabel={f.supportAction}
        secondaryTo="/contact"
        secondaryLabel={f.contactAction}
      />
    </>
  )
}
