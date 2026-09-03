import { Button } from '../Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function SteppedDemoControls({
  playing,
  isFirst,
  isLast,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onReplay,
  onReset,
  compact = false,
}: {
  playing: boolean
  isFirst: boolean
  isLast: boolean
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onReplay: () => void
  onReset: () => void
  compact?: boolean
}) {
  const t = useMessages()
  const c = t.experience.controls

  return (
    <div className={`xp-demo-controls${compact ? ' is-compact' : ''}`} role="group" aria-label={c.groupLabel}>
      <Button variant="ghost" className="btn-sm" onClick={onPrev} disabled={isFirst} ariaLabel={c.previous}>
        {c.previous}
      </Button>
      {playing ? (
        <Button variant="secondary" className="btn-sm" onClick={onPause} ariaLabel={c.pause}>
          {c.pause}
        </Button>
      ) : (
        <Button variant="secondary" className="btn-sm" onClick={onPlay} ariaLabel={c.play}>
          {c.play}
        </Button>
      )}
      <Button variant="ghost" className="btn-sm" onClick={onNext} disabled={isLast} ariaLabel={c.next}>
        {c.next}
      </Button>
      <Button variant="ghost" className="btn-sm" onClick={onReplay} ariaLabel={c.replay}>
        {c.replay}
      </Button>
      <Button variant="ghost" className="btn-sm" onClick={onReset} ariaLabel={c.reset}>
        {c.reset}
      </Button>
    </div>
  )
}

export function DemoPhaseRail({
  phases,
  activeIndex,
}: {
  phases: { id: string; label: string }[]
  activeIndex: number
}) {
  return (
    <ol className="xp-phase-rail" aria-label="Demo progression">
      {phases.map((phase, index) => (
        <li
          key={phase.id}
          className={`xp-phase-rail-item${index <= activeIndex ? ' is-active' : ''}${index === activeIndex ? ' is-current' : ''}`}
          aria-current={index === activeIndex ? 'step' : undefined}
        >
          <span className="xp-phase-rail-dot" aria-hidden="true" />
          <span className="xp-phase-rail-label">{phase.label}</span>
        </li>
      ))}
    </ol>
  )
}
