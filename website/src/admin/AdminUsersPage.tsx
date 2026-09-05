import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { AdminUserDetailView, AdminUserListItem, AdminUserListView } from '@flowlary/shared'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import { asAdminList, fetchAdminUser, fetchAdminUsers, postAdminUserAction } from './client.ts'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import { fillCopy, formatAdminDate, formatAdminDateTime } from './format.ts'
import { StatusBadge, planTone, statusTone } from './StatusBadge.tsx'
import { AdminHeader, AdminPager, AdminStatusLine, DebouncedField } from './ui.tsx'

export function AdminUsersPage() {
  const t = useMessages().adminPanel
  const { id: routeId } = useParams()
  const [params, setParams] = useSearchParams()
  const selectedId = routeId ?? params.get('id')
  const q = params.get('q') ?? ''
  const plan = params.get('plan') ?? 'all'
  const status = params.get('status') ?? 'all'
  const page = params.get('page') ?? '1'
  const [list, setList] = useState<AdminUserListView | null>(null)
  const [detail, setDetail] = useState<AdminUserDetailView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [confirm, setConfirm] = useState<'suspend' | 'restore' | 'revoke' | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(false)
  const [tick, setTick] = useState(0)

  const query = useMemo(() => {
    const search = new URLSearchParams()
    if (q.trim()) search.set('q', q.trim())
    if (plan && plan !== 'all') search.set('plan', plan)
    if (status && status !== 'all') search.set('status', status)
    search.set('page', page)
    search.set('pageSize', '25')
    return `?${search.toString()}`
  }, [q, plan, status, page])

  function patchParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key)
      else next.set(key, value)
    }
    if (patch.q !== undefined || patch.plan !== undefined || patch.status !== undefined) next.set('page', '1')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    void (selectedId ? fetchAdminUser(selectedId) : fetchAdminUsers(query)).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setError(true)
        if (!selectedId) setList(null)
        else setDetail(null)
        setLoading(false)
        return
      }
      if (selectedId) {
        const user = 'user' in res.body ? res.body.user : undefined
        if (!user) {
          setError(true)
          setDetail(null)
        } else {
          setDetail(user)
        }
      } else {
        setList(asAdminList((res.body ?? {}) as AdminUserListView))
        setDetail(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [query, selectedId, tick])

  async function runAction(action: 'suspend' | 'restore' | 'revoke-sessions') {
    if (!selectedId) return
    setBusy(true)
    setActionError(false)
    const res = await postAdminUserAction(selectedId, action, true)
    setBusy(false)
    setConfirm(null)
    if (res.ok && res.body.user) setDetail(res.body.user)
    else if (res.ok) {
      const refreshed = await fetchAdminUser(selectedId)
      if (refreshed.ok) setDetail(refreshed.body.user)
    } else {
      setActionError(true)
    }
  }

  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1
  const items: AdminUserListItem[] = list?.items ?? []

  return (
    <div className="wd-panel-stack ad-page">
      <AdminHeader
        title={t.users.title}
        lead={t.users.lead}
        actions={
          selectedId ? (
            <Button type="button" variant="secondary" to="/admin/users">
              {t.backToList}
            </Button>
          ) : null
        }
      />
      {selectedId ? null : (
        <form className="ad-filters" onSubmit={(event) => event.preventDefault()}>
          <DebouncedField label={t.users.search} value={q} onCommit={(next) => patchParams({ q: next.trim() || null })} />
          <label className="wd-field">
            <span>{t.users.plan}</span>
            <select value={plan} onChange={(event) => patchParams({ plan: event.target.value === 'all' ? null : event.target.value })}>
              <option value="all">{t.users.all}</option>
              <option value="free">free</option>
              <option value="trial">trial</option>
              <option value="pro">pro</option>
            </select>
          </label>
          <label className="wd-field">
            <span>{t.users.status}</span>
            <select value={status} onChange={(event) => patchParams({ status: event.target.value === 'all' ? null : event.target.value })}>
              <option value="all">{t.users.all}</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
          </label>
        </form>
      )}
      <AdminStatusLine loading={loading} error={error} loadingLabel={t.loading} errorLabel={t.error} retryLabel={t.retry} onRetry={() => setTick((value) => value + 1)} />
      {actionError ? <p role="alert">{t.actionFailed}</p> : null}
      {list && !selectedId ? (
        <>
          <div className="wd-card ad-users-list">
            <p className="ad-table-count">{fillCopy(t.results, { count: list.total })}</p>
            {items.length === 0 ? (
              <p className="ad-inbox-empty">{t.empty}</p>
            ) : (
              <ul className="ad-inbox-items ad-users-items">
                {items.map((row) => (
                  <li key={row.id}>
                    <Link className="ad-inbox-item ad-users-row" to={`/admin/users/${encodeURIComponent(row.id)}`}>
                      <span className="ad-inbox-item-title">{row.email}</span>
                      <span className="ad-inbox-item-meta">
                        <StatusBadge value={row.plan} tone={planTone(row.plan)} />
                        <StatusBadge value={row.status} tone={statusTone(row.status)} />
                      </span>
                      <span className="ad-inbox-item-sub">
                        {t.users.joined}: {formatAdminDate(row.joinedAt)} · {t.users.activity}:{' '}
                        {formatAdminDate(row.lastActivityAt)} · {t.users.usage}: {row.requestCount.toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AdminPager
            page={list.page}
            pages={pages}
            label={fillCopy(t.page, { page: list.page, pages })}
            previous={t.previous}
            next={t.next}
            onPage={(next) => patchParams({ page: String(next) })}
          />
        </>
      ) : null}
      {detail ? (
        <div className="ad-detail-grid">
          <article className="wd-card">
            <h2>{t.users.detail}</h2>
            <dl className="ad-meta">
              <div><dt>{t.users.email}</dt><dd>{detail.account.email}</dd></div>
              <div><dt>{t.users.status}</dt><dd><StatusBadge value={detail.account.status} tone={statusTone(detail.account.status)} /></dd></div>
              <div><dt>{t.users.joined}</dt><dd>{formatAdminDateTime(detail.account.createdAt)}</dd></div>
              <div><dt>{t.users.activity}</dt><dd>{formatAdminDateTime(detail.lastActivityAt)}</dd></div>
              <div><dt>{t.users.verified}</dt><dd>{detail.account.emailVerified ? t.yes : t.no}</dd></div>
              <div><dt>{t.users.sessionsLabel}</dt><dd>{fillCopy(t.users.sessions, { count: detail.sessionCount })}</dd></div>
            </dl>
            <div className="btn-row">
              {detail.account.status === 'suspended' ? (
                <Button type="button" disabled={busy} onClick={() => setConfirm('restore')}>{t.users.restore}</Button>
              ) : (
                <Button type="button" variant="danger" disabled={busy} onClick={() => setConfirm('suspend')}>{t.users.suspend}</Button>
              )}
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirm('revoke')}>{t.users.revoke}</Button>
            </div>
          </article>
          <article className="wd-card">
            <h2>{t.users.entitlement}</h2>
            <p className="ad-chip-row">
              <StatusBadge value={detail.entitlement.plan} tone={planTone(detail.entitlement.plan)} />
              {detail.account.inTrial ? <StatusBadge value={t.users.trial} tone="info" /> : null}
              {detail.account.studentProActive ? <StatusBadge value={t.users.studentPro} tone="ok" /> : null}
            </p>
            <p>{t.users.creditsToday}: {detail.entitlement.creditsUsed} / {detail.entitlement.dailyLimit}</p>
            <p>{t.users.remaining}: {detail.entitlement.creditsRemaining}</p>
          </article>
          <article className="wd-card">
            <h2>{t.users.subscription}</h2>
            {detail.subscription ? (
              <p>
                <Link className="ad-table-link" to={`/admin/subscriptions?id=${encodeURIComponent(detail.subscription.paddleSubscriptionId)}`}>
                  {detail.subscription.status} · {detail.subscription.paddleSubscriptionId}
                </Link>
                <br />
                {detail.subscription.billingEnvironment}
              </p>
            ) : (
              <p>{t.empty}</p>
            )}
          </article>
          <article className="wd-card">
            <h2>{t.users.usageTitle}</h2>
            <p>{fillCopy(t.users.requestsBreakdown, { requests: detail.usage.requestCount, ok: detail.usage.successCount, failed: detail.usage.failureCount })}</p>
            <p>{fillCopy(t.users.creditsCharged, { count: detail.usage.creditsCharged })}</p>
          </article>
          <article className="wd-card">
            <h2>{t.users.learning}</h2>
            <p>{fillCopy(t.users.learningSummary, { events: detail.learning.learningEvents, practice: detail.learning.practiceSessions, days: detail.learning.activeDays })}</p>
          </article>
          <article className="wd-card">
            <h2>{t.users.tickets}</h2>
            {detail.supportTickets.length === 0 ? (
              <p>{t.empty}</p>
            ) : (
              <ul className="ad-plain-list">
                {detail.supportTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link className="ad-table-link" to={`/admin/support?id=${encodeURIComponent(ticket.id)}`}>
                      #{ticket.displayNumber} {ticket.subject}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirm === 'suspend'}
        title={t.users.suspend}
        body={t.users.suspendConfirm}
        confirmLabel={t.confirm}
        cancelLabel={t.cancel}
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runAction('suspend')}
      />
      <ConfirmDialog
        open={confirm === 'restore'}
        title={t.users.restore}
        body={t.users.restoreConfirm}
        confirmLabel={t.confirm}
        cancelLabel={t.cancel}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runAction('restore')}
      />
      <ConfirmDialog
        open={confirm === 'revoke'}
        title={t.users.revoke}
        body={t.users.revokeConfirm}
        confirmLabel={t.confirm}
        cancelLabel={t.cancel}
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runAction('revoke-sessions')}
      />
    </div>
  )
}
