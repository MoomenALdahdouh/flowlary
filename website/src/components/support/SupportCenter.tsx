import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { SHORTCUTS } from '../../config.ts'
import { InstallFlowlaryButton } from '../Ui.tsx'
import { useActiveSection } from '../../hooks/useActiveSection.ts'
import { useMessages } from '../../i18n/index.tsx'
import PageHeader from '../../bolt/components/ui/PageHeader'
import CTASection from '../../bolt/components/ui/CTASection'

const TOPIC_IDS = [
  'get-flowlary',
  'writing-correction',
  'translation',
  'live-translation',
  'keyboard-layout',
  'speed-box',
  'ai',
  'account',
  'trial',
  'pro',
  'student',
  'billing',
  'privacy',
  'troubleshooting',
] as const

const FEATURE_DETAIL_PATHS: Record<string, string> = {
  'writing-correction': '/features/writing-correction',
  translation: '/features/translation',
  'live-translation': '/features/live-translation',
  'keyboard-layout': '/features/keyboard-layout',
  'speed-box': '/features/speed-box',
}

function splitKeys(combo: string): string[] {
  return combo.split(/(?=[⌘⇧⌥⌃])|\+/).filter(Boolean)
}

function KeyCombo({ mac, other }: { mac: string; other: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" aria-label={`${other} / ${mac}`}>
      {splitKeys(other).map((key) => (
        <kbd
          key={`o-${key}`}
          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {key}
        </kbd>
      ))}
      <span className="visually-hidden"> or </span>
      {splitKeys(mac).map((key) => (
        <kbd
          key={`m-${key}`}
          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}

function HelpCard({
  id,
  title,
  body,
  items,
  action,
}: {
  id: string
  title: string
  body: string
  items?: readonly string[]
  action?: { to: string; label: string }
}) {
  return (
    <article
      id={id}
      className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-sky-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500/40"
      aria-labelledby={`sp-${id}-title`}
    >
      <h2 id={`sp-${id}-title`} className="text-lg font-semibold text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
      {items?.length ? (
        <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-slate-600 dark:text-slate-300">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {action ? (
        <Link to={action.to} className="btn-secondary mt-5 text-sm">
          {action.label}
        </Link>
      ) : null}
    </article>
  )
}

export function SupportCenter() {
  const t = useMessages()
  const s = t.support
  const [query, setQuery] = useState('')
  const { activeId: activeTopic, activate } = useActiveSection(TOPIC_IDS)

  const normalizedQuery = query.trim().toLowerCase()

  const featureHelp = useMemo(
    () => s.features.filter((item) => item.id !== 'get-flowlary'),
    [s.features],
  )

  const filteredFeatures = useMemo(() => {
    if (!normalizedQuery) return featureHelp
    return featureHelp.filter((item) =>
      [item.title, item.summary, item.how, item.limit, item.action ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [featureHelp, normalizedQuery])

  const filteredIssues = useMemo(() => {
    if (!normalizedQuery) return s.issues
    return s.issues.filter((item) =>
      [item.title, item.cause, item.check, item.next].join(' ').toLowerCase().includes(normalizedQuery),
    )
  }, [normalizedQuery, s.issues])

  const scrollTo = useCallback(
    (id: string) => {
      activate(id)
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [activate],
  )

  function onNavKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') {
      scrollTo(TOPIC_IDS[0])
      return
    }
    if (event.key === 'End') {
      scrollTo(TOPIC_IDS[TOPIC_IDS.length - 1])
      return
    }
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + delta + TOPIC_IDS.length) % TOPIC_IDS.length
    scrollTo(TOPIC_IDS[next])
  }

  const showInstall = !normalizedQuery || s.install.body.toLowerCase().includes(normalizedQuery)
  const showAccount =
    !normalizedQuery ||
    [s.account.title, s.account.body, ...s.account.items].join(' ').toLowerCase().includes(normalizedQuery)
  const showAi =
    !normalizedQuery || [s.ai.title, s.ai.managed].join(' ').toLowerCase().includes(normalizedQuery)
  const showTrial =
    !normalizedQuery ||
    [s.trial.title, s.trial.body, ...s.trial.items].join(' ').toLowerCase().includes(normalizedQuery)
  const showPro =
    !normalizedQuery || [s.pro.title, s.pro.body, ...s.pro.items].join(' ').toLowerCase().includes(normalizedQuery)
  const showStudent =
    !normalizedQuery ||
    [s.student.title, s.student.body, ...s.student.items].join(' ').toLowerCase().includes(normalizedQuery)
  const showBilling =
    !normalizedQuery ||
    [s.billing.title, s.billing.body, ...s.billing.items].join(' ').toLowerCase().includes(normalizedQuery)
  const showPrivacy =
    !normalizedQuery || [s.privacyHelp.title, s.privacyHelp.body].join(' ').toLowerCase().includes(normalizedQuery)
  const showPlans = showTrial || showPro || showStudent || showBilling
  const noResults =
    Boolean(normalizedQuery) &&
    !showInstall &&
    filteredFeatures.length === 0 &&
    filteredIssues.length === 0 &&
    !showAccount &&
    !showAi &&
    !showTrial &&
    !showPro &&
    !showStudent &&
    !showBilling &&
    !showPrivacy

  return (
    <>
      <PageHeader
        label={s.kicker}
        title={s.title}
        subtitle={s.lead}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.support }]}
        meta={
          <div className="max-w-2xl space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {s.tutorialBanner}{' '}
              <Link className="font-semibold text-sky-600 dark:text-sky-400" to="/guide">
                {s.tutorialBannerAction}
              </Link>
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <label className="visually-hidden" htmlFor="support-search">
                {s.searchAria}
              </label>
              <input
                id="support-search"
                type="search"
                className="field-input rounded-full py-4 ps-11"
                placeholder={s.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        }
      />

      <nav
        className="sticky top-16 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
        aria-label={s.navAria}
      >
        <div className="container-flow overflow-x-auto py-3">
          <div className="flex min-w-max gap-2" role="tablist">
            {s.topics.map((topic, index) => {
              const active = activeTopic === topic.id
              return (
                <button
                  key={topic.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => scrollTo(topic.id)}
                  onKeyDown={(event) => onNavKeyDown(event, index)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/40 dark:hover:text-sky-400'
                  }`}
                >
                  {topic.title}
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="bg-slate-50 py-14 dark:bg-slate-950 lg:py-20">
        <div className="container-flow max-w-4xl space-y-12">
          {showInstall ? (
            <section id="get-flowlary" className="scroll-mt-28 space-y-4" aria-labelledby="sp-install-title">
              <div>
                <h2 id="sp-install-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                  {s.install.title}
                </h2>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{s.install.lead}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">{s.install.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.install.body}</p>
                  <div className="mt-5">
                    <InstallFlowlaryButton />
                  </div>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">{s.shortcutsTitle}</h3>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{s.shortcutTranslate}</span>
                      <KeyCombo {...SHORTCUTS.translate} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{s.shortcutLayout}</span>
                      <KeyCombo {...SHORTCUTS.fixLayout} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{s.shortcutSpeed}</span>
                      <KeyCombo {...SHORTCUTS.speedBox} />
                    </div>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {filteredFeatures.length > 0 ? (
            <section aria-labelledby="sp-features-title" className="space-y-4">
              <div>
                <h2 id="sp-features-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                  {s.featuresTitle}
                </h2>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{s.featuresLead}</p>
              </div>
              <div className="space-y-4">
                {filteredFeatures.map((item) => {
                  const detailPath = FEATURE_DETAIL_PATHS[item.id]
                  return (
                    <article
                      key={item.id}
                      id={item.id}
                      className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.summary}</p>
                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="font-semibold text-slate-800 dark:text-slate-100">{s.howLabel.replace(':', '')}</dt>
                          <dd className="mt-1 text-slate-600 dark:text-slate-300">{item.how}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-800 dark:text-slate-100">{s.limitLabel.replace(':', '')}</dt>
                          <dd className="mt-1 text-slate-600 dark:text-slate-300">{item.limit}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-800 dark:text-slate-100">{s.actionLabel.replace(':', '')}</dt>
                          <dd className="mt-1 text-slate-600 dark:text-slate-300">{item.action}</dd>
                        </div>
                      </dl>
                      {detailPath ? (
                        <Link to={detailPath} className="mt-5 inline-block text-sm font-semibold text-sky-600 dark:text-sky-400">
                          {s.featureDetailAction}
                        </Link>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          {showAccount ? (
            <HelpCard
              id="account"
              title={s.account.title}
              body={s.account.body}
              items={s.account.items}
              action={{ to: '/account', label: t.nav.account }}
            />
          ) : null}

          {showAi ? <HelpCard id="ai" title={s.ai.title} body={s.ai.managed} /> : null}

          {showPlans ? (
            <section aria-labelledby="sp-plans-title" className="space-y-4">
              <h2 id="sp-plans-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                {s.billing.title}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {showTrial ? <HelpCard id="trial" title={s.trial.title} body={s.trial.body} items={s.trial.items} /> : null}
                {showPro ? <HelpCard id="pro" title={s.pro.title} body={s.pro.body} items={s.pro.items} /> : null}
                {showStudent ? (
                  <HelpCard id="student" title={s.student.title} body={s.student.body} items={s.student.items} />
                ) : null}
                {showBilling ? (
                  <HelpCard
                    id="billing"
                    title={s.billing.title}
                    body={s.billing.body}
                    items={s.billing.items}
                    action={{ to: '/pricing', label: t.nav.pricing }}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {showPrivacy ? (
            <HelpCard
              id="privacy"
              title={s.privacyHelp.title}
              body={s.privacyHelp.body}
              action={{ to: '/privacy', label: s.privacyHelp.linkLabel }}
            />
          ) : null}

          {filteredIssues.length > 0 ? (
            <section id="troubleshooting" className="scroll-mt-28 space-y-4" aria-labelledby="sp-issues-title">
              <h2 id="sp-issues-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                {s.troubleshootingTitle}
              </h2>
              <div className="space-y-3">
                {filteredIssues.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-slate-100">{s.causeLabel.replace(':', '')}</dt>
                        <dd className="mt-0.5 text-slate-600 dark:text-slate-300">{item.cause}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-slate-100">{s.checkLabel.replace(':', '')}</dt>
                        <dd className="mt-0.5 text-slate-600 dark:text-slate-300">{item.check}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-slate-100">{s.nextLabel.replace(':', '')}</dt>
                        <dd className="mt-0.5 text-slate-600 dark:text-slate-300">{item.next}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {noResults ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900" role="status">
              {s.noResults}
            </p>
          ) : null}

          <section aria-labelledby="sp-hub-title" className="space-y-4">
            <div>
              <h2 id="sp-hub-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                {s.hubTitle}
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-300">{s.hubLead}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {s.hubActions.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-sky-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500/40"
                >
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.body}</p>
                </Link>
              ))}
            </div>
          </section>

          <section
            id="contact"
            className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:p-8"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{s.contactTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.contactBody}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/contact" className="btn-primary text-sm">
                {s.contactAction}
              </Link>
              <Link to="/privacy" className="btn-secondary text-sm">
                {t.cta.readPrivacy}
              </Link>
              <Link to="/account" className="btn-secondary text-sm">
                {t.nav.account}
              </Link>
            </div>
          </section>
        </div>
      </div>

      <CTASection
        title={s.final.title}
        subtitle={s.final.lead}
        primaryTo="/guide"
        primaryLabel={t.cta.install}
        secondaryTo="/try"
        secondaryLabel={s.final.secondary}
      />
    </>
  )
}
