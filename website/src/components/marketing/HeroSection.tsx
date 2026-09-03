import { Button, InstallFlowlaryButton } from '../Ui.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function HeroSection() {
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
              <Button variant="secondary" to="/#how" className="btn-hero">
                {t.cta.secondary}
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
