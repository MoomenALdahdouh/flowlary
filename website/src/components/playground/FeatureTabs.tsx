import type { KeyboardEvent } from 'react'
import type { FeatureMode } from './demoData.ts'
import { FEATURE_MODES, FeatureIcon } from '../FeatureIcons.tsx'
import { useMessages } from '../../i18n/index.tsx'
import { playgroundTabLabel } from './playgroundUtils.ts'

export function FeatureTabs({
  active,
  onChange,
}: {
  active: FeatureMode
  onChange: (mode: FeatureMode) => void
}) {
  const t = useMessages()

  function focusTab(id: FeatureMode) {
    onChange(id)
    document.getElementById(`pg-tab-${id}`)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowLeft' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return
    }
    event.preventDefault()
    if (event.key === 'Home') {
      focusTab(FEATURE_MODES[0])
      return
    }
    if (event.key === 'End') {
      focusTab(FEATURE_MODES[FEATURE_MODES.length - 1])
      return
    }
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + delta + FEATURE_MODES.length) % FEATURE_MODES.length
    focusTab(FEATURE_MODES[next])
  }

  return (
    <div className="pg-tabs" role="tablist" aria-label={t.playground.tablistAria}>
      {FEATURE_MODES.map((id, index) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`pg-tab-${id}`}
          aria-selected={active === id}
          aria-controls={`pg-panel-${id}`}
          tabIndex={active === id ? 0 : -1}
          className={`pg-tab${active === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <span className="pg-tab-icon">
            <FeatureIcon mode={id} />
          </span>
          <span className="pg-tab-label">{playgroundTabLabel(t, id)}</span>
          {active === id ? <span className="pg-tab-indicator" aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  )
}
