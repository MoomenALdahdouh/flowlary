import { useCallback, useState } from 'react'
import { Button } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { SectionLabel } from '../marketing/SectionLabel.tsx'
import { DemoShell } from './DemoShell.tsx'
import { FeatureTabs } from './FeatureTabs.tsx'
import { CorrectionMode } from './modes/CorrectionMode.tsx'
import { TranslationMode } from './modes/TranslationMode.tsx'
import { LiveTranslationMode } from './modes/LiveTranslationMode.tsx'
import { LayoutMode } from './modes/LayoutMode.tsx'
import type { FeatureMode } from './demoData.ts'
import { useMessages } from '../../i18n/index.tsx'
import { playgroundDescription } from './playgroundUtils.ts'

export function PlaygroundSection({
  showIntro = true,
  embedded = false,
}: {
  showIntro?: boolean
  embedded?: boolean
}) {
  const t = useMessages()
  const [mode, setMode] = useState<FeatureMode>('correction')
  const [panelKey, setPanelKey] = useState(0)
  const [autoPlayToken, setAutoPlayToken] = useState(0)
  const [showMeRunning, setShowMeRunning] = useState(false)

  const onModeChange = useCallback((next: FeatureMode) => {
    setMode((current) => {
      if (current !== next) setPanelKey((k) => k + 1)
      return next
    })
  }, [])

  const onShowMe = () => {
    if (showMeRunning) return
    setShowMeRunning(true)
    setMode('correction')
    setPanelKey((k) => k + 1)
    setAutoPlayToken((n) => n + 1)
    window.setTimeout(() => setShowMeRunning(false), 2000)
  }

  const description = playgroundDescription(t, mode)

  return (
    <section
      className={`hp-playground snow-atmosphere${embedded ? ' is-embedded' : ''}`}
      id="try-flowlary"
      aria-labelledby={showIntro ? 'hp-playground-title' : 'try-workspace-title'}
    >
      <div className="container">
        {showIntro ? (
          <Reveal>
            <div className="hp-playground-head">
              <div>
                <SectionLabel>{t.home.playgroundKicker}</SectionLabel>
                <h2 id="hp-playground-title" className="hp-title">
                  {t.home.playgroundTitle}
                  <span className="pg-demo-badge">{t.home.playgroundSimulatedBadge}</span>
                </h2>
                <p className="hp-lead hp-lead-narrow">{t.home.playgroundLead}</p>
              </div>
              <Button
                variant="secondary"
                onClick={onShowMe}
                disabled={showMeRunning}
                ariaLabel={t.playground.showMeAria}
              >
                {t.home.playgroundShowMe}
              </Button>
            </div>
          </Reveal>
        ) : null}

        <ol className="pg-steps" aria-label={t.home.playgroundStepsAria}>
          {t.home.playgroundSteps.map((step, index) => (
            <li key={step}>
              <span className="pg-step-num">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="pg-stage-head">
          {!showIntro ? (
            <Button
              variant="secondary"
              onClick={onShowMe}
              disabled={showMeRunning}
              ariaLabel={t.playground.showMeAria}
            >
              {t.home.playgroundShowMe}
            </Button>
          ) : null}
        </div>

        <div className="pg-stage">
          <FeatureTabs active={mode} onChange={onModeChange} />
          <p className="pg-mode-desc">{description}</p>

          <div className="pg-stage-body">
            <div
              key={`${mode}-${panelKey}`}
              className="pg-panel"
              role="tabpanel"
              id={`pg-panel-${mode}`}
              aria-labelledby={`pg-tab-${mode}`}
            >
              <DemoShell>
                {mode === 'correction' ? (
                  <CorrectionMode autoPlayToken={autoPlayToken} readOnly={showMeRunning} />
                ) : null}
                {mode === 'translation' ? <TranslationMode /> : null}
                {mode === 'live' ? <LiveTranslationMode /> : null}
                {mode === 'layout' ? <LayoutMode /> : null}
              </DemoShell>
            </div>
          </div>

          <p className="pg-disclaimer">{t.home.playgroundDisclaimer}</p>
        </div>
      </div>
    </section>
  )
}
