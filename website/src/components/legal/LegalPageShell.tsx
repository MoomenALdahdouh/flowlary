import type { ReactNode } from 'react'

type LegalPageShellProps = {
  kicker: string
  title: string
  titleHighlight?: string
  lead: string
  effectiveIso: string
  effectiveLabel: string
  effectiveLabelText: string
  children: ReactNode
}

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

export function LegalPageShell({
  kicker,
  title,
  titleHighlight,
  lead,
  effectiveIso,
  effectiveLabel,
  effectiveLabelText,
  children,
}: LegalPageShellProps) {
  const titleParts = splitTitle(title, titleHighlight)

  return (
    <div className="lg-page xp-legal">
      <header className="lg-hero xp-hero">
        <div className="container lg-hero-inner">
          <p className="xp-hero-badge">
            <span className="xp-hero-badge-dot" aria-hidden="true" />
            {kicker}
          </p>
          <h1 className="lg-hero-title mh-display xp-hero-title">
            {titleParts.before}
            {titleParts.highlight ? (
              <span className="xp-gradient-text">{titleParts.highlight}</span>
            ) : null}
            {titleParts.after}
          </h1>
          <p className="lg-hero-lead mh-hero-lead">{lead}</p>
          <div className="lg-hero-meta">
            <span className="lg-effective-pill">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                <path d="M5 1.5v2.5M11 1.5v2.5M2 6.5h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
              <span>
                <strong>{effectiveLabelText}</strong>
                <time dateTime={effectiveIso}>{effectiveLabel}</time>
              </span>
            </span>
          </div>
        </div>
      </header>
      <section className="lg-body">{children}</section>
    </div>
  )
}
