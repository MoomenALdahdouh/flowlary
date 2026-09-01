import { useCallback, useState } from 'react'
import { SPEEDBOX_EXAMPLES, findSpeedBoxExample, type SpeedBoxExample } from '../demoData.ts'
import {
  DemoButton,
  DemoFallback,
  DemoInput,
  DemoResult,
  DemoStatus,
  ExampleSelector,
  ProcessingOverlay,
  type DemoPhase,
} from '../DemoPrimitives.tsx'
import { useMessages } from '../../../i18n/index.tsx'
import { playgroundExampleLabel, playgroundStatus } from '../playgroundUtils.ts'

export function SpeedBoxMode() {
  const t = useMessages()
  const pg = t.playground.speedbox
  const [example, setExample] = useState(SPEEDBOX_EXAMPLES[0])
  const [input, setInput] = useState(SPEEDBOX_EXAMPLES[0].input)
  const [from, setFrom] = useState<'ar' | 'en'>(SPEEDBOX_EXAMPLES[0].from)
  const [to, setTo] = useState<'ar' | 'en'>(SPEEDBOX_EXAMPLES[0].to)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [output, setOutput] = useState<string | null>(null)

  const applyExample = useCallback((next: SpeedBoxExample) => {
    setExample(next)
    setInput(next.input)
    setFrom(next.from)
    setTo(next.to)
    setPhase('idle')
    setOutput(null)
  }, [])

  const convert = () => {
    const match = findSpeedBoxExample(input, from, to)
    if (!match) {
      setPhase('error')
      setOutput(null)
      return
    }
    setPhase('working')
    window.setTimeout(() => {
      setOutput(match.output)
      setPhase('done')
    }, 420)
  }

  const statusText =
    phase === 'working'
      ? playgroundStatus(t, 'working')
      : phase === 'done'
        ? playgroundStatus(t, 'converted')
        : phase === 'error'
          ? playgroundStatus(t, 'tryExample')
          : playgroundStatus(t, 'ready')

  const statusTone = phase === 'working' ? 'working' : phase === 'done' ? 'success' : 'neutral'

  return (
    <div className="pg-mode pg-mode-speedbox">
      <div className="pg-speedbox-head">
        <h4 className="pg-speedbox-title">{pg.title}</h4>
        <p className="pg-speedbox-desc">{pg.description}</p>
      </div>
      <ExampleSelector
        examples={SPEEDBOX_EXAMPLES}
        activeId={example.id}
        onSelect={applyExample}
        ariaLabel={pg.examplesAria}
        renderLabel={(_, index) => playgroundExampleLabel(t.playground.example, index)}
      />
      <DemoInput
        id="pg-speedbox-input"
        label={t.playground.field.input}
        value={input}
        onChange={setInput}
        mono
        dir="ltr"
        lang="en"
        rows={1}
        readOnly={phase === 'working'}
      />
      <div className="pg-speedbox-controls">
        <label className="pg-select-field" htmlFor="pg-speedbox-from">
          <span className="pg-field-label">{t.playground.field.from}</span>
          <select
            id="pg-speedbox-from"
            value={from}
            onChange={(e) => setFrom(e.target.value as 'ar' | 'en')}
          >
            <option value="en">{t.playground.lang.english}</option>
            <option value="ar">{t.playground.lang.arabic}</option>
          </select>
        </label>
        <label className="pg-select-field" htmlFor="pg-speedbox-to">
          <span className="pg-field-label">{t.playground.field.to}</span>
          <select
            id="pg-speedbox-to"
            value={to}
            onChange={(e) => setTo(e.target.value as 'ar' | 'en')}
          >
            <option value="ar">{t.playground.lang.arabic}</option>
            <option value="en">{t.playground.lang.english}</option>
          </select>
        </label>
      </div>
      <div className="pg-mode-actions">
        <DemoButton onClick={convert} disabled={phase === 'working'}>
          {pg.convertButton}
        </DemoButton>
      </div>
      {phase === 'error' ? <DemoFallback message={t.playground.fallback} /> : null}
      <ProcessingOverlay visible={phase === 'working'} />
      <DemoResult
        label={t.playground.field.result}
        visible={phase === 'done' && Boolean(output)}
        dir={to === 'ar' ? 'rtl' : 'ltr'}
        lang={to === 'ar' ? 'ar' : 'en'}
      >
        <p className="pg-diff-text">{output}</p>
      </DemoResult>
      <DemoStatus label={t.playground.statusLabel} value={statusText} tone={statusTone} />
    </div>
  )
}
