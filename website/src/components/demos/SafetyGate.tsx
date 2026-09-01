import type { ReactElement } from 'react'
import { useInView } from '../../hooks/useInView.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { DemoCaption } from './ComposeFrame.tsx'

type GateId = 'password' | 'otp' | 'payment' | 'apiKey' | 'codeEditor'

const GATE_ICONS: Record<GateId, ReactElement> = {
  password: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M7 9V6.5a3 3 0 1 1 6 0V9"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  ),
  otp: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.35" />
      <path d="M7 10h6M10 8v4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  ),
  payment: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="5.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.35" />
      <path d="M3 8.5h14" stroke="currentColor" strokeWidth="1.35" />
      <path d="M6.5 12h3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  ),
  apiKey: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="11.5" r="3" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M11 9 16 4M14.5 4.5 16 3M14.5 4.5 16 6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  codeEditor: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7 6.5 4 10l3 3.5M13 6.5 16 10l-3 3.5M11.5 5l-3 10"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

export function SafetyGate() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const sg = t.safetyGate
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <figure ref={ref} className={inView ? 'safety-gate is-in' : 'safety-gate'}>
      <div className="safety-card" dir={direction} lang={locale} aria-hidden="true">
        <header className="safety-card-head">
          <span className="safety-card-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M10 3 4.5 5.5v4.8c0 3.1 2.2 5.9 5.5 6.7 3.3-.8 5.5-3.6 5.5-6.7V5.5L10 3Z"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
              <path
                d="m7.5 10 1.8 1.8L12.8 8.3"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="safety-card-intro">
            <strong>{sg.title}</strong>
            <p>{sg.lead}</p>
          </div>
        </header>
        <ul className="safety-list">
          {sg.gates.map((gate) => (
            <li key={gate.id}>
              <span className="safety-row-icon">{GATE_ICONS[gate.id as GateId]}</span>
              <div className="safety-row-copy">
                <strong>{gate.label}</strong>
                <span>{gate.reason}</span>
              </div>
              <span className="safety-state">{sg.status}</span>
            </li>
          ))}
        </ul>
      </div>
      <DemoCaption />
    </figure>
  )
}
