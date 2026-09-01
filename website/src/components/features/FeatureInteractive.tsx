import { useState } from 'react'
import { Button } from '../Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'

const CORRECTION_SOURCE = 'I recieved the mesage yesterday'
const CORRECTION_FIXED = 'I received the message yesterday.'
const TRANSLATION_SOURCE = 'كيف حالك اليوم؟'
const TRANSLATION_TARGET = 'How are you today?'
const LAYOUT_TYPED = 'lvpfh'
const LAYOUT_FIXED = 'مرحبا'
const SPEED_INPUT = 'lvpfh'
const SPEED_OUTPUT = 'مرحبا'
const LIVE_SOURCE = 'How are you'
const LIVE_TARGET = 'كيف حالك؟'

export function CorrectionInteractive() {
  const t = useMessages()
  const f = t.featuresPage.interactive
  const [text, setText] = useState(CORRECTION_SOURCE)
  const [corrected, setCorrected] = useState(false)

  return (
    <div className="feat-interactive">
      <label className="ac-field">
        <span>{f.inputLabel}</span>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setCorrected(false)
          }}
          dir="ltr"
          lang="en"
        />
      </label>
      <Button
        type="button"
        onClick={() => {
          setText(CORRECTION_FIXED)
          setCorrected(true)
        }}
      >
        {f.correctButton}
      </Button>
      {corrected ? (
        <p className="feat-result is-highlight" dir="ltr" lang="en" role="status">
          {CORRECTION_FIXED}
        </p>
      ) : null}
    </div>
  )
}

export function TranslationInteractive() {
  const t = useMessages()
  const f = t.featuresPage.interactive
  const [source, setSource] = useState(TRANSLATION_SOURCE)
  const [result, setResult] = useState('')

  return (
    <div className="feat-interactive">
      <label className="ac-field">
        <span>{f.sourceLabel}</span>
        <textarea value={source} onChange={(e) => setSource(e.target.value)} dir="rtl" lang="ar" />
      </label>
      <div className="ac-field">
        <span>{f.targetLabel}</span>
        <select defaultValue="en" aria-label={f.targetLabel}>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </select>
      </div>
      <Button type="button" onClick={() => setResult(TRANSLATION_TARGET)}>
        {f.translateButton}
      </Button>
      {result ? (
        <p className="feat-result is-highlight" dir="ltr" lang="en" role="status">
          {result}
        </p>
      ) : null}
    </div>
  )
}

export function LiveInteractive() {
  const t = useMessages()
  const f = t.featuresPage.interactive
  const live = t.demos.live
  const [enabled, setEnabled] = useState(false)
  const [text, setText] = useState(LIVE_SOURCE)

  return (
    <div className="feat-interactive">
      <div className="live-toolbar" aria-hidden="true">
        <span>{live.toolbarTitle}</span>
        <button
          type="button"
          className={`popup-toggle${enabled ? '' : ' is-off'}`}
          aria-pressed={enabled}
          onClick={() => {
            setEnabled((value) => !value)
            setText(LIVE_SOURCE)
          }}
        />
        <span className={`live-flag${enabled ? ' is-on' : ''}`}>
          {enabled ? live.toggleOn : live.toggleOff}
        </span>
      </div>
      <label className="ac-field">
        <span>{f.inputLabel}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          dir="ltr"
          lang="en"
          disabled={!enabled}
        />
      </label>
      <Button
        type="button"
        disabled={!enabled}
        onClick={() => setText(LIVE_TARGET)}
      >
        {f.simulatePause}
      </Button>
      {text === LIVE_TARGET ? (
        <p className="feat-result is-highlight" dir="rtl" lang="ar" role="status">
          {LIVE_TARGET}
        </p>
      ) : null}
    </div>
  )
}

export function LayoutInteractive() {
  const t = useMessages()
  const f = t.featuresPage.interactive
  const [fixed, setFixed] = useState(false)

  return (
    <div className="feat-interactive">
      <label className="ac-field">
        <span>{f.inputLabel}</span>
        <input value={fixed ? LAYOUT_FIXED : LAYOUT_TYPED} readOnly dir={fixed ? 'rtl' : 'ltr'} />
      </label>
      <p className="ac-hint">{f.layoutHint}</p>
      <Button type="button" onClick={() => setFixed(true)}>
        {f.fixLayoutButton}
      </Button>
      {fixed ? (
        <p className="feat-result is-highlight" dir="rtl" lang="ar" role="status">
          {LAYOUT_FIXED}
        </p>
      ) : null}
    </div>
  )
}

export function SpeedBoxInteractive() {
  const t = useMessages()
  const f = t.featuresPage.interactive
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')

  return (
    <div className="feat-interactive">
      <p className="ac-hint" dir="ltr">
        {t.demos.speedbox.layoutPair}
      </p>
      <label className="ac-field">
        <span>{t.playground.field.input}</span>
        <input value={input} onChange={(e) => setInput(e.target.value)} dir="ltr" placeholder={SPEED_INPUT} />
      </label>
      <Button
        type="button"
        onClick={() => setOutput(input.trim() ? SPEED_OUTPUT : '')}
      >
        {t.playground.speedbox.convertButton}
      </Button>
      {output ? (
        <p className="feat-result is-highlight" dir="rtl" lang="ar" role="status">
          {output}
        </p>
      ) : null}
    </div>
  )
}

export function FeatureIcon({ name }: { name: 'history' | 'safety' | 'pause' }) {
  if (name === 'history') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.35" />
        <path d="M10 6.5V10l2.2 1.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'safety') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 3 4.5 5.5v4.8c0 3.1 2.2 5.9 5.5 6.7 3.3-.8 5.5-3.6 5.5-6.7V5.5L10 3Z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.35" />
      <rect x="12" y="4" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  )
}
