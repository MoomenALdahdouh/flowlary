import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'

type ProblemCard = {
  title: string
  description: string
  example: string
  exampleLabel: string
  fixed: string
  fixedLabel: string
  fromItems?: readonly string[]
  toItem?: string
}

function suggestionRows(fixed: string): { from: string; to: string }[] {
  return fixed
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const [from, to] = part.split('→').map((item) => item.trim())
      return from && to ? { from, to } : null
    })
    .filter((row): row is { from: string; to: string } => row !== null)
}

function useInView<T extends HTMLElement>(threshold = 0.4) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold })
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, inView }
}

function Caret() {
  return <span className="hp-caret" aria-hidden="true" />
}

export function ProblemExplainDemo({
  item,
  join,
  delayMs = 0,
}: {
  item: ProblemCard
  join: string
  delayMs?: number
}) {
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  const hints = suggestionRows(item.fixed)
  const fromItems = item.fromItems
  const chips = fromItems ?? []
  const [typed, setTyped] = useState(reduced ? item.example : '')
  const [chipCount, setChipCount] = useState(reduced ? chips.length : 0)
  const [showResult, setShowResult] = useState(reduced)

  useEffect(() => {
    const nextChips = fromItems ?? []
    if (reduced) {
      setTyped(item.example)
      setChipCount(nextChips.length)
      setShowResult(true)
      return
    }
    if (!inView) {
      setTyped('')
      setChipCount(0)
      setShowResult(false)
      return
    }

    const timers: number[] = []
    let cancelled = false

    function play() {
      if (cancelled) return
      setTyped('')
      setChipCount(0)
      setShowResult(false)

      timers.push(
        window.setTimeout(() => {
          if (cancelled) return
          if (nextChips.length > 0) {
            nextChips.forEach((_, index) => {
              timers.push(
                window.setTimeout(() => {
                  if (!cancelled) setChipCount(index + 1)
                }, index * 380),
              )
            })
            timers.push(
              window.setTimeout(() => {
                if (!cancelled) setShowResult(true)
              }, nextChips.length * 380 + 420),
            )
            timers.push(
              window.setTimeout(() => {
                if (!cancelled) play()
              }, nextChips.length * 380 + 3200),
            )
            return
          }

          const charMs = item.example.length > 40 ? 28 : 70
          let i = 0
          const tick = window.setInterval(() => {
            i += 1
            if (cancelled) {
              window.clearInterval(tick)
              return
            }
            setTyped(item.example.slice(0, i))
            if (i >= item.example.length) {
              window.clearInterval(tick)
              timers.push(
                window.setTimeout(() => {
                  if (!cancelled) setShowResult(true)
                }, 450),
              )
              timers.push(
                window.setTimeout(() => {
                  if (!cancelled) play()
                }, 3400),
              )
            }
          }, charMs)
          timers.push(tick)
        }, delayMs),
      )
    }

    play()
    return () => {
      cancelled = true
      timers.forEach((id) => {
        window.clearTimeout(id)
        window.clearInterval(id)
      })
    }
  }, [delayMs, fromItems, inView, item.example, reduced])

  const typing = !reduced && inView && !showResult && chips.length === 0 && typed.length < item.example.length

  return (
    <div ref={ref} className="hp-explain-demo" aria-live="polite">
      <p className="hp-explain-kicker">{item.exampleLabel}</p>
      {chips.length > 0 ? (
        <div className="hp-explain-chips">
          {chips.map((chip, index) => (
            <span key={chip} className={`hp-explain-chip${index < chipCount ? ' is-in' : ''}`}>
              {chip}
            </span>
          ))}
        </div>
      ) : (
        <div className="hp-explain-field hp-explain-field--from" dir="auto">
          {typed}
          {typing ? <Caret /> : null}
        </div>
      )}
      <p className={`hp-explain-join${showResult ? ' is-on' : ''}`}>{join}</p>
      <p className="hp-explain-kicker">{item.fixedLabel}</p>
      <div className={`hp-explain-result${showResult ? ' is-in' : ''}`}>
        {item.toItem ? (
          <span className="hp-explain-chip hp-explain-chip--one">{item.toItem}</span>
        ) : hints.length > 0 ? (
          <ul className="hp-explain-hints">
            {hints.map((row) => (
              <li key={`${row.from}-${row.to}`}>
                <span className="hp-explain-from">{row.from}</span>
                <span className="hp-explain-arrow" aria-hidden="true">
                  →
                </span>
                <span className="hp-explain-to">{row.to}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="hp-explain-field hp-explain-field--to" dir="auto">
            {item.fixed}
          </div>
        )}
      </div>
    </div>
  )
}

export function SignatureFieldDemo({
  beforeLabel,
  beforeNote,
  afterLabel,
  afterNote,
  badge,
  typedSource,
  fixedSource,
  scenes,
}: {
  beforeLabel: string
  beforeNote: string
  afterLabel: string
  afterNote: string
  badge: string
  typedSource?: string
  fixedSource?: string
  scenes?: readonly { typed: string; fixed: string }[]
}) {
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLElement>(0.35)
  const list = scenes && scenes.length > 0
    ? scenes
    : [{ typed: typedSource ?? '', fixed: fixedSource ?? '' }]
  const [sceneIndex, setSceneIndex] = useState(0)
  const scene = list[sceneIndex] ?? list[0]
  const [typed, setTyped] = useState(reduced ? scene.typed : '')
  const [repaired, setRepaired] = useState(reduced)

  useEffect(() => {
    if (reduced) {
      setTyped(scene.typed)
      setRepaired(true)
      return
    }
    if (!inView) {
      setTyped('')
      setRepaired(false)
      return
    }

    const timers: number[] = []
    let cancelled = false
    const source = scene.typed

    function play() {
      if (cancelled) return
      setTyped('')
      setRepaired(false)
      let i = 0
      const tick = window.setInterval(() => {
        i += 1
        if (cancelled) {
          window.clearInterval(tick)
          return
        }
        setTyped(source.slice(0, i))
        if (i >= source.length) {
          window.clearInterval(tick)
          timers.push(
            window.setTimeout(() => {
              if (!cancelled) setRepaired(true)
            }, 700),
          )
          timers.push(
            window.setTimeout(() => {
              if (!cancelled) setSceneIndex((current) => (current + 1) % list.length)
            }, 4200),
          )
        }
      }, 95)
      timers.push(tick)
    }

    play()
    return () => {
      cancelled = true
      timers.forEach((id) => {
        window.clearTimeout(id)
        window.clearInterval(id)
      })
    }
  }, [inView, reduced, scene.typed, list.length])

  const typing = !reduced && inView && !repaired && typed.length < scene.typed.length

  return (
    <article ref={ref} className="hp-sig-demo" aria-live="polite">
      <div className="hp-sig-demo__chrome" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="hp-sig-pane hp-sig-pane--typed">
        <p className="hp-sig-kicker">{beforeLabel}</p>
        <p className="hp-sig-type" dir="auto">
          {typed}
          {typing ? <Caret /> : null}
        </p>
        <p className="hp-sig-note">{beforeNote}</p>
      </div>
      <p className={`hp-sig-join${repaired ? ' is-on' : ''}`}>
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {badge}
      </p>
      <div className={`hp-sig-pane hp-sig-pane--fixed${repaired ? ' is-in' : ''}`}>
        <p className="hp-sig-kicker">{afterLabel}</p>
        <p className="hp-sig-type font-arabic" dir="rtl">
          {repaired ? scene.fixed : ''}
        </p>
        <p className="hp-sig-note">{afterNote}</p>
      </div>
    </article>
  )
}
