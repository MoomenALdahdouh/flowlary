import { Link } from 'react-router-dom'
import { contactContent, legalLocaleNote } from '../../content/legal/index.ts'
import type { ContactChannel } from '../../content/legal/types.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { Button, ConversionPanel, SectionHeading } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'

const CHANNEL_ACCENTS = [
  'cyan',
  'purple',
  'magenta',
  'green',
  'cyan',
  'purple',
  'magenta',
  'green',
] as const

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

function ChannelIcon({ id }: { id: ContactChannel['id'] }) {
  switch (id) {
    case 'getting-started':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.35" />
          <path d="M10 6.5v7M6.5 10h7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      )
    case 'product':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 5.5h12M4 10h8M4 14.5h10" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      )
    case 'account':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.35" />
          <path d="M4.5 16.5c.8-2.8 2.8-4.5 5.5-4.5s4.7 1.7 5.5 4.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      )
    case 'billing':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3.5" y="5.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
          <path d="M3.5 9h13" stroke="currentColor" strokeWidth="1.35" />
        </svg>
      )
    case 'student':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 3 4.5 5.5v4.8c0 3.1 2.2 5.9 5.5 6.7 3.3-.8 5.5-3.6 5.5-6.7V5.5L10 3Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        </svg>
      )
    case 'privacy':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="5" y="9" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
          <path d="M7 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      )
    case 'legal':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M6 4.5h8v11H6V4.5Z" stroke="currentColor" strokeWidth="1.35" />
          <path d="M8 8h4M8 11h4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.35" />
          <path d="M10 9v4M10 6.5v.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      )
  }
}

export function ContactShowcase() {
  const t = useMessages()
  const c = t.contact
  const { locale } = useI18n()
  const content = contactContent(locale)
  const titleParts = splitTitle(content.title, c.titleHighlight)
  const localeNote = legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)

  return (
    <div className="ct-page xp-contact">
      <header className="ct-hero xp-hero" aria-labelledby="contact-hero-title">
        <div className="container ct-hero-inner">
          <Reveal>
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {c.kicker}
            </p>
            <h1 id="contact-hero-title" className="ct-hero-title mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="ct-hero-lead mh-hero-lead">{content.lead}</p>
            <ul className="ct-trust-row" aria-label={c.channelsKicker}>
              {c.heroTrust.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </header>

      <section className="ct-body">
        <div className="container ct-body-inner">
          <Reveal>
            <p className="ct-note">{content.note}</p>
          </Reveal>

          <Reveal>
            <SectionHeading
              kicker={c.channelsKicker}
              title={c.channelsTitle}
              titleId="contact-channels-title"
            />
          </Reveal>

          <div className="ct-channel-grid">
            {content.channels.map((channel, index) => (
              <Reveal key={channel.id}>
                <Link
                  to={channel.href}
                  className={`ct-channel-card ct-channel-accent-${CHANNEL_ACCENTS[index] ?? 'purple'}`}
                  id={`contact-${channel.id}`}
                >
                  <div className="ct-channel-icon" aria-hidden="true">
                    <ChannelIcon id={channel.id} />
                  </div>
                  <h2>{channel.title}</h2>
                  <p>{channel.body}</p>
                  <span className="ct-channel-action">{channel.linkLabel}</span>
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <aside className="ct-safety" aria-labelledby="contact-safety-title">
              <p className="ct-safety-kicker">{c.safetyKicker}</p>
              <h2 id="contact-safety-title">{content.safetyTitle}</h2>
              <ul>
                {content.safetyItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </aside>
          </Reveal>

          <Reveal>
            <div className="ct-related">
              <p className="ct-related-label">{c.related}</p>
              <div className="ct-related-links">
                <Link to="/support">{t.nav.support}</Link>
                <Link to="/privacy">{t.nav.privacy}</Link>
                <Link to="/terms">{t.nav.terms}</Link>
                <Link to="/feedback">{t.nav.feedback}</Link>
              </div>
            </div>
          </Reveal>

          {localeNote ? <p className="ct-locale-note">{localeNote}</p> : null}
        </div>
      </section>

      <ConversionPanel
        titleId="contact-final-cta"
        title={c.finalTitle}
        lead={c.finalLead}
        highlight={c.finalHighlight}
        primary={<Button to="/support">{c.supportAction}</Button>}
        secondary={<Button to="/feedback" variant="secondary">{c.feedbackAction}</Button>}
      />
    </div>
  )
}
