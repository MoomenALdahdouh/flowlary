import { useCallback, useState } from 'react'
import { LAYOUT_EXAMPLES, findLayoutExample, type LayoutExample } from '../demoData.ts'
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

const KEYBOARD_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']

export function LayoutMode() {
  const t = useMessages()
  const pg = t.playground.layout
  const [example, setExample] = useState(LAYOUT_EXAMPLES[0])
  const [input, setInput] = useState(LAYOUT_EXAMPLES[0].wrong)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [step, setStep] = useState<'wrong' | 'detected' | 'corrected'>('wrong')

  const detectedLabel =
    pg.detectedLabels[example.id as keyof typeof pg.detectedLabels] ?? pg.detected

  const applyExample = useCallback((next: LayoutExample) => {
    setExample(next)
    setInput(next.wrong)
    setPhase('idle')
    setStep('wrong')
  }, [])

  const fixLayout = () => {
    const match = findLayoutExample(input)
    if (!match) {
      setPhase('error')
      return
    }
    setPhase('working')
    setStep('wrong')
    window.setTimeout(() => setStep('detected'), 400)
    window.setTimeout(() => setStep('corrected'), 900)
    window.setTimeout(() => setPhase('done'), 1300)
  }

  const statusText =
    phase === 'working'
      ? playgroundStatus(t, 'working')
      : phase === 'done'
        ? playgroundStatus(t, 'layoutCorrected')
        : phase === 'error'
          ? playgroundStatus(t, 'tryExample')
          : playgroundStatus(t, 'ready')

  const statusTone = phase === 'working' ? 'working' : phase === 'done' ? 'success' : 'neutral'

  return (
    <div className="pg-mode pg-mode-layout">
      <ExampleSelector
        examples={LAYOUT_EXAMPLES}
        activeId={example.id}
        onSelect={applyExample}
        ariaLabel={pg.examplesAria}
        renderLabel={(_, index) => playgroundExampleLabel(t.playground.example, index)}
      />
      <DemoInput
        id="pg-layout-input"
        label={pg.inputLabel}
        value={input}
        onChange={setInput}
        mono
        dir="ltr"
        lang="en"
        readOnly={phase === 'working'}
      />
      <div className="pg-keyboard" aria-hidden="true" dir="ltr">
        <span className="pg-keyboard-label">{pg.keyboard}</span>
        <div className="pg-keyboard-row">
          {KEYBOARD_KEYS.map((key) => (
            <span
              key={key}
              className={`pg-key${phase !== 'idle' && key === 'J' ? ' is-lit' : ''}`}
            >
              {key}
            </span>
          ))}
        </div>
      </div>
      <div className="pg-layout-flow">
        <div className={`pg-layout-step${step === 'wrong' ? ' is-active' : ' is-done'}`}>
          <span className="pg-layout-step-label">{pg.wrongLayout}</span>
          <span className="pg-layout-step-value mono" dir="ltr" lang="en">
            {example.wrong}
          </span>
        </div>
        <span className="pg-layout-arrow" aria-hidden="true">
          →
        </span>
        <div
          className={`pg-layout-step${step === 'detected' ? ' is-active' : step === 'corrected' ? ' is-done' : ''}`}
        >
          <span className="pg-layout-step-label">{pg.detected}</span>
          <span className="pg-layout-step-value">{detectedLabel}</span>
        </div>
        <span className="pg-layout-arrow" aria-hidden="true">
          →
        </span>
        <div className={`pg-layout-step${step === 'corrected' ? ' is-active is-done' : ''}`}>
          <span className="pg-layout-step-label">{pg.corrected}</span>
          <span className="pg-layout-step-value" dir="rtl" lang="ar">
            {step === 'corrected' ? example.corrected : '-'}
          </span>
        </div>
      </div>
      <div className="pg-mode-actions">
        <DemoButton onClick={fixLayout} disabled={phase === 'working'}>
          {pg.fixButton}
        </DemoButton>
      </div>
      {phase === 'error' ? <DemoFallback message={t.playground.fallback} /> : null}
      <ProcessingOverlay visible={phase === 'working'} />
      <DemoResult label={pg.resultLabel} visible={phase === 'done'} dir="rtl" lang="ar">
        <p className="pg-diff-text">{example.corrected}</p>
      </DemoResult>
      <DemoStatus label={t.playground.statusLabel} value={statusText} tone={statusTone} />
    </div>
  )
}
