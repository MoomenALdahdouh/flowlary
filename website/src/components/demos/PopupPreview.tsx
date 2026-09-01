import { useCallback, useState } from 'react'
import { FLOWLARY_PRICING } from '@flowlary/shared'
import { SHORTCUTS } from '../../config.ts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useInView } from '../../hooks/useInView.ts'
import { useDemoSequence, type Later } from '../../hooks/useDemoSequence.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { Logo } from '../Logo.tsx'
import { DemoCaption } from './ComposeFrame.tsx'

type Phase = 'idle' | 'notice' | 'done'

export function PopupPreview({
  compact = false,
  animate = true,
}: {
  compact?: boolean
  animate?: boolean
}) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const p = t.popupPreview
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  const [phase, setPhase] = useState<Phase>('done')

  const run = useCallback((later: Later) => {
    setPhase('idle')
    later(() => setPhase('notice'), 900)
    later(() => setPhase('done'), 1800)
  }, [])

  useDemoSequence(Boolean(animate && inView && !reduced), run)

  const livePulse = phase === 'notice'

  return (
    <figure ref={ref} className={compact ? 'compact-demo' : undefined}>
      <div className="popup-frame" dir={direction} lang={locale} aria-hidden="true">
        <div className="popup-header">
          <div className="popup-brand">
            <Logo />
            <div>
              <h3>{t.brand.name}</h3>
              <p>{t.brand.tagline}</p>
            </div>
          </div>
          <div className="popup-header-actions">
            <span className="popup-connection">
              <span className="popup-status-dot" />
              {p.connected}
            </span>
          </div>
        </div>

        <div className="popup-master">
          <div className="popup-master-copy">
            <h4>{p.masterTitle}</h4>
            <p>{p.masterDesc}</p>
          </div>
          <span className="popup-toggle" aria-hidden="true" />
        </div>

        <p className="popup-section-label">{p.sectionActions}</p>
        <div className="popup-actions">
          <span className="is-primary">
            {p.actions.fixWriting}
            <kbd dir="ltr">{SHORTCUTS.fixWriting.mac}</kbd>
          </span>
          <span>{p.actions.translate}<kbd dir="ltr">{SHORTCUTS.translate.mac}</kbd></span>
          <span>{p.actions.fixLayout}<kbd dir="ltr">{SHORTCUTS.fixLayout.mac}</kbd></span>
        </div>

        <p className="popup-usage-strip">
          <span>{p.usageLabel}</span>
          <span>{p.usageFree.replace('{count}', String(FLOWLARY_PRICING.freeDailyCredits))}</span>
        </p>

        <p className="popup-section-label">{p.sectionFeatures}</p>
        <div className="popup-row">
          <div className="popup-row-copy">
            <h4>{p.features.correction}</h4>
            <p>{p.ready}</p>
          </div>
          <span className="popup-toggle" aria-hidden="true" />
        </div>
        <div className="popup-row">
          <div className="popup-row-copy">
            <h4>{p.features.translation}</h4>
            <p>{p.translationPair}</p>
          </div>
          <span className="popup-toggle" aria-hidden="true" />
        </div>
        <div className={`popup-row popup-row-nested${livePulse ? ' is-pulse' : ''}`}>
          <div className="popup-row-copy">
            <h4>{p.features.live}</h4>
            <p>{p.managedAiReady}</p>
          </div>
          <span className="popup-toggle is-off" aria-hidden="true" />
        </div>
        <div className="popup-row">
          <div className="popup-row-copy">
            <h4>{p.features.layout}</h4>
            <p>{p.ready}</p>
          </div>
          <span className="popup-toggle" aria-hidden="true" />
        </div>

        <div className="popup-footbar">
          <span>{p.usageLabel}</span>
          <strong>{p.openDashboard}</strong>
        </div>
      </div>
      {compact ? null : (
        <figcaption>
          <DemoCaption />
        </figcaption>
      )}
    </figure>
  )
}
