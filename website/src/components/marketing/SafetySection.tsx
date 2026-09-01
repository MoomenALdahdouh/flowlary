import { Button } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { SectionLabel } from './SectionLabel.tsx'
import { SafetyGate } from '../demos/SafetyGate.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function SafetySection() {
  const t = useMessages()
  return (
    <section className="hp-safety" aria-labelledby="hp-safety-title">
      <div className="container hp-safety-grid">
        <Reveal className="hp-safety-copy">
          <SectionLabel>{t.home.privacyKicker}</SectionLabel>
          <h2 id="hp-safety-title" className="hp-title">
            {t.home.privacyTitle}
          </h2>
          <p className="hp-lead">{t.home.privacyLine}</p>
          <p className="hp-body">{t.home.privacyBody}</p>
          <Button variant="secondary" to="/privacy">
            {t.cta.readPrivacy}
          </Button>
        </Reveal>
        <Reveal className="reveal-d2">
          <SafetyGate />
        </Reveal>
      </div>
    </section>
  )
}
