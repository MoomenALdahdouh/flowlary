import { Link } from 'react-router-dom'
import { PageHero } from '../components/Ui.tsx'
import { LegalDocument } from '../components/legal/LegalDocument.tsx'
import { contactContent, legalLocaleNote } from '../content/legal/index.ts'
import { useI18n, useMessages } from '../i18n/index.tsx'

export function ContactPage() {
  const t = useMessages()
  const { locale } = useI18n()
  const content = contactContent(locale)

  return (
    <>
      <PageHero kicker={t.contact.kicker} title={content.title} lead={content.lead} />
      <section className="section contact-page">
        <div className="container container-narrow">
          <p className="muted contact-note">{content.note}</p>
          <div className="contact-grid">
            {content.channels.map((channel) => (
              <article key={channel.id} className="contact-card fl-surface-1">
                <h2>{channel.title}</h2>
                <p>{channel.body}</p>
                <Link className="text-link" to={channel.href}>
                  {channel.linkLabel}
                </Link>
              </article>
            ))}
          </div>
          <aside className="contact-safety fl-alert fl-alert-warning" aria-labelledby="contact-safety-title">
            <div className="fl-alert-body">
              <p className="fl-alert-title" id="contact-safety-title">
                {content.safetyTitle}
              </p>
              <ul>
                {content.safetyItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </aside>
          <p className="legal-related">
            {t.contact.related}{' '}
            <Link to="/support">{t.nav.support}</Link> · <Link to="/privacy">{t.nav.privacy}</Link> ·{' '}
            <Link to="/terms">{t.nav.terms}</Link>
          </p>
          {legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling) ? (
            <p className="muted legal-locale-note">
              {legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)}
            </p>
          ) : null}
        </div>
      </section>
    </>
  )
}
