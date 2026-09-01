import { Link } from 'react-router-dom'
import type { LegalDocumentContent } from '../../content/legal/types.ts'
import { useMessages } from '../../i18n/index.tsx'

type RelatedLink = { to: string; label: string }

type LegalDocumentProps = {
  doc: LegalDocumentContent
  related: RelatedLink[]
  localeNote?: string
}

export function LegalDocument({ doc, related, localeNote }: LegalDocumentProps) {
  const t = useMessages()

  return (
    <article className="prose legal-doc">
      <div className="container legal-layout">
        <aside className="legal-toc-aside">
          <nav className="legal-toc" aria-label={t.legal.tocAria}>
            <p className="legal-toc-title">{t.legal.onThisPage}</p>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className="container-narrow legal-shell">
          {localeNote ? <p className="muted legal-locale-note">{localeNote}</p> : null}
          <p>
            <strong>{t.legal.effective}:</strong>{' '}
            <time dateTime={doc.effectiveIso}>{doc.effectiveLabel}</time>
          </p>

          {doc.intro.map((block, index) => (
            <LegalBlockView key={`intro-${index}`} block={block} />
          ))}

          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="legal-section" aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              {section.blocks.map((block, index) => (
                <LegalBlockView key={`${section.id}-${index}`} block={block} />
              ))}
            </section>
          ))}

          <p className="legal-related">
            {doc.relatedLabel}{' '}
            {related.map((link, index) => (
              <span key={link.to}>
                {index > 0 ? ' · ' : null}
                <Link to={link.to}>{link.label}</Link>
              </span>
            ))}
          </p>
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
