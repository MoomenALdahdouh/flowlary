import { Link } from 'react-router-dom'
import type { LegalDocumentContent } from '../../content/legal/types.ts'
import { useMessages } from '../../i18n/index.tsx'
import { Button } from '../Ui.tsx'

type RelatedLink = { to: string; label: string }

type LegalDocumentProps = {
  doc: LegalDocumentContent
  related: RelatedLink[]
  localeNote?: string
}

export function LegalDocument({ doc, related, localeNote }: LegalDocumentProps) {
  const t = useMessages()

  return (
    <article className="prose lg-doc">
      <div className="container lg-layout">
        <aside className="lg-toc-aside">
          <nav className="lg-toc lg-toc-panel" aria-label={t.legal.tocAria}>
            <p className="lg-toc-title">{t.legal.onThisPage}</p>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, '')}</a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className="lg-content">
          {localeNote ? <p className="lg-locale-note">{localeNote}</p> : null}

          {doc.intro.length ? (
            <div className="lg-intro-card">
              {doc.intro.map((block, index) => (
                <LegalBlockView key={`intro-${index}`} block={block} />
              ))}
            </div>
          ) : null}

          <div className="lg-sections">
            {doc.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="lg-section legal-section"
                aria-labelledby={`${section.id}-title`}
              >
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                {section.blocks.map((block, index) => (
                  <LegalBlockView key={`${section.id}-${index}`} block={block} />
                ))}
              </section>
            ))}
          </div>

          <div className="lg-related">
            <p className="lg-related-label">{doc.relatedLabel}</p>
            <div className="lg-related-links">
              {related.map((link) => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="lg-contact-band">
            <div className="lg-contact-band-inner">
              <div>
                <h2>{t.legal.questionsTitle}</h2>
                <p>{t.legal.questionsLead}</p>
              </div>
              <Button to="/contact" variant="secondary">
                {t.legal.contact}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function LegalBlockView({ block }: { block: LegalDocumentContent['intro'][number] }) {
  if (block.type === 'p') return <p>{block.text}</p>
  return (
    <ul>
      {block.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
