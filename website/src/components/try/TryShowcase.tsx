import { lazy, Suspense } from 'react'
import {
  Button,
  ConversionPanel,
  FidelityBadge,
  InstallFlowlaryButton,
  SectionHeading,
} from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

const PlaygroundSection = lazy(() =>
  import('../playground/PlaygroundSection.tsx').then((module) => ({
    default: module.PlaygroundSection,
  })),
)

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

export function TryShowcase() {
  const t = useMessages()
  const copy = t.tryPage
  const titleParts = splitTitle(copy.title, copy.titleHighlight)

  return (
    <div className="tr-page xp-try">
      <header className="tr-hero xp-hero" aria-labelledby="try-hero-title">
        <div className="container tr-hero-inner">
          <Reveal>
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {copy.kicker}
            </p>
            <h1 id="try-hero-title" className="tr-hero-title mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="tr-hero-lead mh-hero-lead">{copy.lead}</p>
            <div className="tr-hero-meta">
              <FidelityBadge mode="simulated" />
              <p className="tr-notice-inline">{copy.noticeBody}</p>
            </div>
          </Reveal>
        </div>
      </header>

      <section className="tr-workspace-band" aria-labelledby="try-workspace-title">
        <div className="container">
          <Reveal>
            <SectionHeading
              kicker={copy.kicker}
              title={copy.workspaceTitle}
              lead={copy.workspaceLead}
              titleId="try-workspace-title"
            />
          </Reveal>
          <div className="tr-workspace-shell">
            <Suspense
              fallback={
                <section id="try-flowlary" aria-busy="true" className="tr-workspace-loading" />
              }
            >
              <PlaygroundSection showIntro={false} embedded />
            </Suspense>
          </div>
        </div>
      </section>

      <ConversionPanel
        titleId="try-final-cta"
        title={copy.finalTitle}
        lead={copy.finalLead}
        highlight={copy.finalHighlight}
        primary={<InstallFlowlaryButton />}
        secondary={
          <Button variant="secondary" to="/lab">
            {t.cta.tryLive}
          </Button>
        }
      />
    </div>
  )
}
