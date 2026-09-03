import { useEffect, useRef, useState, type ReactElement } from 'react'
import { SHORTCUTS } from '../../config.ts'
import {
  Button,
  ChromeIcon,
  ConversionPanel,
  InstallFlowlaryButton,
  SectionHeading,
} from '../Ui.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

type StepId =
  | 'install'
  | 'popup'
  | 'ai'
  | 'features'
  | 'languages'
  | 'shortcuts'
  | 'dashboard'
  | 'account'

type Accent = 'magenta' | 'cyan' | 'purple' | 'green'

const STEP_ACCENTS: Accent[] = ['cyan', 'purple', 'magenta', 'green', 'cyan', 'purple', 'magenta', 'green']
const NEXT_ACCENTS: Accent[] = ['cyan', 'purple', 'green']

const GUIDE_SHORTCUTS = [
  { labelKey: 'shortcutFixWriting' as const, combo: SHORTCUTS.fixWriting },
  { labelKey: 'shortcutTranslate' as const, combo: SHORTCUTS.translate },
  { labelKey: 'shortcutLayout' as const, combo: SHORTCUTS.fixLayout },
  { labelKey: 'shortcutSpeed' as const, combo: SHORTCUTS.speedBox },
]

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
    <span className="gd-keys" aria-label={`${other} / ${mac}`}>
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

function useGuideScrollSpy(stepIds: readonly string[]) {
  const [activeId, setActiveId] = useState(stepIds[0] ?? 'install')
  const activeRef = useRef(activeId)
  activeRef.current = activeId

  useEffect(() => {
    const elements = stepIds
      .map((id) => document.getElementById(`guide-step-${id}`))
      .filter((element): element is HTMLElement => element instanceof HTMLElement)

    if (!elements.length) return

    let frame = 0
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]?.target
        if (!(top instanceof HTMLElement) || !top.id.startsWith('guide-step-')) return
        const next = top.id.replace('guide-step-', '')
        if (next === activeRef.current) return
        if (frame) window.cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(() => {
          frame = 0
          activeRef.current = next
          setActiveId(next)
        })
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    )

    elements.forEach((element) => observer.observe(element))
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [stepIds])

  return activeId
}

function NextCardIcon({ href }: { href: string }) {
  if (href === '/features') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.35" />
        <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    )
  }
  if (href === '/support') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.35" />
        <path d="M10 9v4M10 6.5v.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3 4.5 5.5v4.8c0 3.1 2.2 5.9 5.5 6.7 3.3-.8 5.5-3.6 5.5-6.7V5.5L10 3Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShortcutsGrid({ labels }: { labels: Record<(typeof GUIDE_SHORTCUTS)[number]['labelKey'], string> }) {
  return (
    <div className="gd-shortcuts-grid">
      {GUIDE_SHORTCUTS.map((item) => (
        <div key={item.labelKey} className="gd-shortcut-row">
          <span>{labels[item.labelKey]}</span>
          <KeyCombo {...item.combo} />
        </div>
      ))}
    </div>
  )
}

function StepVisual({ id }: { id: StepId }) {
  const t = useMessages()
  const p = t.popupPreview
  const g = t.guide
  const s = t.support

  const visuals: Record<StepId, ReactElement> = {
    install: (
      <div className="gd-visual-install">
        <div className="gd-visual-install-icon">
          <ChromeIcon />
        </div>
        <p>{g.steps[0]?.tip}</p>
        <InstallFlowlaryButton className="btn-sm" showChromeIcon />
      </div>
    ),
    popup: <PopupPreview compact animate={false} />,
    ai: (
      <div className="gd-visual-card">
        <p className="kicker">Flowlary AI</p>
        <h4>{g.steps[2]?.title}</h4>
        <p>{g.steps[2]?.body}</p>
        <span className="gd-visual-pill">{p.managedAiReady}</span>
      </div>
    ),
    features: (
      <div className="gd-visual-rows">
        <div className="gd-visual-row">
          <span>{p.features.correction}</span>
          <span aria-hidden="true" />
        </div>
        <div className="gd-visual-row">
          <span>{p.features.translation}</span>
          <span aria-hidden="true" />
        </div>
        <div className="gd-visual-row is-off">
          <span>{p.features.live}</span>
          <span aria-hidden="true" />
        </div>
        <div className="gd-visual-row">
          <span>{p.features.layout}</span>
          <span aria-hidden="true" />
        </div>
      </div>
    ),
    languages: (
      <ul className="gd-visual-settings">
        <li>{p.translationPair}</li>
        <li>{p.features.correction}</li>
        <li>{p.features.layout}</li>
      </ul>
    ),
    shortcuts: (
      <ShortcutsGrid
        labels={{
          shortcutFixWriting: s.shortcutFixWriting,
          shortcutTranslate: s.shortcutTranslate,
          shortcutLayout: s.shortcutLayout,
          shortcutSpeed: s.shortcutSpeed,
        }}
      />
    ),
    dashboard: (
      <div className="gd-visual-dashboard">
        <div className="gd-visual-dashboard-nav">
          {g.dashboardTabs.map((tab, index) => (
            <span key={tab} className={index === 0 ? 'is-active' : undefined}>
              {tab}
            </span>
          ))}
        </div>
        <p>{g.steps[6]?.body}</p>
      </div>
    ),
    account: (
      <div className="gd-visual-card">
        <p className="kicker">{g.steps[7]?.title}</p>
        <p>{g.steps[7]?.body}</p>
        <Button variant="secondary" to="/account?mode=register">
          {t.cta.getStarted}
        </Button>
      </div>
    ),
  }

  return <div className="gd-visual-surface">{visuals[id]}</div>
}

export function GuideShowcase() {
  const t = useMessages()
  const g = t.guide
  const s = t.support
  const titleParts = splitTitle(g.title, g.titleHighlight)
  const stepIds = g.steps.map((step) => step.id)
  const activeStepId = useGuideScrollSpy(stepIds)
  const activeIndex = Math.max(0, stepIds.indexOf(activeStepId))
  const progressLabel = g.navProgress
    .replace('{current}', String(activeIndex + 1))
    .replace('{total}', String(stepIds.length))

  return (
    <div className="gd-page xp-guide">
      <header className="gd-hero xp-hero" aria-labelledby="guide-hero-title">
        <div className="container gd-hero-grid">
          <div className="gd-hero-copy xp-hero-copy">
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {g.kicker}
            </p>
            <h1 id="guide-hero-title" className="mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="lead mh-hero-lead">{g.lead}</p>
            <ul className="gd-trust-row" aria-label={g.stepsTitle}>
              {g.heroTrust.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="btn-row gd-hero-actions xp-hero-cta">
              <InstallFlowlaryButton className="btn-hero btn-chrome" showChromeIcon />
              <Button variant="secondary" to="/support" className="btn-hero">
                {g.supportBannerAction}
                <span className="btn-hero-arrow" aria-hidden="true">
                  →
                </span>
              </Button>
            </div>
            <p className="gd-hero-jump">
              <a href="#guide-step-install">{g.heroJump}</a>
            </p>
          </div>
          <Reveal className="gd-hero-proof">
            <div className="gd-hero-proof-glow" aria-hidden="true" />
            <PopupPreview compact animate={false} />
          </Reveal>
        </div>
      </header>

      <nav className="gd-step-nav" aria-label={g.stepsTitle}>
        <div className="container gd-step-nav-inner">
          <p className="gd-nav-progress" aria-live="polite">
            {progressLabel}
          </p>
          <div className="gd-step-nav-links" role="list">
            {g.steps.map((step, index) => (
              <a
                key={step.id}
                href={`#guide-step-${step.id}`}
                className={activeStepId === step.id ? 'is-active' : undefined}
                aria-label={step.title}
                aria-current={activeStepId === step.id ? 'step' : undefined}
                role="listitem"
              >
                <span>{index + 1}</span>
                <span className="gd-step-nav-label">{step.title}</span>
              </a>
            ))}
          </div>
        </div>
      </nav>

      <section className="xp-page-section gd-steps-band" aria-labelledby="guide-steps-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading
              kicker={g.kicker}
              title={g.stepsTitle}
              lead={g.stepsLead}
              titleId="guide-steps-title"
            />
          </Reveal>
          <ol className="gd-timeline">
            {g.steps.map((step, index) => (
              <li
                key={step.id}
                id={`guide-step-${step.id}`}
                className={`gd-timeline-item gd-accent-${STEP_ACCENTS[index] ?? 'purple'}${index % 2 === 1 ? ' is-flip' : ''}${activeStepId === step.id ? ' is-active' : ''}`}
              >
                <Reveal className="gd-step-copy">
                  <span className="gd-step-num">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  {step.tip ? (
                    <p className="gd-tip">
                      <span className="gd-tip-label">{g.tipLabel}</span>
                      <span>{step.tip}</span>
                    </p>
                  ) : null}
                </Reveal>
                <Reveal className="gd-step-visual">
                  <StepVisual id={step.id as StepId} />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="xp-page-section gd-next-band" aria-labelledby="guide-next-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading kicker={g.kicker} title={g.dashboardTitle} titleId="guide-next-title" />
          </Reveal>
          <div className="gd-next-grid">
            {g.dashboardCards.map((card, index) => (
              <Reveal key={card.href}>
                <article className={`gd-next-card gd-next-accent-${NEXT_ACCENTS[index] ?? 'purple'}`}>
                  <div className="gd-next-icon">
                    <NextCardIcon href={card.href} />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <Button variant="link" to={card.href}>
                    {card.label}
                  </Button>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ConversionPanel
        titleId="guide-final-title"
        title={g.finalTitle}
        lead={g.finalLead}
        highlight={g.finalHighlight}
        primary={<InstallFlowlaryButton />}
        secondary={
          <Button variant="secondary" to="/support" ariaLabel={g.supportBanner}>
            {g.supportBannerAction}
          </Button>
        }
      />
    </div>
  )
}
