import {
  Button,
  ConversionPanel,
  FidelityBadge,
  InstallFlowlaryButton,
  SectionHeading,
} from '../Ui.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { BuiltWithUsersSection } from '../trust/FeatureRequestsProof.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function HomeHeroSection() {
  const t = useMessages()
  const copy = t.marketingHome.hero

  return (
    <section className="mh-hero" aria-labelledby="mh-hero-title">
      <div className="container">
        <div className="mh-hero-grid">
          <div className="mh-hero-copy">
            <p className="mh-eyebrow">{copy.kicker}</p>
            <h1 id="mh-hero-title" className="mh-display">
              {copy.title}
            </h1>
            <p className="mh-hero-lead">{copy.lead}</p>
            <div className="mh-cta-row">
              <InstallFlowlaryButton className="btn-hero" />
              <Button variant="secondary" to="/try" className="btn-hero">
                {t.cta.try}
              </Button>
            </div>
            <p className="mh-hero-note">{copy.note}</p>
          </div>
          <div className="mh-hero-proof">
            <div className="mh-proof-window">
              <div className="mh-proof-browser" aria-hidden="true">
                <span />
                <span />
                <span />
                <strong>{t.home.environmentsTitle}</strong>
              </div>
              <PopupPreview compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HomeProblemSection() {
  const copy = useMessages().marketingHome.problem
  return (
    <section className="mh-section" aria-labelledby="mh-problem-title">
      <div className="container container-narrow">
        <SectionHeading kicker={copy.kicker} title={copy.title} lead={copy.lead} titleId="mh-problem-title" />
      </div>
    </section>
  )
}

export function HomeSolutionSection() {
  const copy = useMessages().marketingHome.solution
  return (
    <section className="mh-section mh-section-soft" aria-labelledby="mh-solution-title">
      <div className="container container-narrow">
        <SectionHeading kicker={copy.kicker} title={copy.title} lead={copy.lead} titleId="mh-solution-title" />
      </div>
    </section>
  )
}

export function HomeSurfacesSection() {
  const t = useMessages()
  const copy = t.marketingHome.surfaces
  return (
    <section className="mh-section" aria-labelledby="mh-surfaces-title">
      <div className="container">
        <SectionHeading
          kicker={copy.kicker}
          title={copy.title}
          lead={copy.lead}
          titleId="mh-surfaces-title"
        />
        <div className="mh-surfaces-grid">
          {copy.items.map((item) => (
            <article key={item.title} className="mh-surface-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              {item.link ? (
                <Button variant="link" to={item.link}>
                  {item.linkLabel}
                </Button>
              ) : null}
            </article>
          ))}
        </div>
        <div className="mh-surfaces-cta">
          <Button variant="secondary" to="/product">
            {t.cta.exploreProduct}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function HomeProofSection() {
  const copy = useMessages().marketingHome.proof
  return (
    <section className="mh-section mh-section-soft" aria-labelledby="mh-proof-title">
      <div className="container container-narrow">
        <SectionHeading kicker={copy.kicker} title={copy.title} lead={copy.lead} titleId="mh-proof-title" />
        <BuiltWithUsersSection />
      </div>
    </section>
  )
}

export function HomeTrySection() {
  const t = useMessages()
  const copy = t.marketingHome.try
  return (
    <section className="mh-section" aria-labelledby="mh-try-title">
      <div className="container">
        <SectionHeading kicker={copy.kicker} title={copy.title} lead={copy.lead} titleId="mh-try-title" />
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
  return (
    <ConversionPanel
      titleId="mh-final-title"
      title={`${copy.titleLine1} ${copy.titleLine2}`}
      lead={copy.leadLine1}
      primary={<InstallFlowlaryButton label={copy.installLabel} showChromeIcon />}
      secondary={
        <Button variant="link" to="/try">
          {copy.tryLabel}
        </Button>
      }
    />
  )
}
