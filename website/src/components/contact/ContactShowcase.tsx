import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SUPPORT_ISSUE_TYPES } from '@flowlary/shared'
import { hasStoredWebSession } from '../../account/client.ts'
import { contactContent, legalLocaleNote } from '../../content/legal/index.ts'
import type { ContactChannel } from '../../content/legal/types.ts'
import { createSupportTicket } from '../../feedback/client.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import PageHeader from '../../bolt/components/ui/PageHeader'
import CTASection from '../../bolt/components/ui/CTASection'

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
  const f = t.feedback
  const { locale } = useI18n()
  const content = contactContent(locale)
  const localeNote = legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)
  const signedIn = hasStoredWebSession()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [issueType, setIssueType] = useState('GENERAL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)

  const issueOptions = SUPPORT_ISSUE_TYPES.map((item) => ({
    id: item.id,
    label: t.accountSupport.issueTypes[item.id as keyof typeof t.accountSupport.issueTypes] ?? item.id,
  }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!signedIn || !subject.trim() || !message.trim()) return
    setLoading(true)
    setError(null)
    const res = await createSupportTicket({
      issueType,
      subject,
      message,
      source: 'website',
      surface: 'contact',
      locale,
    })
    setLoading(false)
    if (!res.ok) {
      setError(f.errors.generic)
      return
    }
    setTicketNumber(res.body.ticket.displayNumber)
    setSubject('')
    setMessage('')
  }

  return (
    <>
      <PageHeader
        label={c.kicker}
        title={content.title}
        subtitle={content.lead}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.contact }]}
        meta={
          <ul className="flex flex-wrap gap-2" aria-label={c.channelsKicker}>
            {c.heroTrust.map((item) => (
              <li
                key={item}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {item}
              </li>
            ))}
          </ul>
        }
      />

      <section className="py-16 lg:py-20">
        <div className="container-flow">
          <p className="mx-auto mb-10 max-w-3xl text-center text-sm text-slate-500 dark:text-slate-400">{content.note}</p>

          <h2 id="contact-channels-title" className="mb-6 text-center text-2xl font-bold text-slate-900 dark:text-white">
            {c.channelsTitle}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {content.channels.map((channel) => (
              <Link
                key={channel.id}
                to={channel.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-sky-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500/40"
                id={`contact-${channel.id}`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                  <ChannelIcon id={channel.id} />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{channel.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{channel.body}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-sky-600 group-hover:underline dark:text-sky-400">
                  {channel.linkLabel}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-5">
            <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-500/10 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">{c.safetyKicker}</p>
              <h2 id="contact-safety-title" className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {content.safetyTitle}
              </h2>
              <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-slate-700 dark:text-slate-300">
                {content.safetyItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </aside>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 lg:col-span-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{f.supportTitle}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{f.supportLead}</p>

              {!signedIn ? (
                <div className="mt-6">
                  <p className="text-sm text-slate-600 dark:text-slate-300">{c.signInBody}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to="/account" className="btn-primary text-sm">
                      {c.signInCta}
                    </Link>
                    <Link to="/support" className="btn-secondary text-sm">
                      {c.helpLink}
                    </Link>
                  </div>
                </div>
              ) : ticketNumber ? (
                <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-500/30 dark:bg-green-500/10">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    {f.ticketCreated.replace('{number}', ticketNumber)}
                  </p>
                  <Link to="/dashboard/support" className="mt-3 inline-block text-sm font-semibold text-sky-600 dark:text-sky-400">
                    {f.viewRequests}
                  </Link>
                </div>
              ) : (
                <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
                  {error ? (
                    <p className="text-sm text-rose-600" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.ticketIssueType}</span>
                    <select className="field-input" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                      {issueOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.ticketSubject}</span>
                    <input
                      className="field-input"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      maxLength={160}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.ticketMessage}</span>
                    <textarea
                      className="field-input min-h-[9rem] resize-y"
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={4000}
                      rows={6}
                    />
                  </label>
                  <button type="submit" className="btn-primary w-full" disabled={loading}>
                    {f.sendTicket}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm">
            <span className="text-slate-400">{c.related}</span>
            <Link to="/support" className="font-medium text-sky-600 dark:text-sky-400">
              {t.nav.support}
            </Link>
            <Link to="/privacy" className="font-medium text-sky-600 dark:text-sky-400">
              {t.nav.privacy}
            </Link>
            <Link to="/terms" className="font-medium text-sky-600 dark:text-sky-400">
              {t.nav.terms}
            </Link>
            <Link to="/feedback" className="font-medium text-sky-600 dark:text-sky-400">
              {t.nav.feedback}
            </Link>
          </div>
          {localeNote ? <p className="mt-6 text-center text-xs text-slate-400">{localeNote}</p> : null}
        </div>
      </section>

      <CTASection
        title={c.finalTitle}
        subtitle={c.finalLead}
        primaryTo="/support"
        primaryLabel={c.supportAction}
        secondaryTo="/feedback"
        secondaryLabel={c.feedbackAction}
      />
    </>
  )
}
