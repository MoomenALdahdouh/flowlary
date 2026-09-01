import { Reveal } from '../Reveal.tsx'
import { SectionLabel } from './SectionLabel.tsx'
import { WhereYouWrite } from '../demos/WhereYouWrite.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function WhereSection() {
  const t = useMessages()
  return (
    <section className="hp-where" aria-labelledby="hp-where-title">
      <div className="container hp-where-grid">
        <Reveal className="hp-where-copy">
          <SectionLabel>{t.home.environmentsKicker}</SectionLabel>
          <h2 id="hp-where-title" className="hp-title">
            {t.home.environmentsTitle}
          </h2>
          <p className="hp-lead">{t.home.whereLine}</p>
          <p className="hp-body">{t.home.environmentsBody}</p>
          <ul className="hp-where-list">
            {t.home.environments.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal className="reveal-d2">
          <WhereYouWrite />
        </Reveal>
      </div>
    </section>
  )
}
