import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SupportTicketAdminView, SupportTicketMessageView } from '@flowlary/shared'
import { Button } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import {
  fetchAdminSupportTicket,
  fetchAdminSupportTickets,
  patchAdminSupportTicket,
  postAdminSupportReply,
} from '../../feedback/client.ts'
import { formatAdminDateTime } from '../../admin/format.ts'
import { StatusBadge, planTone, statusTone } from '../../admin/StatusBadge.tsx'
import { AdminHeader, AdminStatusLine, DebouncedField } from '../../admin/ui.tsx'

export function SupportAdminPage() {
  const t = useMessages()
  const copy = t.accountSupport.admin
  const statusCopy = t.accountSupport.status
  const panel = t.adminPanel
  const [search, setSearch] = useSearchParams()
  const selectedId = search.get('id')
  const statusFilter = search.get('status') ?? ''
  const query = search.get('q') ?? ''
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState(false)
  const [tickets, setTickets] = useState<SupportTicketAdminView[]>([])
  const [detail, setDetail] = useState<SupportTicketAdminView | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessageView[]>([])
  const [reply, setReply] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [busy, setBusy] = useState(false)

  function patchSearch(nextPatch: Record<string, string | null>) {
    const next = new URLSearchParams(search)
    for (const [key, value] of Object.entries(nextPatch)) {
      if (!value) next.delete(key)
      else next.set(key, value)
    }
    setSearch(next, { replace: true })
  }

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (query.trim()) params.set('q', query.trim())
    const res = await fetchAdminSupportTickets(params.toString() ? `?${params}` : '')
    if (!res.ok) {
      setForbidden(true)
      setLoading(false)
      return
    }
    setTickets(res.body.tickets)
    setLoading(false)
  }, [statusFilter, query])

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetchAdminSupportTicket(id)
    if (!res.ok) {
      setError(true)
      return
    }
    setDetail(res.body.ticket)
    setMessages(res.body.messages)
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
    else {
      setDetail(null)
      setMessages([])
    }
  }, [selectedId, loadDetail])

  async function handleReply() {
    if (!selectedId || !reply.trim()) return
    setBusy(true)
    const res = await postAdminSupportReply(selectedId, { message: reply.trim(), status: 'WAITING_FOR_USER' })
    setBusy(false)
    if (res.ok) {
      setReply('')
      await loadDetail(selectedId)
      await loadList()
    }
  }

  async function handleStatus(next: string) {
    if (!selectedId) return
    setBusy(true)
    const res = await patchAdminSupportTicket(selectedId, {
      status: next,
      internalNote: internalNote.trim() || undefined,
    })
    setBusy(false)
    if (res.ok) {
      setInternalNote('')
      await loadDetail(selectedId)
      await loadList()
    }
  }

  if (forbidden) {
    return (
      <div className="ad-page wd-panel-stack">
        <AdminHeader title={copy.title} lead={copy.lead} />
        <p role="alert">{copy.forbidden}</p>
      </div>
    )
  }

  return (
    <div className="ad-page wd-panel-stack">
      <AdminHeader
        title={copy.title}
        lead={copy.lead}
        actions={
          <Button type="button" variant="secondary" to="/admin/feedback">
            {copy.feedbackInbox}
          </Button>
        }
      />
      <div className="ad-inbox">
        <aside className="wd-card ad-inbox-list" aria-label={copy.title}>
          <div className="ad-inbox-filters">
            <DebouncedField label={copy.search} value={query} onCommit={(next) => patchSearch({ q: next || null })} />
            <label className="wd-field">
              <span>{copy.filterStatus}</span>
              <select value={statusFilter} onChange={(event) => patchSearch({ status: event.target.value || null })}>
                <option value="">{copy.allStatuses}</option>
                {(['OPEN', 'INVESTIGATING', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'] as const).map((status) => (
                  <option key={status} value={status}>
                    {statusCopy[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <AdminStatusLine
            loading={loading && tickets.length === 0}
            error={error}
            loadingLabel={copy.loading}
            errorLabel={panel.error}
            retryLabel={panel.retry}
            onRetry={() => void loadList()}
          />
          {tickets.length === 0 && !loading ? (
            <p className="ad-inbox-empty">{copy.empty}</p>
          ) : (
            <ul className="ad-inbox-items">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    className={`ad-inbox-item${selectedId === ticket.id ? ' is-active' : ''}`}
                    onClick={() => patchSearch({ id: ticket.id })}
                  >
                    <span className="ad-inbox-item-title">
                      <span className="ad-inbox-item-id">#{ticket.displayNumber}</span> {ticket.subject}
                    </span>
                    <span className="ad-inbox-item-meta">
                      <StatusBadge value={statusCopy[ticket.status]} tone={statusTone(ticket.status)} />
                      <StatusBadge value={ticket.plan} tone={planTone(ticket.plan)} />
                    </span>
                    <span className="ad-inbox-item-sub">
                      {ticket.accountEmailMasked || ticket.accountEmail} · {formatAdminDateTime(ticket.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="ad-inbox-detail" aria-live="polite">
          {detail ? (
            <div className="ad-inbox-detail-stack">
              <header className="wd-card ad-inbox-detail-card">
                <div className="ad-inbox-detail-head">
                  <div>
                    <h2>
                      #{detail.displayNumber}: {detail.subject}
                    </h2>
                    <p className="ad-chip-row">
                      <StatusBadge value={statusCopy[detail.status]} tone={statusTone(detail.status)} />
                      <StatusBadge value={detail.plan} tone={planTone(detail.plan)} />
                    </p>
                    <p className="ad-inbox-detail-sub">
                      {detail.accountEmail} · {detail.messageCount}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" to={`/admin/users/${encodeURIComponent(detail.accountId)}`}>
                    {copy.openAccount}
                  </Button>
                </div>
              </header>
              <div className="wd-card ad-inbox-thread">
                {messages.length === 0 ? (
                  <p className="muted">{panel.empty}</p>
                ) : (
                  messages.map((item) => (
                    <article key={item.id} className={`ad-inbox-message-card ad-inbox-message-${item.author}`}>
                      <header>
                        <strong>{item.author === 'support' ? 'Support' : item.author === 'user' ? 'User' : item.author}</strong>
                        <time>{formatAdminDateTime(item.createdAt)}</time>
                      </header>
                      <p>{item.body}</p>
                    </article>
                  ))
                )}
              </div>
              {detail.internalNotes.length ? (
                <aside className="wd-card ad-inbox-notes">
                  <h3>{copy.internalNotes}</h3>
                  <ul>
                    {detail.internalNotes.map((note, index) => (
                      <li key={`${index}-${note.slice(0, 12)}`}>{note}</li>
                    ))}
                  </ul>
                </aside>
              ) : null}
              <div className="wd-card ad-inbox-composer">
                <label className="wd-field">
                  <span>{copy.replyLabel}</span>
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={4000} />
                </label>
                <label className="wd-field">
                  <span>{copy.internalNoteLabel}</span>
                  <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={2} maxLength={2000} />
                </label>
                <div className="btn-row">
                  <Button type="button" disabled={busy || !reply.trim()} onClick={() => void handleReply()}>
                    {copy.sendReply}
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleStatus('INVESTIGATING')}>
                    {copy.markInvestigating}
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleStatus('RESOLVED')}>
                    {copy.markResolved}
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleStatus('CLOSED')}>
                    {copy.markClosed}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <article className="wd-card ad-inbox-placeholder">
              <p>{copy.selectTicket}</p>
            </article>
          )}
        </section>
      </div>
    </div>
  )
}
