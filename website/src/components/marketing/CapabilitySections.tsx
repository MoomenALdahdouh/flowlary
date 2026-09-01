import { useState, type KeyboardEvent } from 'react'
import { Button } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { SectionLabel } from './SectionLabel.tsx'
import { BrowserStage } from '../product/BrowserStage.tsx'
import { CorrectionDemo } from '../demos/CorrectionDemo.tsx'
import { TranslationDemo } from '../demos/TranslationDemo.tsx'
import { LayoutCorrectionDemo } from '../demos/LayoutCorrectionDemo.tsx'
import { LiveTranslationDemo } from '../demos/LiveTranslationDemo.tsx'
import { useMessages } from '../../i18n/index.tsx'

type PrimaryTab = 'correction' | 'translation' | 'layout'

export function CapabilitySections() {
  const t = useMessages()
  const b = t.demos.browser
  const [tab, setTab] = useState<PrimaryTab>('correction')

  const primary = [
    {
      id: 'correction' as const,
      kicker: t.correction.kicker,
      title: t.correction.title,
      lead: t.home.correctionLine,
      link: '/features/writing-correction',
      linkLabel: t.features.items[0].title,
      url: b.activeTextField,
      demo: <CorrectionDemo />,
    },
    {
      id: 'translation' as const,
      kicker: t.translation.kicker,
      title: t.translation.title,
      lead: t.home.translationLine,
      link: '/features/translation',
      linkLabel: t.features.items[1].title,
      url: b.activeTranslate,
      demo: <TranslationDemo />,
    },
    {
      id: 'layout' as const,
      kicker: t.layout.kicker,
      title: t.layout.title,
      lead: t.home.layoutLine,
      link: '/features/keyboard-layout',
      linkLabel: t.features.items[3].title,
      url: b.wrongLayout,
      demo: <LayoutCorrectionDemo />,
    },
  ]

  function focusTab(id: PrimaryTab) {
    setTab(id)
    document.getElementById(`hp-tab-${id}`)?.focus()
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    event.preventDefault()
    if (event.key === 'Home') {
      focusTab(primary[0].id)
      return
    }
    if (event.key === 'End') {
      focusTab(primary[primary.length - 1].id)
      return
    }
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + delta + primary.length) % primary.length
    focusTab(primary[next].id)
  }

  return (
    <section className="hp-capabilities" aria-labelledby="hp-cap-title">
      <div className="container">
        <Reveal>
          <SectionLabel>{t.home.capabilitiesKicker}</SectionLabel>
          <h2 id="hp-cap-title" className="hp-title">
            {t.home.capabilitiesTitle}
          </h2>
          <p className="hp-lead hp-lead-narrow">{t.home.capabilitiesLead}</p>
        </Reveal>

        <div className="hp-cap-primary">
          <div className="hp-cap-tabs" role="tablist" aria-label={t.a11y.primaryCapabilities}>
            {primary.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`hp-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`hp-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className={`hp-cap-tab tone-${item.id}${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                {item.linkLabel}
              </button>
            ))}
          </div>

          <div className="hp-cap-panels">
            {primary.map((item) => (
              <div
                key={item.id}
                className={`hp-cap-panel${tab === item.id ? ' is-active' : ''}`}
                role="tabpanel"
                id={`hp-panel-${item.id}`}
                aria-labelledby={`hp-tab-${item.id}`}
                hidden={tab !== item.id}
              >
                <div className="hp-cap-panel-copy">
                  <p className="hp-label">{item.kicker}</p>
                  <h3 className="hp-cap-heading">{item.title}</h3>
                  <p className="hp-lead">{item.lead}</p>
                  <Button variant="secondary" to={item.link}>
                    {item.linkLabel}
                  </Button>
                </div>
                <BrowserStage url={item.url} className="hp-cap-browser">
                  {item.demo}
                </BrowserStage>
              </div>
            ))}
          </div>
        </div>

        <div className="hp-cap-secondary">
          <Reveal>
            <article className="hp-cap-secondary-card tone-live">
              <div className="hp-cap-secondary-copy">
                <p className="hp-label">{t.live.kicker}</p>
                <h3>{t.live.title}</h3>
                <p>{t.home.liveLine}</p>
                <p className="hp-meta">{t.live.optionalMeta}</p>
                <Button variant="ghost" to="/features/live-translation">
                  {t.features.items[2].title}
                </Button>
              </div>
              <LiveTranslationDemo />
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
