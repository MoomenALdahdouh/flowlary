import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { SHORTCUTS } from '../../config.ts'
import { Button, ConversionPanel, InstallFlowlaryButton, SectionHeading } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

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

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

function splitKeys(combo: string): string[] {
  return combo.split(/(?=[⌘⇧⌥⌃])|\+/).filter(Boolean)
}

function KeyCombo({ mac, other }: { mac: string; other: string }) {
  return (
    <span className="sp-keys" aria-label={`${other} / ${mac}`}>
      {splitKeys(other).map((key) => (
        <kbd key={`o-${key}`}>{key}</kbd>
      ))}
      <span className="visually-hidden"> or </span>
      {splitKeys(mac).map((key) => (
        <kbd key={`m-${key}`}>{key}</kbd>
      ))}
    </span>
  )
}

export function SupportCenter() {
  const t = useMessages()
  const s = t.support
  const titleParts = splitTitle(s.title, s.titleHighlight)
  const [query, setQuery] = useState('')
  const [activeTopic, setActiveTopic] = useState<string>('get-flowlary')

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

  const scrollTo = useCallback((id: string) => {
    setActiveTopic(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

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
    !normalizedQuery ||
    [s.ai.title, s.ai.managed].join(' ').toLowerCase().includes(normalizedQuery)
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

  return (
    <div className="pp-page sp-page xp-support">
      <header className="sp-hero xp-hero" aria-labelledby="support-hero-title">
        <div className="container sp-hero-inner">
          <Reveal>
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {s.kicker}
            </p>
            <h1 id="support-hero-title" className="sp-hero-title mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="sp-hero-lead mh-hero-lead">{s.lead}</p>
            <div className="sp-tutorial-banner">
              <p>
                {s.tutorialBanner}{' '}
                <Link className="text-link" to="/guide">
                  {s.tutorialBannerAction}
                </Link>
              </p>
            </div>
            <div className="sp-search-wrap">
              <label className="visually-hidden" htmlFor="support-search">
                {s.searchAria}
              </label>
              <div className="sp-search-field">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.25" />
                  <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
                <input
                  id="support-search"
                  type="search"
                  className="sp-search"
                  placeholder={s.searchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </header>

      <nav className="sp-topic-nav" aria-label={s.navAria}>
        <div className="container">
          <div className="sp-nav" role="tablist">
            {s.topics.map((topic, index) => (
              <button
                key={topic.id}
                type="button"
                role="tab"
                className={`sp-nav-btn${activeTopic === topic.id ? ' is-active' : ''}`}
                aria-selected={activeTopic === topic.id}
                onClick={() => scrollTo(topic.id)}
                onKeyDown={(event) => onNavKeyDown(event, index)}
              >
                {topic.title}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {showInstall ? (
        <section className="sp-section" id="get-flowlary" aria-labelledby="sp-install-title">
          <div className="container">
            <Reveal>
              <SectionHeading
                kicker={s.kicker}
                title={s.install.title}
                lead={s.install.lead}
                titleId="sp-install-title"
              />
              <div className="sp-install-grid">
                <article className="sp-card">
                  <h3>{s.install.title}</h3>
                  <p>{s.install.body}</p>
                  <div className="sp-card-actions btn-row">
                    <InstallFlowlaryButton />
                  </div>
                </article>
                <article className="sp-card">
                  <h3>{s.shortcutsTitle}</h3>
                  <div className="sp-shortcuts">
                    <div className="sp-shortcut">
                      <span>{s.shortcutTranslate}</span>
                      <KeyCombo {...SHORTCUTS.translate} />
                    </div>
                    <div className="sp-shortcut">
                      <span>{s.shortcutLayout}</span>
                      <KeyCombo {...SHORTCUTS.fixLayout} />
                    </div>
                    <div className="sp-shortcut">
                      <span>{s.shortcutSpeed}</span>
                      <KeyCombo {...SHORTCUTS.speedBox} />
                    </div>
                  </div>
                </article>
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {filteredFeatures.length > 0 ? (
        <section className="sp-section" aria-labelledby="sp-features-title">
          <div className="container">
            <Reveal>
              <SectionHeading
                kicker={s.kicker}
                title={s.featuresTitle}
                lead={s.featuresLead}
                titleId="sp-features-title"
              />
              <div className="sp-help-list">
                {filteredFeatures.map((item) => {
                  const detailPath = FEATURE_DETAIL_PATHS[item.id]
                  return (
                    <details key={item.id} className="sp-help-item" id={item.id} open={Boolean(normalizedQuery)}>
                      <summary>{item.title}</summary>
                      <div className="sp-help-body">
                        <p>{item.summary}</p>
                        {detailPath ? (
                          <div className="sp-card-actions btn-row">
                            <Button variant="link" to={detailPath}>
                              {s.featureDetailAction}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  )
                })}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {showAccount ? (
        <section className="sp-section" id="account" aria-labelledby="sp-account-title">
          <div className="container">
            <Reveal>
              <article className="sp-card">
                <h2 id="sp-account-title">{s.account.title}</h2>
                <p>{s.account.body}</p>
                <ul className="sp-list">
                  {s.account.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="sp-card-actions btn-row">
                  <Button to="/account">{t.nav.account}</Button>
                </div>
              </article>
            </Reveal>
          </div>
        </section>
      ) : null}

      {showAi ? (
        <section className="sp-section" id="ai" aria-labelledby="sp-ai-title">
          <div className="container">
            <Reveal>
              <article className="sp-card">
                <h2 id="sp-ai-title">{s.ai.title}</h2>
                <p>{s.ai.managed}</p>
              </article>
            </Reveal>
          </div>
        </section>
      ) : null}

      {showPlans ? (
        <section className="sp-section sp-plans-band" aria-labelledby="sp-plans-title">
          <div className="container">
            <Reveal>
              <h2 id="sp-plans-title" className="visually-hidden">
                Plans and billing
              </h2>
              <div className="sp-plans-grid">
                {showTrial ? (
                  <PlanHelpCard id="trial" title={s.trial.title} body={s.trial.body} items={s.trial.items} />
                ) : null}
                {showPro ? (
                  <PlanHelpCard id="pro" title={s.pro.title} body={s.pro.body} items={s.pro.items} />
                ) : null}
                {showStudent ? (
                  <PlanHelpCard
                    id="student"
                    title={s.student.title}
                    body={s.student.body}
                    items={s.student.items}
                  />
                ) : null}
                {showBilling ? (
                  <PlanHelpCard
                    id="billing"
                    title={s.billing.title}
                    body={s.billing.body}
                    items={s.billing.items}
                  />
                ) : null}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {showPrivacy ? (
        <section className="sp-section" id="privacy" aria-labelledby="sp-privacy-title">
          <div className="container">
            <Reveal>
              <article className="sp-card">
                <h2 id="sp-privacy-title">{s.privacyHelp.title}</h2>
                <p>{s.privacyHelp.body}</p>
                <div className="sp-card-actions btn-row">
                  <Button variant="secondary" to="/privacy">
                    {s.privacyHelp.linkLabel}
                  </Button>
                </div>
              </article>
            </Reveal>
          </div>
        </section>
      ) : null}

      {filteredIssues.length > 0 ? (
        <section className="sp-section" id="troubleshooting" aria-labelledby="sp-issues-title">
          <div className="container">
            <Reveal>
              <SectionHeading kicker={s.kicker} title={s.troubleshootingTitle} titleId="sp-issues-title" />
              <div className="sp-issues">
                {filteredIssues.map((item) => (
                  <details key={item.title} className="sp-help-item" open={Boolean(normalizedQuery)}>
                    <summary>{item.title}</summary>
                    <div className="sp-help-body">
                      <div className="sp-help-meta">
                        <p>
                          <strong>{s.causeLabel.replace(':', '')}</strong>
                          {item.cause}
                        </p>
                        <p>
                          <strong>{s.checkLabel.replace(':', '')}</strong>
                          {item.check}
                        </p>
                        <p>
                          <strong>{s.nextLabel.replace(':', '')}</strong>
                          {item.next}
                        </p>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {normalizedQuery &&
      !showInstall &&
      filteredFeatures.length === 0 &&
      filteredIssues.length === 0 &&
      !showAccount &&
      !showAi &&
      !showTrial &&
      !showPro &&
      !showStudent &&
      !showBilling &&
      !showPrivacy ? (
        <div className="container">
          <p className="sp-empty" role="status">
            {s.noResults}
          </p>
        </div>
      ) : null}

      <section className="sp-section" id="contact">
        <div className="container">
          <Reveal>
            <article className="sp-card sp-contact-band">
              <h2>{s.contactTitle}</h2>
              <p>{s.contactBody}</p>
              <div className="sp-contact-actions btn-row">
                <Button to="/contact">{s.contactAction}</Button>
                <Button variant="secondary" to="/privacy">
                  {t.cta.readPrivacy}
                </Button>
                <Button variant="secondary" to="/account">
                  {t.nav.account}
                </Button>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      <ConversionPanel
        titleId="support-final-title"
        title={s.final.title}
        lead={s.final.lead}
        primary={<InstallFlowlaryButton />}
        secondary={
          <Button variant="secondary" to="/try">
            {s.final.secondary}
          </Button>
        }
      />
    </div>
  )
}

function PlanHelpCard({
  id,
  title,
  body,
  items,
}: {
  id: string
  title: string
  body: string
  items: readonly string[]
}) {
  return (
    <article className="sp-card sp-plan-card" id={id} aria-labelledby={`sp-${id}-title`}>
      <h2 id={`sp-${id}-title`}>{title}</h2>
      <p>{body}</p>
      <ul className="sp-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  )
}
