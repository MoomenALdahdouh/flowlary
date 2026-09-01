import { Reveal } from '../Reveal.tsx'
import { SectionLabel } from './SectionLabel.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function ControlPhilosophy() {
  const t = useMessages()
  return (
    <section className="hp-control" aria-labelledby="hp-control-title">
      <div className="container">
        <Reveal>
          <SectionLabel>{t.home.controlPhilosophyKicker}</SectionLabel>
          <h2 id="hp-control-title" className="hp-title">
            {t.home.controlPhilosophyTitle}
          </h2>
          <p className="hp-lead hp-lead-narrow">{t.home.controlPhilosophyLead}</p>
        </Reveal>
        <ul className="hp-control-grid">
          {t.home.controlItems.map((item, index) => (
            <li key={item.title}>
              <Reveal className={index % 2 === 1 ? 'reveal-d2' : undefined}>
                <div className="hp-control-item">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
