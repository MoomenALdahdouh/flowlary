import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { LegalDocumentContent } from '../../content/legal/types.ts'
import { useActiveSection } from '../../hooks/useActiveSection.ts'
import { useMessages } from '../../i18n/index.tsx'

type RelatedLink = { to: string; label: string }

type LegalDocumentProps = {
  doc: LegalDocumentContent
  related: RelatedLink[]
  localeNote?: string
}

export function LegalDocument({ doc, related, localeNote }: LegalDocumentProps) {
  const t = useMessages()
  const sectionIds = useMemo(() => doc.sections.map((section) => section.id), [doc.sections])
  const { activeId, activate } = useActiveSection(sectionIds)
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  return (
    <article className="container-flow">
      <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <nav
            className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            aria-label={t.legal.tocAria}
          >
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t.legal.onThisPage}</p>
            <ol className="space-y-0.5">
              {doc.sections.map((section) => {
                const active = section.id === activeId
                return (
                  <li key={section.id}>
                    <a
                      ref={active ? activeLinkRef : undefined}
                      href={`#${section.id}`}
                      aria-current={active ? 'location' : undefined}
                      onClick={() => activate(section.id)}
                      className={`block rounded-lg border-s-2 px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? 'border-sky-500 bg-sky-50 font-semibold text-sky-700 dark:border-sky-400 dark:bg-sky-500/15 dark:text-sky-300'
                          : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-sky-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400'
                      }`}
                    >
                      {section.title.replace(/^\d+\.\s*/, '')}
                    </a>
                  </li>
                )
              })}
            </ol>
          </nav>
        </aside>

        <div className="prose-flow max-w-3xl">
          {localeNote ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              {localeNote}
            </p>
          ) : null}

          {doc.intro.length ? (
            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              {doc.intro.map((block, index) => (
                <LegalBlockView key={`intro-${index}`} block={block} />
              ))}
            </div>
          ) : null}

          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="legal-section scroll-mt-24" aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              {section.blocks.map((block, index) => (
                <LegalBlockView key={`${section.id}-${index}`} block={block} />
              ))}
            </section>
          ))}

          <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{doc.relatedLabel}</p>
            <div className="flex flex-wrap gap-3">
              {related.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/40 dark:hover:text-sky-400"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900">
            <div>
              <h2 className="mt-0">{t.legal.questionsTitle}</h2>
              <p className="mb-0">{t.legal.questionsLead}</p>
            </div>
            <Link to="/contact" className="btn-secondary shrink-0">
              {t.legal.contact}
            </Link>
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
