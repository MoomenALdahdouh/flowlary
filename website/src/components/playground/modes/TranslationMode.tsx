import { useCallback, useState } from 'react'
import {
  TRANSLATION_EXAMPLES,
  findTranslationExample,
  type TranslationExample,
} from '../demoData.ts'
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

export function TranslationMode() {
  const t = useMessages()
  const pg = t.playground.translation
  const initial = TRANSLATION_EXAMPLES[0]
  const [example, setExample] = useState(initial)
  const [from, setFrom] = useState<'ar' | 'en'>(initial.from)
  const [to, setTo] = useState<'ar' | 'en'>(initial.to)
  const [input, setInput] = useState(initial.input)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [output, setOutput] = useState<string | null>(null)

  const filteredExamples = TRANSLATION_EXAMPLES.filter((ex) => ex.from === from && ex.to === to)

  const applyExample = useCallback((next: TranslationExample) => {
    setExample(next)
    setFrom(next.from)
    setTo(next.to)
    setInput(next.input)
    setPhase('idle')
    setOutput(null)
  }, [])

  const swapDirection = () => {
    const nextFrom = to
    const nextTo = from
    setFrom(nextFrom)
    setTo(nextTo)
    const match = TRANSLATION_EXAMPLES.find((ex) => ex.from === nextFrom && ex.to === nextTo)
    if (match) applyExample(match)
    else {
      setInput('')
      setOutput(null)
      setPhase('idle')
    }
  }

  const translate = () => {
    const match = findTranslationExample(input, from, to)
    if (!match) {
      setPhase('error')
      setOutput(null)
      return
    }
    setPhase('working')
    window.setTimeout(() => {
      setOutput(match.output)
      setPhase('done')
    }, 720)
  }

  const statusText =
    phase === 'working'
      ? playgroundStatus(t, 'working')
      : phase === 'done'
        ? playgroundStatus(t, 'translated')
        : phase === 'error'
          ? playgroundStatus(t, 'tryExample')
          : playgroundStatus(t, 'ready')

  const statusTone = phase === 'working' ? 'working' : phase === 'done' ? 'success' : 'neutral'

  const langFrom = from === 'ar' ? 'ar' : 'en'
  const langTo = to === 'ar' ? 'ar' : 'en'

  return (
    <div className="pg-mode pg-mode-translation">
      <div className="pg-direction">
        <button
          type="button"
          className={`pg-lang${from === 'ar' ? ' is-active' : ''}`}
          onClick={() => {
            if (from !== 'ar') swapDirection()
          }}
        >
          {t.playground.lang.arabic}
        </button>
        <button
          type="button"
          className="pg-direction-swap"
          aria-label={pg.swapAria}
          onClick={swapDirection}
        >
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className={`pg-lang${to === 'en' ? ' is-active' : ''}`}
          onClick={() => {
            if (to !== 'en') swapDirection()
          }}
        >
          {t.playground.lang.english}
        </button>
      </div>
      {filteredExamples.length > 0 ? (
        <ExampleSelector
          examples={filteredExamples}
          activeId={example.id}
          onSelect={applyExample}
          ariaLabel={pg.examplesAria}
          renderLabel={(_, index) => playgroundExampleLabel(t.playground.example, index)}
        />
      ) : null}
      <div className="pg-mode-workspace">
        <DemoInput
          id="pg-translation-input"
          label={pg.textLabel}
          value={input}
          onChange={setInput}
          dir={from === 'ar' ? 'rtl' : 'ltr'}
          lang={langFrom}
          rows={3}
          readOnly={phase === 'working'}
        />
        <ProcessingOverlay visible={phase === 'working'} />
      </div>
      <div className="pg-mode-actions">
        <DemoButton onClick={translate} disabled={phase === 'working'}>
          {pg.translateButton}
        </DemoButton>
      </div>
      {phase === 'error' ? <DemoFallback message={t.playground.fallback} /> : null}
      <DemoResult
        label={pg.resultLabel}
        visible={phase === 'done' && Boolean(output)}
        dir={to === 'ar' ? 'rtl' : 'ltr'}
        lang={langTo}
      >
        <p className="pg-diff-text">{output}</p>
      </DemoResult>
      <DemoStatus label={t.playground.statusLabel} value={statusText} tone={statusTone} />
    </div>
  )
}
