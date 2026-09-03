import type { ReactNode } from 'react'
import { Reveal } from '../Reveal.tsx'

type AccountAuthLayoutProps = {
  kicker: string
  title: string
  titleHighlight?: string
  lead?: string
  note?: ReactNode
  benefits?: readonly string[]
  trustLine?: string
  footer?: ReactNode
  children: ReactNode
}

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

function BenefitIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 14.5 11.5 7 14 9.5 6.5 17H4v-2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    )
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="7" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.35" />
        <circle cx="13" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.35" />
        <path d="M3.5 15.5c.6-2.2 2.2-3.5 4.5-3.5s3.9 1.3 4.5 3.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
      <path d="M7.5 14.5 10 12l2.5 2.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AccountAuthLayout({
  kicker,
  title,
  titleHighlight,
  lead,
  note,
  benefits,
  trustLine,
  footer,
  children,
}: AccountAuthLayoutProps) {
  const titleParts = splitTitle(title, titleHighlight)
  const trustChips = trustLine
    ? trustLine
        .split('·')
        .map((item) => item.trim())
        .filter(Boolean)
    : []

  return (
    <div className="ac-page xp-account ac-page-signed-out">
      <section className="ac-section ac-hero">
        <div className="container ac-layout-grid">
          <Reveal className="ac-layout-copy">
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {kicker}
            </p>
            <h1 className="ac-layout-title mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            {lead ? <p className="ac-lead ac-layout-lead">{lead}</p> : null}
            {trustChips.length ? (
              <ul className="ac-trust-chips" aria-label={trustLine}>
                {trustChips.map((chip) => (
                  <li key={chip}>{chip}</li>
                ))}
              </ul>
            ) : null}
            {benefits?.length ? (
              <ul className="ac-benefit-cards">
                {benefits.map((item, index) => (
                  <li key={item} className="ac-benefit-card">
                    <span className="ac-benefit-icon" aria-hidden="true">
                      <BenefitIcon index={index} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {note ? <div className="ac-student-register-note">{note}</div> : null}
          </Reveal>
          <div className="ac-layout-panel">
            <Reveal>{children}</Reveal>
            {footer ? <div className="ac-layout-footer">{footer}</div> : null}
          </div>
        </div>
      </section>
    </div>
  )
}
