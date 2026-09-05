import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DashboardSection } from '../../config/dashboard.ts'
import { t } from '../../popup/i18n/index.ts'
import { markDashboardTourCompleted } from './tourStorage.ts'

export type TourStepId =
  | 'welcome'
  | 'compose'
  | 'features'
  | 'progress'
  | 'practice'
  | 'settings'
  | 'account'

type TourStep = {
  id: TourStepId
  target?: string
  section?: DashboardSection
  /** Prefer card placement relative to the spotlight target. */
  prefer?: 'right' | 'left' | 'below' | 'above' | 'center'
  titleKey: string
  bodyKey: string
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    prefer: 'center',
    titleKey: 'tour.welcomeTitle',
    bodyKey: 'tour.welcomeBody',
  },
  {
    id: 'compose',
    target: 'compose',
    section: 'practice',
    prefer: 'below',
    titleKey: 'tour.composeTitle',
    bodyKey: 'tour.composeBody',
  },
  {
    id: 'features',
    target: 'features',
    section: 'settings',
    prefer: 'below',
    titleKey: 'tour.featuresTitle',
    bodyKey: 'tour.featuresBody',
  },
  {
    id: 'progress',
    target: 'nav-progress',
    section: 'overview',
    prefer: 'right',
    titleKey: 'tour.progressTitle',
    bodyKey: 'tour.progressBody',
  },
  {
    id: 'practice',
    target: 'nav-practice',
    section: 'overview',
    prefer: 'right',
    titleKey: 'tour.practiceTitle',
    bodyKey: 'tour.practiceBody',
  },
  {
    id: 'settings',
    target: 'nav-settings',
    section: 'overview',
    prefer: 'right',
    titleKey: 'tour.settingsTitle',
    bodyKey: 'tour.settingsBody',
  },
  {
    id: 'account',
    target: 'account',
    section: 'overview',
    prefer: 'below',
    titleKey: 'tour.accountTitle',
    bodyKey: 'tour.accountBody',
  },
]

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
}

type CardPos = {
  top: number
  left: number
  placement: 'right' | 'left' | 'below' | 'above' | 'center'
}

type DashboardTourProps = {
  open: boolean
  onNavigate: (section: DashboardSection) => void
  onClose: () => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function overlaps(
  a: { top: number; left: number; width: number; height: number },
  b: { top: number; left: number; width: number; height: number },
  pad = 12,
) {
  return !(
    a.left + a.width + pad <= b.left ||
    b.left + b.width + pad <= a.left ||
    a.top + a.height + pad <= b.top ||
    b.top + b.height + pad <= a.top
  )
}

function placeCard(
  target: SpotlightRect | null,
  cardWidth: number,
  cardHeight: number,
  prefer: TourStep['prefer'] = 'below',
): CardPos {
  const margin = 16
  const gap = 18
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxLeft = Math.max(margin, vw - cardWidth - margin)
  const maxTop = Math.max(margin, vh - cardHeight - margin)

  if (!target || prefer === 'center') {
    return {
      top: clamp((vh - cardHeight) / 2, margin, maxTop),
      left: clamp((vw - cardWidth) / 2, margin, maxLeft),
      placement: 'center',
    }
  }

  // Wide cards (compose / features): park the tooltip beside the spotlight,
  // not over the tabs/controls it is describing.
  const wideTarget = target.width > 420
  const sideTop = clamp(target.top + Math.min(24, target.height / 6), margin, maxTop)
  const belowLeft = clamp(
    wideTarget ? target.left + Math.max(0, target.width - cardWidth) : target.left,
    margin,
    maxLeft,
  )

  const candidates: Array<{ placement: CardPos['placement']; top: number; left: number }> = [
    {
      placement: 'right',
      top: sideTop,
      left: clamp(target.left + target.width + gap, margin, maxLeft),
    },
    {
      placement: 'left',
      top: sideTop,
      left: clamp(target.left - cardWidth - gap, margin, maxLeft),
    },
    {
      placement: 'below',
      top: clamp(target.top + target.height + gap, margin, maxTop),
      left: belowLeft,
    },
    {
      placement: 'above',
      top: clamp(target.top - cardHeight - gap, margin, maxTop),
      left: belowLeft,
    },
  ]

  const preferred: CardPos['placement'] = wideTarget
    ? prefer === 'left'
      ? 'left'
      : 'right'
    : (prefer ?? 'below')

  const order: CardPos['placement'][] = [
    preferred,
    ...(['right', 'left', 'below', 'above'] as const).filter((p) => p !== preferred),
  ]

  for (const placement of order) {
    const candidate = candidates.find((c) => c.placement === placement)
    if (!candidate) continue
    const box = { top: candidate.top, left: candidate.left, width: cardWidth, height: cardHeight }
    const fits =
      candidate.left >= margin - 1 &&
      candidate.top >= margin - 1 &&
      candidate.left + cardWidth <= vw - margin + 1 &&
      candidate.top + cardHeight <= vh - margin + 1
    if (fits && !overlaps(box, target)) {
      return { top: candidate.top, left: candidate.left, placement: candidate.placement }
    }
  }

  // Fallback: park the card in the main content area (right of a typical sidebar).
  return {
    top: clamp(target.top, margin, maxTop),
    left: clamp(Math.max(target.left + target.width + gap, 240), margin, maxLeft),
    placement: 'right',
  }
}

export function DashboardTour({ open, onNavigate, onClose }: DashboardTourProps) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [cardPos, setCardPos] = useState<CardPos>({ top: 96, left: 96, placement: 'center' })
  const cardRef = useRef<HTMLDivElement>(null)

  const step = STEPS[index] ?? STEPS[0]!
  const total = STEPS.length
  const isLast = index >= total - 1

  const progressLabel = useMemo(
    () => t('tour.stepIndicator', { current: String(index + 1), total: String(total) }),
    [index, total],
  )

  const finish = useCallback(async () => {
    await markDashboardTourCompleted()
    onClose()
  }, [onClose])

  const goNext = useCallback(async () => {
    if (isLast) {
      await finish()
      return
    }
    setIndex((current) => Math.min(current + 1, total - 1))
  }, [finish, isLast, total])

  const goBack = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1))
  }, [])

  useEffect(() => {
    if (!open) {
      setIndex(0)
      return
    }
    if (step.section) onNavigate(step.section)
  }, [open, step.id, step.section, onNavigate])

  useLayoutEffect(() => {
    if (!open) return

    function measure() {
      const padding = 8
      const cardWidth = cardRef.current?.offsetWidth ?? 340
      const cardHeight = 220

      if (!step.target) {
        setRect(null)
        setCardPos(placeCard(null, cardWidth, cardHeight, 'center'))
        return
      }

      const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null
      if (!el) {
        setRect(null)
        setCardPos(placeCard(null, cardWidth, cardHeight, 'center'))
        return
      }

      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      const bounds = el.getBoundingClientRect()

      // Cap huge targets (compose / features cards) so spotlight stays readable.
      const maxSpotlightHeight = Math.min(bounds.height + padding * 2, Math.round(window.innerHeight * 0.42))
      const nextRect: SpotlightRect = {
        top: Math.max(8, bounds.top - padding),
        left: Math.max(8, bounds.left - padding),
        width: Math.min(window.innerWidth - 16, bounds.width + padding * 2),
        height: Math.min(window.innerHeight - 16, maxSpotlightHeight),
      }
      setRect(nextRect)
      setCardPos(placeCard(nextRect, cardWidth, cardHeight, step.prefer))
    }

    measure()
    const timer = window.setTimeout(measure, 200)
    const timer2 = window.setTimeout(measure, 420)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(timer2)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step.id, step.target, step.prefer, index])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        void finish()
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        void goNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, finish, goNext, goBack])

  if (!open) return null

  const viewportPad = 8
  const panels = rect
    ? {
        top: { top: 0, left: 0, width: '100%', height: Math.max(0, rect.top - viewportPad) },
        left: {
          top: Math.max(0, rect.top - viewportPad),
          left: 0,
          width: Math.max(0, rect.left - viewportPad),
          height: rect.height + viewportPad * 2,
        },
        right: {
          top: Math.max(0, rect.top - viewportPad),
          left: rect.left + rect.width + viewportPad,
          width: Math.max(0, window.innerWidth - (rect.left + rect.width + viewportPad)),
          height: rect.height + viewportPad * 2,
        },
        bottom: {
          top: rect.top + rect.height + viewportPad,
          left: 0,
          width: '100%',
          height: Math.max(0, window.innerHeight - (rect.top + rect.height + viewportPad)),
        },
      }
    : null

  return (
    <div className="fl-tour" role="dialog" aria-modal="true" aria-labelledby="fl-tour-title">
      {rect ? (
        <>
          {(['top', 'left', 'right', 'bottom'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`fl-tour-panel fl-tour-panel-${key}`}
              style={panels?.[key]}
              aria-label={t('tour.skip')}
              onClick={() => void finish()}
            />
          ))}
          <div
            className="fl-tour-spotlight"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <button type="button" className="fl-tour-scrim" aria-label={t('tour.skip')} onClick={() => void finish()} />
      )}

      <div
        ref={cardRef}
        className={`fl-tour-card is-${cardPos.placement}`}
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <div className="fl-tour-card-body">
        <div className="fl-tour-card-top">
          <p className="fl-tour-kicker">{progressLabel}</p>
          <button type="button" className="fl-tour-skip" onClick={() => void finish()}>
            {t('tour.skip')}
          </button>
        </div>
        <h2 id="fl-tour-title" className="fl-tour-title">
          {t(step.titleKey)}
        </h2>
        <p className="fl-tour-body">{t(step.bodyKey)}</p>
        <div className="fl-tour-dots" aria-hidden="true">
          {STEPS.map((item, i) => (
            <span
              key={item.id}
              className={`fl-tour-dot${i === index ? ' is-active' : ''}${i < index ? ' is-done' : ''}`}
            />
          ))}
        </div>
        <div className="fl-tour-actions">
          <button
            type="button"
            className="fl-action-btn fl-action-btn-compact fl-onboarding-btn"
            disabled={index === 0}
            onClick={goBack}
          >
            {t('tour.back')}
          </button>
          <button
            type="button"
            className="fl-action-btn fl-action-btn-compact fl-action-btn-primary fl-onboarding-btn fl-onboarding-btn-primary"
            onClick={() => void goNext()}
          >
            {isLast ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
