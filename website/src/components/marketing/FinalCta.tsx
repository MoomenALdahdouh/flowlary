import { Button, InstallFlowlaryButton } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function FinalCta() {
  const t = useMessages()
  const copy = t.marketingHome.final
  return (
    <section className="mh-final" aria-labelledby="mh-final-title">
      <div className="container">
        <Reveal>
          <div className="mh-final-panel">
            <p className="mh-eyebrow">{copy.kicker}</p>
            <h2 id="mh-final-title" className="mh-title">
              {copy.titleLine1} {copy.titleLine2}
            </h2>
            <p className="mh-lead">{copy.leadLine1}</p>
            <div className="mh-cta-row">
              <InstallFlowlaryButton />
              <Button variant="secondary" to="/pricing">
                {t.cta.viewPricing}
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
