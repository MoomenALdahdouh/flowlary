import { useCallback, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useInView } from '../../hooks/useInView.ts'
import { useDemoSequence, type Later } from '../../hooks/useDemoSequence.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { BrowserStage } from '../product/BrowserStage.tsx'
import { ComposeFrame, DemoCaption } from './ComposeFrame.tsx'

type SurfaceId = 'email' | 'document' | 'chat' | 'profile'

export function WhereYouWrite() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const w = t.demos.where
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>(false)
  const [index, setIndex] = useState(0)

  const run = useCallback((later: Later) => {
    const tick = (from: number) => {
      later(() => {
        const next = (from + 1) % w.surfaceIds.length
        setIndex(next)
        tick(next)
      }, 2600)
    }
    tick(0)
  }, [w.surfaceIds.length])

  useDemoSequence(Boolean(inView && !reduced), run)

  const surfaceId = w.surfaceIds[index] as SurfaceId

  return (
    <figure ref={ref} dir={direction} lang={locale}>
      <div className="where-tabs" aria-hidden="true">
        {w.surfaceIds.map((id, i) => (
          <span key={id} className={`where-tab${i === index ? ' is-on' : ''}`}>
            {w.tabs[id as SurfaceId]}
          </span>
        ))}
      </div>
      <BrowserStage url={w.urls[surfaceId]}>
        <div className="page-field-meta">
          <span>{w.chrome[surfaceId]}</span>
          <span>{t.demos.shared.activeField}</span>
        </div>
        <ComposeFrame title={w.frameTitle} status={w.frameStatus}>
          <p className="compose-text">{w.sampleText}</p>
        </ComposeFrame>
      </BrowserStage>
      <DemoCaption />
      <p className="mock-caption">{w.disclaimer}</p>
    </figure>
  )
}
