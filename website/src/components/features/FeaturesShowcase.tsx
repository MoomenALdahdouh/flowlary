import {
  Button,
  ConversionPanel,
  FidelityBadge,
  InstallFlowlaryButton,
  SectionHeading,
} from '../Ui.tsx'
import { BrowserStage } from '../product/BrowserStage.tsx'
import {
  CorrectionDemo,
  LayoutCorrectionDemo,
  LiveTranslationDemo,
  SpeedBoxDemo,
  TranslationDemo,
} from '../demos/ProductDemos.tsx'
import { FeatureIcon as BuiltInIcon } from './FeatureInteractive.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

type Accent = 'magenta' | 'cyan' | 'purple' | 'green'

const SECTION_ACCENTS: Accent[] = ['purple', 'magenta', 'cyan', 'cyan', 'green']

function sectionAnchor(detailPath: string) {
  const slug = detailPath.replace(/^\/features\//, '').replace(/^\//, '')
  return slug ? `feat-${slug}` : 'feat-top'
}

function FeatureDemo({ detailPath }: { detailPath: string }) {
  const t = useMessages()
  const browser = t.demos.browser

  switch (detailPath) {
    case '/features/writing-correction':
      return (
        <BrowserStage url={browser.activeCorrection}>
          <CorrectionDemo />
        </BrowserStage>
      )
    case '/features/translation':
      return (
        <BrowserStage url={browser.activeTranslate}>
          <TranslationDemo />
        </BrowserStage>
      )
    case '/features/live-translation':
      return (
        <BrowserStage url={browser.activeTranslate}>
          <LiveTranslationDemo />
        </BrowserStage>
      )
    case '/features/keyboard-layout':
      return (
        <BrowserStage url={browser.wrongLayout}>
          <LayoutCorrectionDemo />
        </BrowserStage>
      )
    case '/features/speed-box':
      return <SpeedBoxDemo />
    default:
      return null
  }
}

function FeatureSection({
  accent,
  flip,
  number,
  kicker,
  title,
  value,
  bullets,
  detailPath,
  detailLabel,
}: {
  accent: Accent
  flip?: boolean
  number: string
  kicker: string
  title: string
  value: string
  bullets: readonly string[]
  detailPath: string
  detailLabel: string
}) {
  const id = sectionAnchor(detailPath)

  return (
    <section
      id={id}
      className="feat-section"
      aria-labelledby={`${id}-title`}
    >
      <div className={`container feat-showcase${flip ? ' is-flip' : ''}`}>
        <Reveal className="feat-copy">
          <p className="feat-section-num xp-gradient-text">{number}</p>
          <SectionHeading
            kicker={kicker}
            title={title}
            titleId={`${id}-title`}
            badge={<FidelityBadge mode="simulated" />}
          />
          <p className="feat-value">{value}</p>
          <ul className="feat-bullets">
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Button variant="link" to={detailPath}>
            {detailLabel}
          </Button>
        </Reveal>
        <Reveal className={`feat-demo feat-demo-accent-${accent}`}>
          <div className="feat-demo-surface">
            <FeatureDemo detailPath={detailPath} />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function FeaturesShowcase() {
  const t = useMessages()
  const fp = t.featuresPage

  return (
    <div className="feat-page xp-feat">
      <header className="feat-hero xp-hero" aria-labelledby="feat-hero-title">
        <div className="container feat-hero-grid">
          <div className="feat-hero-copy xp-hero-copy">
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {fp.kicker}
            </p>
            <h1 id="feat-hero-title" className="mh-display xp-hero-title">
              {fp.title.split('Flowlary')[0]}
              <span className="xp-gradient-text">Flowlary</span>
              {fp.title.split('Flowlary')[1]}
            </h1>
            <p className="lead mh-hero-lead">{fp.lead}</p>
            <div className="btn-row feat-hero-actions xp-hero-cta">
              <InstallFlowlaryButton className="btn-hero btn-chrome" showChromeIcon />
              <Button variant="secondary" to="/try" className="btn-hero">
                {t.cta.try}
                <span className="btn-hero-arrow" aria-hidden="true">
                  →
                </span>
              </Button>
            </div>
          </div>
          <Reveal className="feat-hero-proof">
            <BrowserStage url={t.demos.browser.activeCorrection}>
              <CorrectionDemo />
            </BrowserStage>
          </Reveal>
        </div>
      </header>

      <nav className="feat-journey-nav" aria-label={fp.navAria}>
        <div className="container">
          {fp.sections.map((section, index) => (
            <a key={section.detailPath} href={`#${sectionAnchor(section.detailPath)}`}>
              {fp.nav[index]}
            </a>
          ))}
        </div>
      </nav>

      {fp.sections.map((section, index) => (
        <FeatureSection
          key={section.detailPath}
          accent={SECTION_ACCENTS[index] ?? 'purple'}
          flip={index % 2 === 1}
          number={section.number}
          kicker={section.kicker}
          title={section.title}
          value={section.value}
          bullets={section.bullets}
          detailPath={section.detailPath}
          detailLabel={section.detailLabel}
        />
      ))}

      <section className="feat-built" aria-labelledby="feat-built-title">
        <div className="container">
          <Reveal className="feat-built-head">
            <SectionHeading
              kicker={fp.built.kicker}
              title={fp.built.title}
              lead={fp.built.lead}
              titleId="feat-built-title"
            />
          </Reveal>
          <div className="feat-built-grid">
            {fp.built.items.map((item) => (
              <Reveal key={item.title}>
                <article className="feat-built-card">
                  <div className="feat-built-icon">
                    <BuiltInIcon name={item.icon as 'history' | 'safety' | 'pause'} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <div className="feat-product-link">
            <Button variant="secondary" to="/product">
              {fp.productLink}
            </Button>
          </div>
        </div>
      </section>

      <ConversionPanel
        titleId="feat-final-title"
        title={fp.final.title}
        lead={fp.final.lead}
        primary={<InstallFlowlaryButton />}
        secondary={
          <Button variant="secondary" to="/try">
            {fp.final.secondary}
          </Button>
        }
      />
    </div>
  )
}
