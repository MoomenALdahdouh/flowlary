import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { SupportTicketMessageView, SupportTicketPublicView } from '@flowlary/shared'
import { SUPPORT_ISSUE_TYPES } from '@flowlary/shared'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { hasStoredWebSession } from '../../account/client.ts'
import { Button } from '../Ui.tsx'
import {
  createSupportTicket,
  fetchSupportTicket,
  fetchSupportTickets,
  postSupportTicketMessage,
  resolveSupportTicket,
} from '../../feedback/client.ts'

function formatRelativeTime(ts: number, locale: string): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day')
}

function statusLabel(status: SupportTicketPublicView['status'], copy: Record<string, string>): string {
  return copy[status] ?? status
}

export function SupportTicketsPanel() {
  const t = useMessages()
  const s = t.accountSupport
  const { locale } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const signedIn = hasStoredWebSession()
  const selectedId = searchParams.get('ticket')

  const [tickets, setTickets] = useState<SupportTicketPublicView[]>([])
  const [detail, setDetail] = useState<SupportTicketPublicView | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessageView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [issueType, setIssueType] = useState<string>('GENERAL')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)
  const [createdTicket, setCreatedTicket] = useState<SupportTicketPublicView | null>(null)

  const issueOptions = useMemo(
    () =>
      SUPPORT_ISSUE_TYPES.map((item) => ({
        id: item.id,
        label: s.issueTypes[item.id as keyof typeof s.issueTypes] ?? item.id,
      })),
    [s.issueTypes],
  )

  const loadTickets = useCallback(async () => {
    setLoading(true)
    const res = await fetchSupportTickets()
    setLoading(false)
    if (!res.ok) {
      setError(s.errors.generic)
      return
    }
    setTickets(res.body.tickets)
  }, [s.errors.generic])

  const loadDetail = useCallback(
    async (id: string) => {
      setLoading(true)
      const res = await fetchSupportTicket(id)
      setLoading(false)
      if (!res.ok) {
        setError(s.errors.notFound)
        return
      }
      setDetail(res.body.ticket)
      setMessages(res.body.messages)
      setError(null)
    },
    [s.errors.notFound],
  )

  useEffect(() => {
    if (!signedIn) return
    if (selectedId) void loadDetail(selectedId)
    else {
      setDetail(null)
      setMessages([])
      void loadTickets()
    }
  }, [signedIn, selectedId, loadDetail, loadTickets])

  async function handleCreate() {
    if (!subject.trim() || !message.trim()) return
    setLoading(true)
    setError(null)
    const res = await createSupportTicket({
      issueType,
      subject,
      message,
      source: 'website',
      surface: 'account',
      locale,
      metadata: includeDiagnostics
        ? { includeDiagnostics: true, userAgent: navigator.userAgent.slice(0, 300) }
        : undefined,
    })
    setLoading(false)
    if (!res.ok) {
      setError(s.errors.generic)
      return
    }
    setCreatedTicket(res.body.ticket)
    setShowNew(false)
    setSubject('')
    setMessage('')
    await loadTickets()
    setSearchParams({ ticket: res.body.ticket.id })
  }

  async function handleReply() {
    if (!detail || !reply.trim()) return
    setLoading(true)
    const res = await postSupportTicketMessage(detail.id, reply.trim())
    setLoading(false)
    if (!res.ok) {
      setError(s.errors.generic)
      return
    }
    setReply('')
    await loadDetail(detail.id)
  }

  async function handleResolve() {
    if (!detail) return
    setLoading(true)
    const res = await resolveSupportTicket(detail.id)
    setLoading(false)
    if (!res.ok) {
      setError(s.errors.generic)
      return
    }
    await loadDetail(detail.id)
  }

  if (!signedIn) {
    return (
      <div className="fl-surface-1 sp-tickets-panel">
        <h2>{s.signInTitle}</h2>
        <p className="muted">{s.signInBody}</p>
        <Button to="/account">{s.signInCta}</Button>
      </div>
    )
  }

  if (selectedId && detail) {
    const canReply = ['OPEN', 'INVESTIGATING', 'WAITING_FOR_USER'].includes(detail.status)
    return (
      <div className="sp-tickets-panel">
        <button type="button" className="sp-back-link" onClick={() => setSearchParams({})}>
          {s.backToList}
        </button>
        <header className="sp-ticket-header fl-surface-1">
          <p className="kicker">{s.requestLabel.replace('{number}', detail.displayNumber)}</p>
          <h2>{detail.subject}</h2>
          <p>
            <span className={`sp-status sp-status-${detail.status.toLowerCase()}`}>{statusLabel(detail.status, s.status)}</span>
            <span className="muted"> · {s.updated.replace('{time}', formatRelativeTime(detail.updatedAt, locale))}</span>
          </p>
        </header>
        {error ? (
          <p className="fl-alert fl-alert-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="sp-thread" role="log" aria-live="polite" aria-label={s.threadAria}>
          {messages.map((item) => (
            <article key={item.id} className={`sp-message sp-message-${item.author} fl-surface-1`}>
              <header>
                <strong>{item.author === 'support' ? s.supportAuthor : s.youAuthor}</strong>
                <time dateTime={new Date(item.createdAt).toISOString()}>{formatRelativeTime(item.createdAt, locale)}</time>
              </header>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
        {canReply ? (
          <div className="sp-reply fl-surface-1">
            <label className="fb-field">
              <span>{s.replyLabel}</span>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={4000} />
            </label>
            <div className="btn-row">
              <Button type="button" disabled={loading || !reply.trim()} onClick={() => void handleReply()}>
                {s.sendReply}
              </Button>
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleResolve()}>
                {s.markResolved}
              </Button>
            </div>
          </div>
        ) : (
          <p className="muted">{s.closedNote}</p>
        )}
      </div>
    )
  }

  return (
    <div className="sp-tickets-panel">
      <div className="sp-tickets-head">
        <div>
          <h2>{s.title}</h2>
          <p className="muted">{s.lead}</p>
        </div>
        <Button type="button" onClick={() => setShowNew((v) => !v)}>
          {s.contactCta}
        </Button>
      </div>

      {createdTicket ? (
        <p className="fl-alert fl-alert-success" role="status">
          {s.createdSuccess.replace('{number}', createdTicket.displayNumber)}
        </p>
      ) : null}

      {error ? (
        <p className="fl-alert fl-alert-error" role="alert">
          {error}
        </p>
      ) : null}

      {showNew ? (
        <section className="fl-surface-1 sp-new-ticket" aria-labelledby="sp-new-title">
          <h3 id="sp-new-title">{s.newTitle}</h3>
          <label className="fb-field">
            <span>{s.issueTypeLabel}</span>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
              {issueOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fb-field">
            <span>{s.subjectLabel}</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          </label>
          <label className="fb-field">
            <span>{s.messageLabel}</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} />
          </label>
          <label className="fb-check">
            <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
            <span>{s.diagnosticsLabel}</span>
          </label>
          {includeDiagnostics ? <p className="muted fb-diagnostics-note">{s.diagnosticsNote}</p> : null}
          <div className="btn-row">
            <Button type="button" disabled={loading || !subject.trim() || !message.trim()} onClick={() => void handleCreate()}>
              {s.sendTicket}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowNew(false)}>
              {s.cancel}
            </Button>
          </div>
        </section>
      ) : null}

      {loading && tickets.length === 0 ? (
        <p role="status">{s.loading}</p>
      ) : tickets.length === 0 ? (
        <div className="fl-surface-1 sp-empty">
          <p>{s.empty}</p>
          <Button type="button" onClick={() => setShowNew(true)}>
            {s.contactCta}
          </Button>
        </div>
      ) : (
        <ul className="sp-ticket-list">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link to={`/account/support?ticket=${encodeURIComponent(ticket.id)}`} className="sp-ticket-card fl-surface-1">
                <div className="sp-ticket-card-head">
                  <strong>#{ticket.displayNumber}</strong>
                  <span className={`sp-status sp-status-${ticket.status.toLowerCase()}`}>{statusLabel(ticket.status, s.status)}</span>
                </div>
                <p>{ticket.subject}</p>
                <p className="muted">{s.updated.replace('{time}', formatRelativeTime(ticket.updatedAt, locale))}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="muted sp-help-links">
        <Link to="/support">{s.helpCenter}</Link>
        {' · '}
        <Link to="/feedback?tab=features">{s.suggestFeature}</Link>
        {' · '}
        <Link to="/feedback">{s.giveFeedback}</Link>
      </p>
    </div>
  )
}
