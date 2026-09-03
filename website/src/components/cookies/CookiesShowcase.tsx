import { Link } from 'react-router-dom'
import type { LegalBlock, LegalSection } from '../../content/legal/types.ts'
import { legalCookies, legalLocaleNote } from '../../content/legal/index.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { Button, ConversionPanel, SectionHeading } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

function parseKeyItem(item: string): { key: string; desc: string } {
  const separators = [': ', ' – ', ' - ']
  for (const sep of separators) {
    if (!item.includes(sep)) continue
    const [key, ...rest] = item.split(sep)
    return { key: key.trim(), desc: rest.join(sep).trim() }
  }
  return { key: item, desc: '' }
}

function SurfaceIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
        <path d="M3 7.5h14" stroke="currentColor" strokeWidth="1.35" />
      </svg>
    )
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.35" />
        <path d="M7.5 10h5M10 7.5v5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
      <path d="M3.5 9h13" stroke="currentColor" strokeWidth="1.35" />
      <rect x="5.5" y="12" width="4" height="1.2" rx="0.4" fill="currentColor" />
    </svg>
  )
}

function CookiesBlockView({ block, sectionId }: { block: LegalBlock; sectionId: string }) {
  if (block.type === 'p') {
    return <p>{block.text}</p>
  }

  if (sectionId === 'website-storage') {
    return (
      <div className="ck-storage-grid">
        {block.items.map((item) => {
          const { key, desc } = parseKeyItem(item)
          return (
            <div key={item} className="ck-storage-key">
              <code>{key}</code>
              {desc ? <p>{desc}</p> : null}
            </div>
          )
        })}
      </div>
    )
  }

  if (sectionId === 'control') {
    return (
      <ol className="ck-control-steps">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    )
  }

  return (
    <ul>
      {block.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function CookiesSection({ section }: { section: LegalSection }) {
  const t = useMessages()
  const showPrivacyLink = section.id === 'extension-storage'
  const showContactLink = section.id === 'contact'

  return (
    <Reveal>
      <section
        id={section.id}
        className="ck-section legal-section"
        aria-labelledby={`${section.id}-title`}
      >
        <h2 id={`${section.id}-title`}>{section.title}</h2>
        {section.blocks.map((block, index) => (
          <CookiesBlockView key={`${section.id}-${index}`} block={block} sectionId={section.id} />
        ))}
        {showPrivacyLink ? (
          <div className="ck-section-action">
            <Button to="/privacy" variant="secondary">
              {t.cookiesPage.privacyAction}
            </Button>
          </div>
        ) : null}
        {showContactLink ? (
          <div className="ck-section-action">
            <Button to="/contact" variant="secondary">
              {t.cookiesPage.contactAction}
            </Button>
          </div>
        ) : null}
      </section>
    </Reveal>
  )
}

export function CookiesShowcase() {
  const t = useMessages()
  const { locale } = useI18n()
  const doc = legalCookies(locale)
  const copy = t.cookiesPage
  const titleParts = splitTitle(t.legal.cookiesTitle, t.legal.cookiesTitleHighlight)
  const localeNote = legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)

  return (
    <div className="ck-page xp-cookies">
      <header className="ck-hero xp-hero" aria-labelledby="cookies-hero-title">
        <div className="container ck-hero-inner">
          <Reveal className="ck-hero-copy">
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {t.legal.kicker}
            </p>
            <h1 id="cookies-hero-title" className="ck-hero-title mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="ck-hero-lead mh-hero-lead">{t.legal.cookiesLead}</p>
            <div className="ck-hero-meta">
              <span className="ck-effective-pill">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                  <path
                    d="M5 1.5v2.5M11 1.5v2.5M2 6.5h12"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  <strong>{t.legal.effective}</strong>
                  <time dateTime={doc.effectiveIso}>{doc.effectiveLabel}</time>
                </span>
              </span>
            </div>
            <ul className="ck-trust-row" aria-label={copy.surfacesKicker}>
              {copy.trust.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </header>

      <nav className="ck-section-nav" aria-label={t.legal.onThisPage}>
        <div className="container">
          <ol>
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, '')}</a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <section className="ck-surfaces-band" aria-labelledby="ck-surfaces-title">
        <div className="container">
          <SectionHeading
            kicker={copy.surfacesKicker}
            title={copy.surfacesTitle}
            lead={copy.surfacesLead}
            titleId="ck-surfaces-title"
          />
          <div className="ck-surfaces-grid">
            {copy.surfaces.map((surface, index) => (
              <Reveal key={surface.id}>
                <a href={`#${surface.id}`} className={`ck-surface-card ck-surface-accent-${index}`}>
                  <div className="ck-surface-icon" aria-hidden="true">
                    <SurfaceIcon index={index} />
                  </div>
                  <span className="ck-surface-badge">{surface.badge}</span>
                  <h3>{surface.title}</h3>
                  <p>{surface.body}</p>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="ck-body">
        <div className="container ck-body-inner">
          {localeNote ? <p className="ck-locale-note">{localeNote}</p> : null}

          {doc.intro.length ? (
            <Reveal>
              <div className="ck-intro-card">
                {doc.intro.map((block, index) => (
                  <CookiesBlockView key={`intro-${index}`} block={block} sectionId="intro" />
                ))}
              </div>
            </Reveal>
          ) : null}

          <div className="ck-sections">
            {doc.sections.map((section) => (
              <CookiesSection key={section.id} section={section} />
            ))}
          </div>

          <Reveal>
            <div className="ck-related">
              <p className="ck-related-label">{doc.relatedLabel}</p>
              <div className="ck-related-links">
                <Link to="/privacy">{t.nav.privacy}</Link>
                <Link to="/terms">{t.nav.terms}</Link>
                <Link to="/contact">{t.nav.contact}</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <ConversionPanel
        titleId="cookies-final-cta"
        title={copy.finalTitle}
        lead={copy.finalLead}
        highlight={copy.finalHighlight}
        primary={<Button to="/contact">{t.legal.contact}</Button>}
        secondary={<Button to="/privacy" variant="secondary">{copy.privacyAction}</Button>}
      />
    </div>
  )
}
