import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SupportTicketAdminView, SupportTicketMessageView } from '@flowlary/shared'
import { PageHero, Button } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import {
  fetchAdminSupportTicket,
  fetchAdminSupportTickets,
  patchAdminSupportTicket,
  postAdminSupportReply,
} from '../../feedback/client.ts'

export function SupportAdminPage() {
  const t = useMessages()
  const copy = t.accountSupport.admin
  const statusCopy = t.accountSupport.status
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [tickets, setTickets] = useState<SupportTicketAdminView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportTicketAdminView | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessageView[]>([])
  const [reply, setReply] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''
    const res = await fetchAdminSupportTickets(query)
    if (!res.ok) {
      setForbidden(true)
      setLoading(false)
      return
    }
    setTickets(res.body.tickets)
    setLoading(false)
  }, [statusFilter])

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true)
    const res = await fetchAdminSupportTicket(id)
    setLoading(false)
    if (!res.ok) return
    setDetail(res.body.ticket)
    setMessages(res.body.messages)
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  async function handleReply() {
    if (!selectedId || !reply.trim()) return
    setLoading(true)
    const res = await postAdminSupportReply(selectedId, { message: reply.trim(), status: 'WAITING_FOR_USER' })
    setLoading(false)
    if (res.ok) {
      setReply('')
      await loadDetail(selectedId)
      await loadList()
    }
  }

  async function handleStatus(next: string) {
    if (!selectedId) return
    setLoading(true)
    const res = await patchAdminSupportTicket(selectedId, {
      status: next,
      internalNote: internalNote.trim() || undefined,
    })
    setLoading(false)
    if (res.ok) {
      setInternalNote('')
      await loadDetail(selectedId)
      await loadList()
    }
  }

  if (forbidden) {
    return (
      <>
        <PageHero kicker={copy.kicker} title={copy.title} lead={copy.lead} />
        <section className="section">
          <div className="container container-narrow">
            <p role="alert">{copy.forbidden}</p>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHero kicker={copy.kicker} title={copy.title} lead={copy.lead} />
      <section className="section">
        <div className="container">
          <div className="sp-admin-grid">
            <aside className="fl-surface-1 sp-admin-list">
              <label className="fb-field">
                <span>{copy.filterStatus}</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">{copy.allStatuses}</option>
                  {(['OPEN', 'INVESTIGATING', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'] as const).map((status) => (
                    <option key={status} value={status}>
                      {statusCopy[status]}
                    </option>
                  ))}
                </select>
              </label>
              {loading && tickets.length === 0 ? <p role="status">{copy.loading}</p> : null}
              <ul>
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      className={`sp-admin-item${selectedId === ticket.id ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(ticket.id)}
                    >
                      <strong>#{ticket.displayNumber}</strong> {ticket.subject}
                      <span className="muted">{ticket.plan} · {statusCopy[ticket.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            <div className="sp-admin-detail">
              {detail ? (
                <>
                  <header className="fl-surface-1">
                    <h2>#{detail.displayNumber} — {detail.subject}</h2>
                    <p className="muted">
                      {detail.accountEmailMasked} · {detail.plan} · {statusCopy[detail.status]}
                    </p>
                  </header>
                  <div className="sp-thread">
                    {messages.map((item) => (
                      <article key={item.id} className={`sp-message sp-message-${item.author} fl-surface-1`}>
                        <strong>{item.author}</strong>
                        <p>{item.body}</p>
                      </article>
                    ))}
                  </div>
                  {detail.internalNotes.length ? (
                    <aside className="fl-surface-1 sp-internal-notes">
                      <h3>{copy.internalNotes}</h3>
                      <ul>
                        {detail.internalNotes.map((note, index) => (
                          <li key={`${index}-${note.slice(0, 12)}`}>{note}</li>
                        ))}
                      </ul>
                    </aside>
                  ) : null}
                  <div className="fl-surface-1 sp-admin-actions">
                    <label className="fb-field">
                      <span>{copy.replyLabel}</span>
                      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={4000} />
                    </label>
                    <label className="fb-field">
                      <span>{copy.internalNoteLabel}</span>
                      <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} maxLength={2000} />
                    </label>
                    <div className="btn-row">
                      <Button type="button" disabled={loading || !reply.trim()} onClick={() => void handleReply()}>
                        {copy.sendReply}
                      </Button>
                      <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleStatus('INVESTIGATING')}>
                        {copy.markInvestigating}
                      </Button>
                      <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleStatus('RESOLVED')}>
                        {copy.markResolved}
                      </Button>
                      <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleStatus('CLOSED')}>
                        {copy.markClosed}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="muted">{copy.selectTicket}</p>
              )}
            </div>
          </div>
          <p className="muted" style={{ marginTop: '1rem' }}>
            <Link to="/admin/feedback">{copy.feedbackInbox}</Link>
          </p>
        </div>
      </section>
    </>
  )
}
