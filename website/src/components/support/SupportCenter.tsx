import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { SHORTCUTS } from '../../config.ts'
import { Button, GetFlowlaryButton } from '../Ui.tsx'
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

  return (
    <div className="pp-page sp-page">
      <header className="pp-hero">
        <div className="container pp-hero-inner">
          <Reveal>
            <p className="kicker">{s.kicker}</p>
            <h1>{s.title}</h1>
            <p className="lead">{s.lead}</p>
            <div className="sp-tutorial-banner pp-glass">
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
          </Reveal>
        </div>
      </header>

      <div className="container">
        <div className="sp-nav-wrap">
          <div className="sp-nav" role="tablist" aria-label={s.navAria}>
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
      </div>

      {showInstall ? (
        <section className="sp-section" id="get-flowlary" aria-labelledby="sp-install-title">
          <div className="container">
            <Reveal>
              <div className="sp-section-head">
                <h2 id="sp-install-title">{s.install.title}</h2>
                <p>{s.install.lead}</p>
              </div>
              <div className="sp-install-grid">
                <article className="pp-glass sp-card">
                  <h3>{s.install.title}</h3>
                  <p>{s.install.body}</p>
                  <div className="btn-row" style={{ marginTop: '1rem' }}>
                    <GetFlowlaryButton />
                  </div>
                </article>
                <article className="pp-glass sp-card">
                  <h3>{s.shortcutsTitle}</h3>
                  <div className="sp-shortcuts" style={{ marginTop: '0.75rem' }}>
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
              <div className="sp-section-head">
                <h2 id="sp-features-title">{s.featuresTitle}</h2>
                <p>{s.featuresLead}</p>
              </div>
              <div className="sp-help-list">
                {filteredFeatures.map((item) => (
                  <details key={item.id} className="sp-help-item" id={item.id} open={Boolean(normalizedQuery)}>
                    <summary>{item.title}</summary>
                    <div className="sp-help-body">
                      <p>{item.summary}</p>
                      <p>
                        <strong>{s.howLabel}</strong> {item.how}
                      </p>
                      <p>
                        <strong>{s.limitLabel}</strong> {item.limit}
                      </p>
                      {item.action ? (
                        <p>
                          <strong>{s.actionLabel}</strong> {item.action}
                        </p>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {showAccount ? (
        <section className="sp-section" id="account" aria-labelledby="sp-account-title">
          <div className="container">
            <Reveal>
              <article className="pp-glass sp-card">
                <h2 id="sp-account-title">{s.account.title}</h2>
                <p>{s.account.body}</p>
                <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem', color: 'var(--fl-muted)', fontSize: '0.9rem' }}>
                  {s.account.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="btn-row" style={{ marginTop: '1rem' }}>
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
              <article className="pp-glass sp-card">
                <h2 id="sp-ai-title">{s.ai.title}</h2>
                <p>{s.ai.managed}</p>
              </article>
            </Reveal>
          </div>
        </section>
      ) : null}

      {showTrial ? (
        <PlanHelpSection id="trial" title={s.trial.title} body={s.trial.body} items={s.trial.items} />
      ) : null}

      {showPro ? <PlanHelpSection id="pro" title={s.pro.title} body={s.pro.body} items={s.pro.items} /> : null}

      {showStudent ? (
        <PlanHelpSection id="student" title={s.student.title} body={s.student.body} items={s.student.items} />
      ) : null}

      {showBilling ? (
        <PlanHelpSection id="billing" title={s.billing.title} body={s.billing.body} items={s.billing.items} />
      ) : null}

      {showPrivacy ? (
        <section className="sp-section" id="privacy" aria-labelledby="sp-privacy-title">
          <div className="container">
            <Reveal>
              <article className="pp-glass sp-card">
                <h2 id="sp-privacy-title">{s.privacyHelp.title}</h2>
                <p>{s.privacyHelp.body}</p>
                <div className="btn-row" style={{ marginTop: '1rem' }}>
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
              <div className="sp-section-head">
                <h2 id="sp-issues-title">{s.troubleshootingTitle}</h2>
              </div>
              <div className="sp-issues">
                {filteredIssues.map((item) => (
                  <details key={item.title} className="sp-help-item pp-glass" open={Boolean(normalizedQuery)}>
                    <summary>{item.title}</summary>
                    <div className="sp-help-body">
                      <p>
                        <strong>{s.causeLabel}</strong> {item.cause}
                      </p>
                      <p>
                        <strong>{s.checkLabel}</strong> {item.check}
                      </p>
                      <p>
                        <strong>{s.nextLabel}</strong> {item.next}
                      </p>
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

      <section className="sp-section" id="feedback-hub" aria-labelledby="sp-hub-title">
        <div className="container">
          <Reveal>
            <div className="sp-section-head">
              <h2 id="sp-hub-title">{s.hubTitle}</h2>
              <p>{s.hubLead}</p>
            </div>
            <div className="sp-hub-grid">
              {s.hubActions.map((action) => (
                <article key={action.id} className="pp-glass sp-card">
                  <h3>{action.title}</h3>
                  <p>{action.body}</p>
                  <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                    <Link className="btn btn-primary" to={action.href}>
                      {action.title}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="sp-section" id="contact">
        <div className="container">
          <Reveal>
            <article className="pp-glass sp-contact">
              <h2>{s.contactTitle}</h2>
              <p>{s.contactBody}</p>
              <div className="btn-row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
                <Link className="btn btn-primary" to="/contact">
                  {s.contactAction}
                </Link>
                <Link className="btn btn-secondary" to="/privacy">
                  {t.cta.readPrivacy}
                </Link>
                <Link className="btn btn-secondary" to="/account">
                  {t.nav.account}
                </Link>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="pr-final container">
        <Reveal>
          <div className="pp-glass sp-contact">
            <h2>{s.final.title}</h2>
            <p>{s.final.lead}</p>
            <div className="btn-row">
              <GetFlowlaryButton />
              <Button variant="secondary" to="/#try-flowlary">
                {s.final.secondary}
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

function PlanHelpSection({
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
    <section className="sp-section" id={id} aria-labelledby={`sp-${id}-title`}>
      <div className="container">
        <Reveal>
          <article className="pp-glass sp-card">
            <h2 id={`sp-${id}-title`}>{title}</h2>
            <p>{body}</p>
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem', color: 'var(--fl-muted)', fontSize: '0.9rem' }}>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </Reveal>
      </div>
    </section>
  )
}
