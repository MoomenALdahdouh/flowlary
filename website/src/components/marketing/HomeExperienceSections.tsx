import {
  Button,
  FidelityBadge,
  InstallFlowlaryButton,
  SectionHeading,
} from '../Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import { Reveal } from '../Reveal.tsx'
import { TryProductStory } from '../experience/OneFieldExperience.tsx'
import { KeyboardRepairHero } from './KeyboardRepairHero.tsx'
import { InFieldCycleDemo } from './InFieldCycleDemo.tsx'
import { LiveTranslationDemo } from '../demos/LiveTranslationDemo.tsx'
import { SpeedBoxDemo } from '../demos/SpeedBoxDemo.tsx'
import { ActiveFieldWalkthrough } from '../experience/ActiveFieldWalkthrough.tsx'
import { CapabilitiesShowcase } from '../experience/CapabilitiesShowcase.tsx'
import { EcosystemShowcase } from '../experience/EcosystemShowcase.tsx'
import { WritingLabPanelPreview } from '../experience/WritingLabPanelPreview.tsx'

type ProblemItem = {
  tag: string
  accent: 'magenta' | 'cyan'
  kind: 'layout' | 'writing' | 'translate'
  sampleWrong: string
  sampleRight: string
  body: string
}

function ProblemWrongText({ item }: { item: ProblemItem }) {
  if (item.kind === 'writing') {
    const needle = 'send'
    const idx = item.sampleWrong.indexOf(needle)
    if (idx >= 0) {
      return (
        <>
          {item.sampleWrong.slice(0, idx)}
          <span className="xp-problem-wrong-mark">{needle}</span>
          {item.sampleWrong.slice(idx + needle.length)}
        </>
      )
    }
  }
  return <>{item.sampleWrong}</>
}

function ProblemFixText({ item }: { item: ProblemItem }) {
  if (item.kind === 'writing') {
    const fix = 'to send'
    const idx = item.sampleRight.indexOf(fix)
    if (idx >= 0) {
      return (
        <>
          {item.sampleRight.slice(0, idx)}
          <strong>{fix}</strong>
          {item.sampleRight.slice(idx + fix.length)}
        </>
      )
    }
  }
  return <>{item.sampleRight}</>
}

function problemInputAttrs(kind: ProblemItem['kind']) {
  if (kind === 'layout') return { dir: 'ltr' as const, lang: 'en' }
  if (kind === 'translate') return { dir: 'rtl' as const, lang: 'ar' }
  return { dir: 'ltr' as const, lang: 'en' }
}

function problemOutputAttrs(kind: ProblemItem['kind']) {
  if (kind === 'layout') return { dir: 'rtl' as const, lang: 'ar' }
  if (kind === 'translate') return { dir: 'ltr' as const, lang: 'en' }
  return { dir: 'ltr' as const, lang: 'en' }
}

function GradientTitle({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight) return <>{text}</>
  const parts = text.split(highlight)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts[0]}
      <span className="xp-gradient-text">{highlight}</span>
      {parts[1]}
    </>
  )
}

function HeroTitle({ title, highlight }: { title: string; highlight?: string }) {
  const lines = title.split('\n')
  if (lines.length < 2) {
    return <GradientTitle text={title} highlight={highlight} />
  }
  return (
    <>
      <span className="xp-hero-title-line">{lines[0]}</span>
      <span className="xp-hero-title-line xp-gradient-text">{lines[1]}</span>
    </>
  )
}

export function HomeHeroSection() {
  const t = useMessages()
  const copy = t.marketingHome.hero

  return (
    <>
      <section className="xp-hero" aria-labelledby="xp-hero-title">
        <div className="container xp-hero-split">
          <div className="xp-hero-copy">
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {copy.badge}
            </p>
            <h1 id="xp-hero-title" className="mh-display xp-hero-title">
              <HeroTitle title={copy.title} highlight={copy.titleHighlight} />
            </h1>
            <p className="mh-hero-lead">{copy.lead}</p>
            <div className="mh-cta-row xp-hero-cta">
              <InstallFlowlaryButton
                className="btn-hero btn-chrome"
                label={t.cta.installFree}
                showChromeIcon
              />
              <Button variant="secondary" to="/try" className="btn-hero">
                {t.cta.tryDemo}
                <span className="btn-hero-arrow" aria-hidden="true">
                  →
                </span>
              </Button>
            </div>
            <ul className="xp-hero-proofs">
              {copy.proofs.map((item) => (
                <li key={item}>
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3.2 8.2 6.4 11.2 12.8 4.8"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="xp-hero-preview-wrap">
            <KeyboardRepairHero />
          </div>
        </div>
      </section>
      <section className="xp-proof-strip" aria-label={copy.note}>
        <div className="container">
          {copy.stats.map((stat) => (
            <div key={stat.label} className="xp-proof-item">
              <p className="xp-proof-value">{stat.value}</p>
              <p className="xp-proof-label">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export function HomeProblemSection() {
  const t = useMessages()
  const copy = t.marketingHome.problem
  return (
    <section className="xp-section xp-problem-band" aria-labelledby="xp-problem-title">
      <div className="container">
        <Reveal>
          <SectionHeading
            kicker={copy.kicker}
            title={copy.title}
            highlight={copy.titleHighlight}
            lead={copy.lead}
            titleId="xp-problem-title"
            align="center"
          />
        </Reveal>
        <div className="xp-problem-grid" role="list">
          {copy.items.map((item, index) => {
            const problem = item as ProblemItem
            const inputAttrs = problemInputAttrs(problem.kind)
            const outputAttrs = problemOutputAttrs(problem.kind)
            return (
              <Reveal key={problem.tag}>
                <article
                  className={`xp-problem-card xp-problem-card-${index + 1} xp-problem-accent-${problem.accent}`}
                  role="listitem"
                >
                  <span className={`xp-problem-tag xp-problem-tag-${problem.accent}`}>{problem.tag}</span>
                  <div className="xp-problem-demo">
                    <div className="xp-problem-demo-block">
                      <span className="xp-problem-demo-label">{copy.demoYouType}</span>
                      <p
                        className={`xp-problem-demo-input${problem.kind !== 'writing' ? ' is-wrong' : ''}`}
                        {...inputAttrs}
                      >
                        <ProblemWrongText item={problem} />
                      </p>
                    </div>
                    <div className="xp-problem-demo-divider" aria-hidden="true" />
                    <div className="xp-problem-demo-block">
                      <span className="xp-problem-demo-label">{copy.demoFixes}</span>
                      <p className="xp-problem-demo-output" {...outputAttrs}>
                        <ProblemFixText item={problem} />
                      </p>
                    </div>
                  </div>
                  <p className="xp-problem-card-body">{problem.body}</p>
                </article>
              </Reveal>
            )
          })}
        </div>
        <p className="xp-problem-bridge-watermark" aria-hidden="true">
          <span>{copy.watermarkLine1}</span>
          <span>{copy.watermarkLine2}</span>
        </p>
      </div>
    </section>
  )
}

export function HomeOneFieldSection() {
  const copy = useMessages().marketingHome.oneField
  return (
    <section className="xp-section xp-capabilities-band" aria-labelledby="xp-one-field-title">
      <div className="container">
        <Reveal>
          <div className="xp-capabilities-header">
            <SectionHeading
              kicker={copy.kicker}
              title={copy.title}
              highlight={copy.titleHighlight}
              titleId="xp-one-field-title"
            />
            <p className="xp-capabilities-lead">{copy.lead}</p>
          </div>
        </Reveal>
        <Reveal>
          <CapabilitiesShowcase />
        </Reveal>
      </div>
    </section>
  )
}

export function HomeKeyboardFixSection() {
  return <ActiveFieldWalkthrough />
}

export function HomeTwoSurfacesSection() {
  const copy = useMessages().marketingHome.twoSurfaces
  return (
    <section className="xp-section xp-ecosystem-band" aria-labelledby="xp-surfaces-title">
      <div className="container">
        <Reveal>
          <SectionHeading
            kicker={copy.kicker}
            title={copy.title}
            highlight={copy.titleHighlight}
            lead={copy.lead}
            titleId="xp-surfaces-title"
            align="center"
          />
        </Reveal>
        <Reveal>
          <EcosystemShowcase />
        </Reveal>
        <div className="xp-section-cta">
          <Button variant="secondary" to="/product">
            {copy.cta}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function HomeLearningSection() {
  const copy = useMessages().marketingHome.learning
  return (
    <section className="xp-section xp-writing-lab-band" aria-labelledby="xp-learning-title">
      <div className="container">
        <div className="xp-split xp-writing-lab-split">
          <Reveal className="xp-writing-lab-copy">
            <SectionHeading
              kicker={copy.kicker}
              title={copy.title}
              highlight={copy.titleHighlight}
              lead={copy.lead}
              titleId="xp-learning-title"
            />
            <ul className="xp-writing-lab-features">
              {copy.features.map((feature) => (
                <li key={feature.title}>
                  <span className="xp-writing-lab-feature-icon" aria-hidden="true">
                    »
                  </span>
                  <div>
                    <strong>{feature.title}</strong>
                    <p>{feature.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="xp-writing-lab-cta-row">
              <Button variant="primary" to={copy.ctaHref} className="btn-hero">
                {copy.cta}
                <span className="btn-hero-arrow" aria-hidden="true">
                  →
                </span>
              </Button>
              <span className="xp-writing-lab-live-note">{copy.liveNote}</span>
            </div>
          </Reveal>
          <Reveal>
            <WritingLabPanelPreview />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export function HomeTrySection() {
  const t = useMessages()
  const copy = t.marketingHome.try
  return (
    <section className="xp-section xp-try-band" aria-labelledby="mh-try-title">
      <div className="container">
        <SectionHeading title={copy.title} lead={copy.lead} titleId="mh-try-title" align="center" />
        <div className="xp-try-stage">
          <Reveal>
            <div className="xp-try-story-header">
              <FidelityBadge mode="simulated" />
            </div>
            <TryProductStory />
          </Reveal>
        </div>
        <div className="mh-try-grid">
          <article className="mh-try-card">
            <FidelityBadge mode="simulated" />
            <h3>{copy.playgroundTitle}</h3>
            <p>{copy.playgroundLead}</p>
            <Button variant="secondary" to="/try">
              {t.cta.try}
            </Button>
          </article>
          <article className="mh-try-card">
            <FidelityBadge mode="live" />
            <h3>{copy.labTitle}</h3>
            <p>{copy.labLead}</p>
            <Button variant="secondary" to="/lab">
              {t.nav.writingLab}
            </Button>
          </article>
        </div>
      </div>
    </section>
  )
}

export function HomeFinalCta() {
  const t = useMessages()
  const copy = t.marketingHome.final
  const bolt = t.marketingHome.bolt
  return (
    <section className="xp-section xp-bolt-cta" aria-labelledby="mh-final-title">
      <div className="container">
        <p className="xp-final-kicker">{copy.kicker}</p>
        <h2 id="mh-final-title" className="xp-final-title">
          <span className="xp-final-title-line">{copy.titleLine1}</span>
          <span className="xp-final-title-line xp-gradient-text">{copy.titleLine2}</span>
        </h2>
        <p className="xp-bolt-cta-lead">{bolt.ctaLead}</p>
        <div className="xp-final-cta-row">
          <InstallFlowlaryButton
            className="btn-hero btn-chrome xp-final-install"
            label={copy.installLabel}
            showChromeIcon
          />
          <Button variant="secondary" to="/try" className="btn-hero xp-bolt-cta-secondary">
            {copy.tryLabel}
          </Button>
        </div>
        <p className="xp-final-fine-print">{copy.finePrint}</p>
      </div>
    </section>
  )
}

export function HomeInFieldSection() {
  const copy = useMessages().marketingHome.bolt
  return (
    <section className="xp-section xp-infield-band" aria-labelledby="xp-infield-title">
      <div className="container">
        <Reveal>
          <SectionHeading
            kicker={copy.inFieldKicker}
            title={copy.inFieldTitle}
            lead={copy.inFieldLead}
            titleId="xp-infield-title"
            align="center"
          />
        </Reveal>
        <Reveal>
          <div className="xp-infield-stage">
            <InFieldCycleDemo />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function HomeSignatureSection() {
  const copy = useMessages().marketingHome.bolt
  return (
    <section className="xp-section xp-signature-band" aria-labelledby="xp-signature-title">
      <div className="container xp-signature-grid">
        <Reveal>
          <p className="xp-hero-badge">{copy.signatureKicker}</p>
          <h2 id="xp-signature-title" className="mh-title">
            {copy.signatureTitle}
          </h2>
          <p className="mh-lead">{copy.signatureLead}</p>
          <ul className="xp-signature-points">
            {copy.signaturePoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Button variant="link" to="/features/keyboard-layout">
            {copy.signatureCta}
            <span className="btn-hero-arrow" aria-hidden="true">
              →
            </span>
          </Button>
        </Reveal>
        <Reveal>
          <KeyboardRepairHero />
        </Reveal>
      </div>
    </section>
  )
}

export function HomeLiveSpeedSection() {
  const copy = useMessages().marketingHome.bolt
  return (
    <>
      <section className="xp-section" aria-labelledby="xp-live-title">
        <div className="container xp-split">
          <Reveal>
            <p className="xp-hero-badge">{copy.liveKicker}</p>
            <h2 id="xp-live-title" className="mh-title">
              {copy.liveTitle}
            </h2>
            <p className="mh-lead">{copy.liveLead}</p>
            <ul className="xp-signature-points">
              {copy.livePoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal>
            <LiveTranslationDemo />
          </Reveal>
        </div>
      </section>
      <section className="xp-section xp-speed-band" aria-labelledby="xp-speed-title">
        <div className="container xp-split is-flip">
          <Reveal>
            <SpeedBoxDemo />
          </Reveal>
          <Reveal>
            <p className="xp-hero-badge">{copy.speedKicker}</p>
            <h2 id="xp-speed-title" className="mh-title">
              {copy.speedTitle}
            </h2>
            <p className="mh-lead">{copy.speedLead}</p>
          </Reveal>
        </div>
      </section>
    </>
  )
}

export function HomePlacesSection() {
  const copy = useMessages().marketingHome.bolt
  return (
    <section className="xp-section" aria-labelledby="xp-places-title">
      <div className="container">
        <Reveal>
          <SectionHeading
            kicker={copy.placesKicker}
            title={copy.placesTitle}
            lead={copy.placesLead}
            titleId="xp-places-title"
            align="center"
          />
        </Reveal>
        <div className="xp-places-grid">
          {copy.places.map((place) => (
            <article key={place.title} className="xp-place-card">
              <h3>{place.title}</h3>
              <p>{place.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function HomeTrustSection() {
  const copy = useMessages().marketingHome.bolt
  return (
    <section className="xp-section xp-trust-band" aria-labelledby="xp-trust-title">
      <div className="container">
        <Reveal>
          <SectionHeading
            kicker={copy.trustKicker}
            title={copy.trustTitle}
            titleId="xp-trust-title"
            align="center"
          />
        </Reveal>
        <div className="xp-trust-grid">
          {copy.trust.map((item) => (
            <article key={item.title} className="xp-trust-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
