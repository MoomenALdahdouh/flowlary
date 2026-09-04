import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { SupportTicketMessageView, SupportTicketPublicView } from '@flowlary/shared'
import { SUPPORT_ISSUE_TYPES } from '@flowlary/shared'
import { BookOpen, LifeBuoy, Lightbulb, MessageSquarePlus, MessagesSquare } from 'lucide-react'
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

function ticketHref(id: string) {
  return `/dashboard/support?ticket=${encodeURIComponent(id)}`
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

  const helpLinks = [
    { to: '/support', title: s.helpCenter, hint: s.helpCenterHint, icon: BookOpen },
    { to: '/feedback?tab=features', title: s.suggestFeature, hint: s.suggestHint, icon: Lightbulb },
    { to: '/feedback', title: s.giveFeedback, hint: s.feedbackHint, icon: MessageSquarePlus },
  ]

  if (!signedIn) {
    return (
      <div className="wd-panel-stack">
        <article className="wd-card wd-empty">
          <h2>{s.signInTitle}</h2>
          <p className="wd-muted">{s.signInBody}</p>
          <div className="wd-actions">
            <Button to="/account">{s.signInCta}</Button>
          </div>
        </article>
      </div>
    )
  }

  if (selectedId && detail) {
    const canReply = ['OPEN', 'INVESTIGATING', 'WAITING_FOR_USER'].includes(detail.status)
    return (
      <div className="wd-panel-stack wd-support">
        <button type="button" className="wd-text-btn" onClick={() => setSearchParams({})}>
          {s.backToList}
        </button>
        <article className="wd-card">
          <p className="wd-data-label">{s.requestLabel.replace('{number}', detail.displayNumber)}</p>
          <h2>{detail.subject}</h2>
          <p className="wd-support-meta">
            <span className={`wd-support-status is-${detail.status.toLowerCase()}`}>{statusLabel(detail.status, s.status)}</span>
            <span className="wd-muted">{s.updated.replace('{time}', formatRelativeTime(detail.updatedAt, locale))}</span>
          </p>
        </article>
        {error ? (
          <p className="wd-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="wd-support-thread" role="log" aria-live="polite" aria-label={s.threadAria}>
          {messages.map((item) => (
            <article key={item.id} className={`wd-card wd-support-msg is-${item.author}`}>
              <header>
                <strong>{item.author === 'support' ? s.supportAuthor : s.youAuthor}</strong>
                <time dateTime={new Date(item.createdAt).toISOString()}>{formatRelativeTime(item.createdAt, locale)}</time>
              </header>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
        {canReply ? (
          <article className="wd-card">
            <label className="wd-field">
              <span>{s.replyLabel}</span>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={4000} />
            </label>
            <div className="wd-actions">
              <Button type="button" disabled={loading || !reply.trim()} onClick={() => void handleReply()}>
                {s.sendReply}
              </Button>
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleResolve()}>
                {s.markResolved}
              </Button>
            </div>
          </article>
        ) : (
          <p className="wd-muted">{s.closedNote}</p>
        )}
      </div>
    )
  }

  return (
    <div className="wd-panel-stack wd-support">
      <header className="wd-home-head">
        <div>
          <h2>{s.pageTitle}</h2>
          <p className="wd-lead">{s.pageLead}</p>
        </div>
        {tickets.length > 0 && !showNew ? (
          <Button type="button" onClick={() => setShowNew(true)}>
            {s.contactCta}
          </Button>
        ) : null}
      </header>

      {createdTicket ? (
        <p className="wd-settings-status is-ok" role="status">
          {s.createdSuccess.replace('{number}', createdTicket.displayNumber)}
        </p>
      ) : null}

      {error ? (
        <p className="wd-error" role="alert">
          {error}
        </p>
      ) : null}

      {showNew ? (
        <section className="wd-card" aria-labelledby="sp-new-title">
          <header className="wd-settings-card-head">
            <span className="wd-settings-icon" aria-hidden="true">
              <LifeBuoy className="h-4 w-4" />
            </span>
            <div>
              <h3 id="sp-new-title">{s.newTitle}</h3>
              <p className="wd-muted">{s.lead}</p>
            </div>
          </header>
          <label className="wd-field">
            <span>{s.issueTypeLabel}</span>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
              {issueOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="wd-field">
            <span>{s.subjectLabel}</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          </label>
          <label className="wd-field">
            <span>{s.messageLabel}</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} />
          </label>
          <label className="wd-check">
            <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
            <span>{s.diagnosticsLabel}</span>
          </label>
          {includeDiagnostics ? <p className="wd-muted">{s.diagnosticsNote}</p> : null}
          <div className="wd-actions">
            <Button type="button" disabled={loading || !subject.trim() || !message.trim()} onClick={() => void handleCreate()}>
              {s.sendTicket}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowNew(false)}>
              {s.cancel}
            </Button>
          </div>
        </section>
      ) : null}

      {loading && tickets.length === 0 && !showNew ? (
        <p className="wd-muted" role="status">
          {s.loading}
        </p>
      ) : tickets.length === 0 && !showNew ? (
        <article className="wd-card wd-support-empty">
          <span className="wd-settings-icon" aria-hidden="true">
            <MessagesSquare className="h-4 w-4" />
          </span>
          <h3>{s.emptyTitle}</h3>
          <p className="wd-muted">{s.emptyBody}</p>
          <p className="wd-muted">{s.lead}</p>
          <Button type="button" onClick={() => setShowNew(true)}>
            {s.contactCta}
          </Button>
        </article>
      ) : tickets.length > 0 ? (
        <ul className="wd-support-list">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link to={ticketHref(ticket.id)} className="wd-card wd-support-ticket">
                <div className="wd-support-ticket-head">
                  <strong>#{ticket.displayNumber}</strong>
                  <span className={`wd-support-status is-${ticket.status.toLowerCase()}`}>{statusLabel(ticket.status, s.status)}</span>
                </div>
                <p>{ticket.subject}</p>
                <p className="wd-muted">{s.updated.replace('{time}', formatRelativeTime(ticket.updatedAt, locale))}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="wd-support-help" aria-labelledby="wd-support-help-title">
        <h3 id="wd-support-help-title">{s.helpTitle}</h3>
        <div className="wd-support-help-grid">
          {helpLinks.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.to} to={item.to} className="wd-card wd-support-help-card">
                <span className="wd-settings-icon" aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <strong>{item.title}</strong>
                <span className="wd-muted">{item.hint}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
