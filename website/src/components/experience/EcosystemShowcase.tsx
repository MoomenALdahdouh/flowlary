import { Button, ChromeIcon, FidelityBadge } from '../Ui.tsx'
import { useI18n, useMessages } from '../../i18n/index.tsx'

const ACTION_ICONS: Record<string, string> = {
  keyboard: '⌨',
  writing: '✎',
  translate: '⇄',
  continue: '▶',
}

function EmailGrammarDemo() {
  const copy = useMessages().marketingHome.twoSurfaces.chrome
  const mark = copy.grammarMark

  return (
    <div className="xp-eco-browser" aria-hidden="true">
      <div className="xp-eco-browser-bar">
        <span className="xp-eco-browser-dots">
          <span />
          <span />
          <span />
        </span>
        <span className="xp-eco-browser-url">{copy.mailUrl}</span>
      </div>
      <div className="xp-eco-email">
        <p className="xp-eco-email-to">
          {copy.emailToLabel}: {copy.emailTo}
        </p>
        <div className="xp-eco-email-body-wrap">
          <p className="xp-eco-email-body">
            {copy.emailBefore}
            <span className="xp-eco-grammar-mark">{mark}</span>
            {copy.emailAfter}
          </p>
          <p className="xp-eco-grammar-tip">{copy.grammarTip}</p>
        </div>
      </div>
    </div>
  )
}

export function EcosystemShowcase() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.marketingHome.twoSurfaces

  return (
    <div className="xp-ecosystem-showcase" dir={direction} lang={locale}>
      <div className="xp-ecosystem-stage">
        <article className="xp-eco-chrome-card">
          <header className="xp-eco-chrome-head">
            <div className="xp-eco-chrome-brand">
              <ChromeIcon className="xp-eco-chrome-icon" />
              <span>{copy.chrome.badge}</span>
            </div>
            <FidelityBadge mode="live" />
          </header>
          <h3 className="xp-eco-card-title">{copy.chrome.title}</h3>
          <p className="xp-eco-card-lead">{copy.chrome.lead}</p>

          <EmailGrammarDemo />

          <div className="xp-eco-action-grid" role="list" aria-label={copy.chrome.actionsLabel}>
            {copy.chrome.actions.map((action) => (
              <span key={action.id} className="xp-eco-action" role="listitem">
                <span className="xp-eco-action-icon" aria-hidden="true">
                  {ACTION_ICONS[action.id] ?? '•'}
                </span>
                {action.label}
              </span>
            ))}
          </div>
        </article>

        <div className="xp-eco-lab-stack">
          <article className="xp-eco-lab-card xp-eco-lab-intro">
            <p className="xp-eco-lab-badge">{copy.lab.badge}</p>
            <h3 className="xp-eco-card-title">{copy.lab.title}</h3>
            <p className="xp-eco-card-lead">{copy.lab.lead}</p>
          </article>

          {copy.lab.stats.map((stat) => (
            <article key={stat.label} className={`xp-eco-lab-stat xp-eco-stat-${stat.accent}`}>
              <strong className="xp-eco-stat-value">{stat.value}</strong>
              <p className="xp-eco-stat-label">{stat.label}</p>
            </article>
          ))}

          <Button variant="secondary" to={copy.lab.ctaHref} className="xp-eco-lab-cta">
            <span className="xp-eco-lab-cta-copy">
              <strong>{copy.lab.ctaTitle}</strong>
              <span>{copy.lab.ctaSubtitle}</span>
            </span>
            <span className="xp-eco-lab-cta-arrow" aria-hidden="true">
              →
            </span>
          </Button>
        </div>
      </div>

      <ol className="xp-eco-flow" aria-label={copy.flowLabel}>
        {copy.flow.map((step) => (
          <li key={step.label} className={`xp-eco-flow-step xp-eco-flow-${step.accent}`}>
            <span className="xp-eco-flow-dot" aria-hidden="true" />
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
