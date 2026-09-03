import { useEffect, useState } from 'react'
import { SHORTCUTS } from '../../config.ts'
import {
  Button,
  ConversionPanel,
  InstallFlowlaryButton,
  SectionHeading,
} from '../Ui.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { SpeedBoxDemo } from '../demos/ProductDemos.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

type SurfaceId = 'control' | 'actions' | 'repair' | 'learn'

const SURFACE_ACCENTS = ['cyan', 'purple', 'magenta', 'green'] as const

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

function splitKeys(combo: string): string[] {
  return combo.split(/(?=[⌘⇧⌥⌃])|\+/).filter(Boolean)
}

function KeyCombo({ mac, other }: { mac: string; other: string }) {
  return (
    <span className="sp-keys" aria-label={`${other} / ${mac}`}>
      {splitKeys(other).map((key) => (
        <kbd key={`o-${key}`}>{key}</kbd>
      ))}
      <span className="visually-hidden"> or </span>
      {splitKeys(mac).map((key) => (
        <kbd key={`m-${key}`}>{key}</kbd>
      ))}
    </span>
  )
}

function useProductScrollSpy(surfaceIds: readonly string[]) {
  const [activeId, setActiveId] = useState(surfaceIds[0] ?? 'control')

  useEffect(() => {
    const elements = surfaceIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement)

    if (!elements.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]?.target
        if (top instanceof HTMLElement) setActiveId(top.id)
      },
      { rootMargin: '-18% 0px -58% 0px', threshold: [0, 0.2, 0.45, 0.75] },
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [surfaceIds])

  return activeId
}

function SurfaceVisual({ id }: { id: SurfaceId }) {
  const t = useMessages()
  const guide = t.guide

  if (id === 'control') {
    return (
      <div className="pd-visual-surface">
        <PopupPreview compact animate={false} />
      </div>
    )
  }

  if (id === 'actions') {
    return (
      <div className="pd-visual-surface pd-visual-shortcuts">
        <div className="pd-shortcut-row">
          <span>{t.support.shortcutTranslate}</span>
          <KeyCombo {...SHORTCUTS.translate} />
        </div>
        <div className="pd-shortcut-row">
          <span>{t.support.shortcutLayout}</span>
          <KeyCombo {...SHORTCUTS.fixLayout} />
        </div>
        <div className="pd-shortcut-row">
          <span>{t.support.shortcutSpeed}</span>
          <KeyCombo {...SHORTCUTS.speedBox} />
        </div>
      </div>
    )
  }

  if (id === 'repair') {
    return (
      <div className="pd-visual-surface pd-visual-speedbox">
        <SpeedBoxDemo />
      </div>
    )
  }

  return (
    <div className="pd-visual-surface pd-visual-dashboard">
      <div className="pd-dashboard-nav">
        {guide.dashboardTabs.map((tab, index) => (
          <span key={tab} className={index === 0 ? 'is-active' : undefined}>
            {tab}
          </span>
        ))}
      </div>
      <p>{guide.steps[6]?.body}</p>
    </div>
  )
}

export function ProductShowcase() {
  const t = useMessages()
  const copy = t.productPage
  const titleParts = splitTitle(copy.title, copy.titleHighlight)
  const surfaceIds = copy.surfaces.map((surface) => surface.id)
  const activeSurfaceId = useProductScrollSpy(surfaceIds)

  return (
    <div className="pd-page xp-product">
      <header className="pd-hero xp-hero" aria-labelledby="product-hero-title">
        <div className="container pd-hero-inner">
          <Reveal>
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {copy.kicker}
            </p>
            <h1 id="product-hero-title" className="pd-hero-title mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="pd-hero-lead mh-hero-lead">{copy.lead}</p>
            <ul className="pd-trust-row" aria-label={copy.surfacesKicker}>
              {copy.heroTrust.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </header>

      <nav className="pd-surface-nav" aria-label={copy.surfacesKicker}>
        <div className="container">
          {copy.surfaces.map((surface, index) => (
            <a
              key={surface.id}
              href={`#${surface.id}`}
              className={activeSurfaceId === surface.id ? 'is-active' : undefined}
              aria-current={activeSurfaceId === surface.id ? 'location' : undefined}
            >
              <span>{index + 1}</span>
              {surface.kicker}
            </a>
          ))}
        </div>
      </nav>

      <section className="pd-surfaces-band">
        <div className="container">
          <ol className="pd-timeline">
            {copy.surfaces.map((surface, index) => {
              const bullets = 'bullets' in surface ? surface.bullets : undefined
              const note = 'note' in surface ? surface.note : undefined
              const accent = SURFACE_ACCENTS[index] ?? 'purple'

              return (
                <li
                  key={surface.id}
                  id={surface.id}
                  className={`pd-timeline-item pd-accent-${accent}${index % 2 === 1 ? ' is-flip' : ''}${activeSurfaceId === surface.id ? ' is-active' : ''}`}
                >
                  <Reveal className="pd-surface-copy">
                    <span className="pd-surface-num">{String(index + 1).padStart(2, '0')}</span>
                    <p className="pd-surface-kicker">{surface.kicker}</p>
                    <h2 id={`product-${surface.id}-title`}>{surface.title}</h2>
                    <p className="pd-surface-lead">{surface.lead}</p>
                    {bullets ? (
                      <ul className="pd-surface-bullets">
                        {bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                    {note ? <p className="pd-surface-note">{note}</p> : null}
                    {surface.link ? (
                      <Button variant="link" to={surface.link}>
                        {surface.linkLabel}
                      </Button>
                    ) : null}
                  </Reveal>
                  <Reveal className="pd-surface-visual">
                    <SurfaceVisual id={surface.id as SurfaceId} />
                  </Reveal>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <ConversionPanel
        titleId="product-final-title"
        title={copy.final.title}
        lead={copy.final.lead}
        highlight={copy.finalHighlight}
        primary={<InstallFlowlaryButton />}
        secondary={
          <Button variant="secondary" to="/try">
            {t.cta.try}
          </Button>
        }
      />
    </div>
  )
}
