import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CORRECTION_EXAMPLES,
  findCorrectionExample,
  type CorrectionExample,
} from '../demoData.ts'
import {
  DemoButton,
  DemoFallback,
  DemoInput,
  DemoStatus,
  DemoTags,
  DemoToolbar,
  ExampleSelector,
  ProcessingOverlay,
  type DemoPhase,
} from '../DemoPrimitives.tsx'
import { useMessages } from '../../../i18n/index.tsx'
import { playgroundExampleLabel, playgroundStatus } from '../playgroundUtils.ts'

function renderMarkedText(
  text: string,
  marks: { word: string; kind: 'error' | 'ok' }[],
): ReactNode[] {
  const parts: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    let earliest = -1
    let match: { word: string; kind: 'error' | 'ok' } | null = null

    for (const mark of marks) {
      const index = remaining.indexOf(mark.word)
      if (index !== -1 && (earliest === -1 || index < earliest)) {
        earliest = index
        match = mark
      }
    }

    if (earliest === -1 || !match) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    if (earliest > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, earliest)}</span>)
    }

    parts.push(
      <span key={key++} className={`demo-mark is-${match.kind === 'error' ? 'error' : 'ok'}`}>
        {match.word}
      </span>,
    )
    remaining = remaining.slice(earliest + match.word.length)
  }

  return parts
}

export type CorrectionModeProps = {
  autoPlayToken?: number
  readOnly?: boolean
}

export function CorrectionMode({ autoPlayToken = 0, readOnly = false }: CorrectionModeProps) {
  const t = useMessages()
  const pg = t.playground.correction
  const [example, setExample] = useState(CORRECTION_EXAMPLES[0])
  const [input, setInput] = useState(CORRECTION_EXAMPLES[0].input)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [result, setResult] = useState<string | null>(null)

  const applyExample = useCallback((next: CorrectionExample) => {
    setExample(next)
    setInput(next.input)
    setPhase('idle')
    setResult(null)
  }, [])

  const runFix = useCallback(() => {
    const match = findCorrectionExample(input)
    if (!match) {
      setPhase('error')
      setResult(null)
      return
    }
    setPhase('working')
    window.setTimeout(() => {
      setResult(match.output)
      setPhase('done')
    }, 680)
  }, [input])

  useEffect(() => {
    if (!autoPlayToken) return
    const ex = CORRECTION_EXAMPLES[0]
    setExample(ex)
    setInput('')
    setResult(null)
    setPhase('idle')

    const t1 = window.setTimeout(() => {
      setInput(ex.input)
    }, 200)
    const t2 = window.setTimeout(() => setPhase('working'), 700)
    const t3 = window.setTimeout(() => {
      setResult(ex.output)
      setPhase('done')
    }, 1400)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [autoPlayToken])

  const okMarks = useMemo(
    () => example.changes.map((c) => ({ word: c.fixed, kind: 'ok' as const })),
    [example.changes],
  )

  const statusText =
    phase === 'working'
      ? playgroundStatus(t, 'working')
      : phase === 'done'
        ? playgroundStatus(t, 'fixed')
        : phase === 'error'
          ? playgroundStatus(t, 'tryExample')
          : playgroundStatus(t, 'ready')

  const statusTone = phase === 'working' ? 'working' : phase === 'done' ? 'success' : 'neutral'

  return (
    <div className="pg-mode pg-mode-correction">
      <DemoTags tags={[pg.tagEnglish, pg.tagAi]} />
      <ExampleSelector
        examples={CORRECTION_EXAMPLES}
        activeId={example.id}
        onSelect={applyExample}
        ariaLabel={pg.examplesAria}
        renderLabel={(_, index) => playgroundExampleLabel(t.playground.example, index)}
      />

      <div className="pg-mode-split">
        <div className="pg-mode-pane">
          <div className="pg-mode-workspace">
            <DemoInput
              id="pg-correction-input"
              label={pg.writingField}
              value={input}
              onChange={readOnly ? undefined : setInput}
              rows={4}
              dir="ltr"
              lang="en"
              readOnly={readOnly || phase === 'working'}
            />
            <ProcessingOverlay visible={phase === 'working'} />
          </div>
        </div>

        <div className="pg-mode-pane pg-mode-pane-result" aria-live="polite">
          <span className="pg-field-label">{t.playground.field.result}</span>
          {phase === 'done' && result ? (
            <div className="pg-result-body pg-result-inline">
              <p className="pg-diff-text">{renderMarkedText(result, okMarks)}</p>
            </div>
          ) : (
            <div className="pg-result-empty">
              <p>{pg.resultPlaceholder}</p>
            </div>
          )}
        </div>
      </div>

      {phase === 'error' ? <DemoFallback message={t.playground.fallback} /> : null}

      <DemoToolbar
        actions={
          <>
            <DemoButton onClick={runFix} disabled={phase === 'working' || readOnly}>
              {pg.fixButton}
            </DemoButton>
            {phase === 'done' ? (
              <span className="pg-changes-badge" aria-label={pg.changesAria}>
                {pg.changes}
              </span>
            ) : null}
          </>
        }
        status={<DemoStatus compact label={t.playground.statusLabel} value={statusText} tone={statusTone} />}
      />
    </div>
  )
}
