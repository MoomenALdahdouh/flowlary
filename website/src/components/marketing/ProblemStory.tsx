import { useCallback, useState } from 'react'
import { Reveal } from '../Reveal.tsx'
import { SectionLabel } from './SectionLabel.tsx'
import { useInView } from '../../hooks/useInView.ts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useDemoSequence, type Later } from '../../hooks/useDemoSequence.ts'
import { DEMO_HOLD } from '../../hooks/demoPhases.ts'
import { useMessages, useI18n } from '../../i18n/index.tsx'

type Moment = 'grammar' | 'language' | 'layout' | 'tools' | 'resolved'

const MOMENT_INDEX: Record<Moment, number> = {
  grammar: 0,
  language: 1,
  layout: 2,
  tools: 3,
  resolved: 4,
}

export function ProblemStory() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const p = t.demos.problem
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  const [moment, setMoment] = useState<Moment>('resolved')

  const run = useCallback((later: Later) => {
    setMoment('resolved')
    later(() => setMoment('grammar'), DEMO_HOLD.stable)
    later(() => setMoment('language'), DEMO_HOLD.stable + DEMO_HOLD.step)
    later(() => setMoment('layout'), DEMO_HOLD.stable + DEMO_HOLD.step * 2)
    later(() => setMoment('tools'), DEMO_HOLD.stable + DEMO_HOLD.step * 3)
    later(() => setMoment('resolved'), DEMO_HOLD.stable + DEMO_HOLD.step * 4)
    later(() => run(later), DEMO_HOLD.stable + DEMO_HOLD.step * 4 + DEMO_HOLD.stable + DEMO_HOLD.loopGap)
  }, [])

  useDemoSequence(Boolean(inView && !reduced), run)

  const activeIndex = MOMENT_INDEX[moment]
  const resolved = moment === 'resolved'

  return (
    <section className="hp-problem" aria-labelledby="hp-problem-title">
      <div className="container">
        <Reveal>
          <SectionLabel>{t.home.problemKicker}</SectionLabel>
          <h2 id="hp-problem-title" className="hp-title">
            {t.home.problemTitle}
          </h2>
          <p className="hp-lead hp-lead-narrow">{t.home.problemLead}</p>
        </Reveal>

        <div ref={ref} className="hp-problem-stage">
          <div className="hp-problem-field" aria-live="polite" dir={direction} lang={locale}>
            <div className="hp-problem-field-bar">
              <span>{t.demos.shared.writingField}</span>
              <span className={`hp-state-pill${resolved ? ' is-ok' : ''}`}>
                {resolved ? p.ready : p.frictionDetected}
              </span>
            </div>
            <p
              className={`hp-problem-text${moment === 'grammar' ? ' is-issue' : ''}`}
              dir={moment === 'language' || moment === 'layout' ? 'auto' : 'ltr'}
              lang={moment === 'language' ? 'ar' : moment === 'layout' ? 'en' : 'en'}
            >
              {moment === 'grammar'
                ? p.samples.grammar
                : moment === 'language'
                  ? p.samples.language
                  : moment === 'layout'
                    ? p.samples.layout
                    : moment === 'tools'
                      ? p.samples.tools
                      : p.samples.resolved}
            </p>
            {resolved ? (
              <p className="hp-problem-resolve">{t.home.problemResolve}</p>
            ) : (
              <p className="hp-problem-hint">{t.home.problems[activeIndex]?.body}</p>
            )}
          </div>

          <ol className="hp-problem-steps">
            {t.home.problems.map((item, index) => (
              <li
                key={item.title}
                className={`hp-problem-step${activeIndex === index && !resolved ? ' is-active' : ''}${resolved && index === 3 ? ' is-done' : ''}`}
              >
                <span className="hp-step-num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
