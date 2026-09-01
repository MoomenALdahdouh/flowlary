import { Button } from '../Ui.tsx'
import { CorrectionDemo } from '../demos/CorrectionDemo.tsx'
import { LayoutCorrectionDemo } from '../demos/LayoutCorrectionDemo.tsx'
import { TranslationDemo } from '../demos/TranslationDemo.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'
import { SectionLabel } from './SectionLabel.tsx'

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.2 6.4 11l6.1-6.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProblemSection() {
  const copy = useMessages().marketingHome.problem
  return (
    <section className="mh-problem" aria-labelledby="mh-problem-title">
      <div className="container mh-problem-grid">
        <Reveal>
          <SectionLabel tone="accent">{copy.kicker}</SectionLabel>
          <h2 id="mh-problem-title" className="mh-title">
            {copy.title}
          </h2>
          <p className="mh-lead">{copy.lead}</p>
        </Reveal>
        <Reveal className="reveal-d2">
          <div className="mh-fragment" aria-label={copy.resolve}>
            <div className="mh-fragment-list">
              {copy.items.map((item, index) => (
                <span key={item}>
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  {item}
                </span>
              ))}
            </div>
            <p>{copy.resolve}</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function WriteSection() {
  const copy = useMessages().marketingHome.write
  return (
    <section className="mh-story mh-story-write" id="write" aria-labelledby="mh-write-title">
      <div className="container mh-story-grid">
        <Reveal className="mh-story-copy">
          <SectionLabel tone="accent">{copy.kicker}</SectionLabel>
          <h2 id="mh-write-title" className="mh-title">
            {copy.title}
          </h2>
          <p className="mh-lead">{copy.lead}</p>
          <ul className="mh-check-list">
            {copy.points.map((point) => (
              <li key={point}>
                <CheckIcon />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <Button variant="link" to="/features/writing-correction">
            {copy.cta}
          </Button>
        </Reveal>
        <Reveal className="mh-product-proof reveal-d2">
          <CorrectionDemo loop />
        </Reveal>
      </div>
    </section>
  )
}

export function CommunicateSection() {
  const copy = useMessages().marketingHome.communicate
  return (
    <section className="mh-story mh-story-communicate" id="communicate" aria-labelledby="mh-communicate-title">
      <div className="container">
        <Reveal className="mh-section-head">
          <SectionLabel tone="accent">{copy.kicker}</SectionLabel>
          <h2 id="mh-communicate-title" className="mh-title">
            {copy.title}
          </h2>
          <p className="mh-lead">{copy.lead}</p>
        </Reveal>
        <div className="mh-communicate-grid">
          <Reveal className="mh-product-proof">
            <TranslationDemo />
            <p className="mh-proof-label">{copy.translation}</p>
          </Reveal>
          <Reveal className="mh-product-proof reveal-d2">
            <LayoutCorrectionDemo />
            <p className="mh-proof-label">{copy.layout}</p>
          </Reveal>
        </div>
        <Reveal>
          <div className="mh-utility-row">
            <span>{copy.live}</span>
            <span>{copy.speed}</span>
            <Button variant="link" to="/features">
              {copy.cta}
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function LearnSection() {
  const copy = useMessages().marketingHome.learn
  return (
    <section className="mh-story mh-story-learn" id="learn" aria-labelledby="mh-learn-title">
      <div className="container mh-story-grid">
        <Reveal className="mh-story-copy">
          <SectionLabel tone="accent">{copy.kicker}</SectionLabel>
          <h2 id="mh-learn-title" className="mh-title">
            {copy.title}
          </h2>
          <p className="mh-lead">{copy.lead}</p>
          <p className="mh-note">{copy.note}</p>
          <Button variant="link" to="/features">
            {copy.cta}
          </Button>
        </Reveal>
        <Reveal className="mh-learning-proof reveal-d2">
          <p className="mh-sample-label">{copy.sample}</p>
          <div className="mh-pattern-card">
            <span className="mh-pattern-mark" aria-hidden="true">Aa</span>
            <div>
              <strong>{copy.patternTitle}</strong>
              <p>{copy.patternBody}</p>
            </div>
          </div>
          <ol className="mh-learning-flow">
            {copy.steps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}

export function HowSection() {
  const copy = useMessages().marketingHome.how
  return (
    <section className="mh-how" id="how" aria-labelledby="mh-how-title">
      <div className="container">
        <Reveal className="mh-section-head">
          <SectionLabel tone="accent">{copy.kicker}</SectionLabel>
          <h2 id="mh-how-title" className="mh-title">
            {copy.title}
          </h2>
        </Reveal>
        <ol className="mh-how-grid">
          {copy.steps.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function WhySection() {
  const copy = useMessages().marketingHome.why
  return (
    <section className="mh-why" aria-labelledby="mh-why-title">
      <div className="container mh-why-grid">
        <Reveal>
          <SectionLabel tone="accent">{copy.kicker}</SectionLabel>
          <h2 id="mh-why-title" className="mh-title">
            {copy.title}
          </h2>
          <p className="mh-lead">{copy.lead}</p>
        </Reveal>
        <div className="mh-why-list">
          {copy.items.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
