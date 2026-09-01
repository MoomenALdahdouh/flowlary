import { Reveal } from '../Reveal.tsx'
import { SectionLabel } from './SectionLabel.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function PopupShowcase() {
  const t = useMessages()
  return (
    <section className="hp-popup" aria-labelledby="hp-popup-title">
      <div className="container">
        <Reveal className="hp-popup-head">
          <SectionLabel>{t.home.controlKicker}</SectionLabel>
          <h2 id="hp-popup-title" className="hp-title">
            {t.home.controlTitle}
          </h2>
          <p className="hp-lead hp-lead-narrow">{t.home.controlLead}</p>
        </Reveal>
        <Reveal className="reveal-d2">
          <div className="hp-popup-stage">
            <PopupPreview />
            <ul className="hp-popup-points">
              {t.home.controlPoints.map((point) => (
                <li key={point.title}>
                  <strong>{point.title}</strong>
                  <span>{point.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
