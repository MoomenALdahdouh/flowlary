import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { FeedbackAdminItemView } from '@flowlary/shared'
import { FEEDBACK_STATUSES, FEEDBACK_TYPES } from '@flowlary/shared'
import { Button } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import { fetchAdminFeedbackItems, fetchAdminFeedbackSummary, patchAdminFeedbackItem } from '../../feedback/client.ts'
import { formatAdminDateTime } from '../../admin/format.ts'
import { StatusBadge, planTone, statusTone } from '../../admin/StatusBadge.tsx'
import { AdminHeader, AdminStatusLine } from '../../admin/ui.tsx'

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function FeedbackAdminPage() {
  const t = useMessages()
  const a = t.feedback.admin
  const panel = t.adminPanel
  const [params, setParams] = useSearchParams()
  const type = params.get('type') ?? ''
  const status = params.get('status') ?? ''
  const selectedId = params.get('id')
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState(false)
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<FeedbackAdminItemView[]>([])
  const [busy, setBusy] = useState(false)

  function patch(nextPatch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(nextPatch)) {
      if (!value) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const summaryRes = await fetchAdminFeedbackSummary()
    if (!summaryRes.ok) {
      setForbidden(summaryRes.error === 'auth' || summaryRes.error.includes('403'))
      setError(true)
      setLoading(false)
      return
    }
    setSummary(summaryRes.body.summary)
    const search = new URLSearchParams()
    if (type) search.set('type', type)
    if (status) search.set('status', status)
    search.set('limit', '100')
    const itemsRes = await fetchAdminFeedbackItems(`?${search.toString()}`)
    if (itemsRes.ok) setItems(itemsRes.body.items as FeedbackAdminItemView[])
    setLoading(false)
  }, [type, status])

  useEffect(() => {
    void load()
  }, [load])

  const selected = items.find((item) => item.id === selectedId) ?? null

  async function setStatus(id: string, nextStatus: string) {
    setBusy(true)
    const res = await patchAdminFeedbackItem(id, { status: nextStatus })
    setBusy(false)
    if (res.ok) void load()
  }

  if (forbidden) {
    return (
      <div className="ad-page wd-panel-stack">
        <AdminHeader title={a.title} lead={a.lead} />
        <p role="alert">{a.forbidden}</p>
      </div>
    )
  }

  return (
    <div className="ad-page wd-panel-stack">
      <AdminHeader
        title={a.title}
        lead={a.lead}
        actions={
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {a.refresh}
          </Button>
        }
      />
      <AdminStatusLine
        loading={loading && items.length === 0}
        error={error && !forbidden}
        loadingLabel={a.loading}
        errorLabel={panel.error}
        retryLabel={panel.retry}
        onRetry={() => void load()}
      />
      {summary ? (
        <dl className="wd-stats-grid ad-kpi-grid ad-kpi-compact">
          {(
            [
              [a.total, summary.total],
              [a.open, summary.open],
              [a.unresolved, summary.unresolved],
              [a.featureRequests, summary.featureRequests],
              [a.bugReports, summary.bugReports],
              [a.averageRating, summary.averageRating ?? '—'],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="wd-stat-card">
              <dt>{label}</dt>
              <dd>{String(value ?? '—')}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <form className="ad-filters ad-filters-compact" onSubmit={(event) => event.preventDefault()}>
        <label className="wd-field">
          <span>{t.feedback.typeLabel}</span>
          <select value={type} onChange={(event) => patch({ type: event.target.value || null, id: null })}>
            <option value="">{a.allTypes}</option>
            {FEEDBACK_TYPES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="wd-field">
          <span>{panel.users.status}</span>
          <select value={status} onChange={(event) => patch({ status: event.target.value || null, id: null })}>
            <option value="">{panel.users.all}</option>
            {FEEDBACK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </label>
      </form>
      <div className="ad-inbox">
        <aside className="wd-card ad-inbox-list" aria-label={a.title}>
          {items.length === 0 && !loading ? (
            <p className="ad-inbox-empty">{a.noItems}</p>
          ) : (
            <ul className="ad-inbox-items">
              {items.map((item) => {
                const title = (item.title ?? '').trim() || humanize(item.type)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`ad-inbox-item${selectedId === item.id ? ' is-active' : ''}`}
                      onClick={() => patch({ id: item.id })}
                    >
                      <span className="ad-inbox-item-title">{title}</span>
                      <span className="ad-inbox-item-meta">
                        <StatusBadge value={humanize(item.status)} tone={statusTone(item.status)} />
                        <StatusBadge value={item.plan} tone={planTone(item.plan)} />
                      </span>
                      <span className="ad-inbox-item-sub">{humanize(item.type)} · {formatAdminDateTime(item.createdAt)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
        <section className="ad-inbox-detail" aria-live="polite">
          {selected ? (
            <article className="wd-card ad-inbox-detail-card">
              <header className="ad-inbox-detail-head">
                <div>
                  <h2>{(selected.title ?? '').trim() || humanize(selected.type)}</h2>
                  <p className="ad-chip-row">
                    <StatusBadge value={humanize(selected.status)} tone={statusTone(selected.status)} />
                    <StatusBadge value={humanize(selected.type)} tone="info" />
                    <StatusBadge value={selected.plan} tone={planTone(selected.plan)} />
                  </p>
                </div>
                <div className="btn-row">
                  {selected.status === 'RESOLVED' || selected.status === 'CLOSED' ? (
                    <Button type="button" disabled={busy} onClick={() => void setStatus(selected.id, 'UNDER_REVIEW')}>
                      {a.reopen}
                    </Button>
                  ) : (
                    <Button type="button" disabled={busy} onClick={() => void setStatus(selected.id, 'RESOLVED')}>
                      {a.resolve}
                    </Button>
                  )}
                  <Button type="button" variant="secondary" to={`/admin/users/${encodeURIComponent(selected.accountId)}`}>
                    {panel.openAccount}
                  </Button>
                </div>
              </header>
              {selected.message ? <p className="ad-inbox-message">{selected.message}</p> : null}
              <dl className="ad-meta ad-meta-grid">
                <div>
                  <dt>{panel.users.email}</dt>
                  <dd>{selected.accountEmailMasked}</dd>
                </div>
                <div>
                  <dt>{panel.activity.when}</dt>
                  <dd>{formatAdminDateTime(selected.createdAt)}</dd>
                </div>
                {selected.rating != null ? (
                  <div>
                    <dt>{a.averageRating}</dt>
                    <dd>{selected.rating}</dd>
                  </div>
                ) : null}
              </dl>
              {selected.internalNotes.length > 0 ? (
                <div className="ad-inbox-notes">
                  <h3>{t.accountSupport.admin.internalNotes}</h3>
                  <ul>
                    {selected.internalNotes.map((note, index) => (
                      <li key={`${index}-${note.slice(0, 12)}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ) : (
            <article className="wd-card ad-inbox-placeholder">
              <p>{a.selectItem}</p>
            </article>
          )}
        </section>
      </div>
    </div>
  )
}
