import { useEffect, useRef, useState } from 'react'
import { LIVE_EXAMPLE, liveTranslationProgress } from '../demoData.ts'
import { DemoInput, DemoResult, DemoStatus } from '../DemoPrimitives.tsx'
import { useMessages } from '../../../i18n/index.tsx'
import { playgroundStatus } from '../playgroundUtils.ts'

export function LiveTranslationMode() {
  const t = useMessages()
  const pg = t.playground.live
  const [enabled, setEnabled] = useState(false)
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [translated, setTranslated] = useState(false)
  const pauseTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    }
  }, [])

  const onToggle = () => {
    const next = !enabled
    setEnabled(next)
    if (!next) {
      setListening(false)
      setTranslated(false)
      if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    }
  }

  const onInput = (value: string) => {
    setInput(value)
    setTranslated(false)

    if (!enabled) return

    setListening(true)
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current)

    pauseTimer.current = window.setTimeout(() => {
      setListening(false)
      if (value.trim() === LIVE_EXAMPLE.input.trim()) {
        setTranslated(true)
      }
    }, 520)
  }

  const preview = enabled
    ? liveTranslationProgress(input, LIVE_EXAMPLE.input, LIVE_EXAMPLE.output)
    : ''

  const statusText = !enabled
    ? playgroundStatus(t, 'offByDefault')
    : listening
      ? playgroundStatus(t, 'listening')
      : translated
        ? playgroundStatus(t, 'translated')
        : input
          ? playgroundStatus(t, 'listening')
          : playgroundStatus(t, 'ready')

  const statusTone = !enabled
    ? 'neutral'
    : listening
      ? 'listening'
      : translated
        ? 'success'
        : 'neutral'

  return (
    <div className="pg-mode pg-mode-live">
      <div className="pg-live-header">
        <span className="pg-field-label">{pg.title}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className={`pg-toggle${enabled ? ' is-on' : ''}`}
          onClick={onToggle}
        >
          <span className="pg-toggle-track">
            <span className="pg-toggle-thumb" />
          </span>
          <span className="pg-toggle-label">{enabled ? pg.toggleOn : pg.toggleOff}</span>
        </button>
      </div>
      <p className="pg-live-note">{pg.note}</p>
      <DemoInput
        id="pg-live-input"
        label={pg.typeLabel}
        value={input}
        onChange={onInput}
        onFocus={() => {
          if (!enabled) setEnabled(true)
        }}
        rows={2}
        dir="ltr"
        lang="en"
        placeholder={enabled ? pg.placeholderOn : pg.placeholderOff}
      />
      <DemoResult
        label={pg.previewLabel}
        visible={enabled && Boolean(preview)}
        dir="rtl"
        lang="ar"
      >
        <p className="pg-diff-text">{preview}</p>
      </DemoResult>
      {enabled && input && !translated && !listening ? (
        <p className="pg-fallback">{pg.sampleHint}</p>
      ) : null}
      <DemoStatus label={t.playground.statusLabel} value={statusText} tone={statusTone} />
    </div>
  )
}
