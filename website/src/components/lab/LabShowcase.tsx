import type { ReactNode } from 'react'
import {
  Button,
  ConversionPanel,
  FidelityBadge,
  InstallFlowlaryButton,
  SectionHeading,
} from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function LabShowcase({ workspace }: { workspace: ReactNode }) {
  const t = useMessages()
  const copy = t.labPage

  return (
    <div className="lab-page xp-lab">
      <header className="lab-hero xp-hero" aria-labelledby="lab-hero-title">
        <div className="container lab-hero-inner">
          <Reveal className="lab-hero-copy xp-hero-copy">
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {copy.kicker}
            </p>
            <h1 id="lab-hero-title" className="mh-display xp-hero-title">
              {copy.title.split(copy.titleHighlight)[0]}
              <span className="xp-gradient-text">{copy.titleHighlight}</span>
              {copy.title.split(copy.titleHighlight)[1]}
            </h1>
            <p className="lead mh-hero-lead">{copy.lead}</p>
            <div className="lab-hero-meta">
              <FidelityBadge mode="live" />
              <p className="lab-disclaimer">{copy.disclaimer}</p>
            </div>
          </Reveal>
        </div>
      </header>

      <section className="lab-section lab-workspace-band" aria-labelledby="lab-workspace-title">
        <div className="container">
          <Reveal>
            <SectionHeading
              kicker={copy.workspaceKicker}
              title={copy.workspaceTitle}
              lead={copy.workspaceLead}
              titleId="lab-workspace-title"
              badge={<FidelityBadge mode="live" />}
            />
          </Reveal>
          <Reveal>
            <div className="lab-workspace-shell">{workspace}</div>
          </Reveal>
        </div>
      </section>

      <ConversionPanel
        titleId="lab-final-title"
        title={copy.finalTitle}
        lead={copy.finalLead}
        primary={<InstallFlowlaryButton />}
        secondary={
          <Button variant="secondary" to="/account">
            {t.writingLab.viewProgress}
          </Button>
        }
      />
    </div>
  )
}
