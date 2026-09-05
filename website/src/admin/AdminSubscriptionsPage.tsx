import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AdminSubscriptionListItem, AdminSubscriptionListView } from '@flowlary/shared'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import { asAdminList, fetchAdminSubscription, fetchAdminSubscriptions } from './client.ts'
import { fillCopy, formatAdminDate, formatCents } from './format.ts'
import { StatusBadge, planTone, statusTone } from './StatusBadge.tsx'
import { AdminTable, AdminTableLink } from './AdminTable.tsx'
import { AdminHeader, AdminPager, AdminStatusLine, DebouncedField } from './ui.tsx'

export function AdminSubscriptionsPage() {
  const t = useMessages().adminPanel
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('id')
  const status = params.get('status') ?? 'all'
  const q = params.get('q') ?? ''
  const page = params.get('page') ?? '1'
  const [list, setList] = useState<AdminSubscriptionListView | null>(null)
  const [detail, setDetail] = useState<AdminSubscriptionListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)

  const query = useMemo(() => {
    const search = new URLSearchParams()
    if (status && status !== 'all') search.set('status', status)
    if (q) search.set('q', q)
    search.set('page', page)
    return `?${search.toString()}`
  }, [status, q, page])

  function patch(nextPatch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(nextPatch)) {
      if (!value) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const load = selectedId ? fetchAdminSubscription(selectedId) : fetchAdminSubscriptions(query)
    void load.then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setError(true)
        if (!selectedId) setList(null)
        else setDetail(null)
      } else if (selectedId) {
        const subscription = 'subscription' in res.body ? res.body.subscription : undefined
        if (!subscription) setError(true)
        else setDetail(subscription)
      } else {
        setList(asAdminList(res.body as { items?: AdminSubscriptionListItem[] | null; page?: number; pageSize?: number; total?: number }))
        setDetail(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [query, selectedId, tick])

  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1

  return (
    <div className="wd-panel-stack ad-page">
      <AdminHeader
        title={t.subscriptions.title}
        lead={t.subscriptions.lead}
        actions={
          selectedId ? (
            <Button type="button" variant="secondary" onClick={() => patch({ id: null })}>
              {t.backToList}
            </Button>
          ) : null
        }
      />
      {selectedId ? null : (
        <form className="ad-filters" onSubmit={(event) => event.preventDefault()}>
          <DebouncedField label={t.users.search} value={q} onCommit={(next) => patch({ q: next || null, page: '1' })} />
          <label className="wd-field">
            <span>{t.subscriptions.status}</span>
            <select value={status} onChange={(event) => patch({ status: event.target.value, page: '1' })}>
              {['all', 'active', 'trialing', 'past_due', 'paused', 'canceled', 'expired'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </form>
      )}
      <AdminStatusLine loading={loading} error={error} loadingLabel={t.loading} errorLabel={t.error} retryLabel={t.retry} onRetry={() => setTick((value) => value + 1)} />
      {list && !selectedId ? (
        <>
          <AdminTable
            columns={[
              {
                key: 'email',
                header: t.users.detail,
                cell: (row) => (
                  <AdminTableLink to={`/admin/subscriptions?id=${encodeURIComponent(row.paddleSubscriptionId)}`}>
                    {row.email}
                  </AdminTableLink>
                ),
              },
              { key: 'plan', header: t.users.plan, cell: (row) => <StatusBadge value={row.plan} tone={planTone(row.plan)} /> },
              { key: 'status', header: t.subscriptions.status, cell: (row) => <StatusBadge value={row.status} tone={statusTone(row.status)} /> },
              { key: 'interval', header: t.subscriptions.interval, cell: (row) => row.interval },
              {
                key: 'amount',
                header: t.subscriptions.amount,
                cell: (row) => row.amountCents == null ? t.subscriptions.noAmount : formatCents(row.amountCents, row.currency ?? 'USD'),
              },
              { key: 'renewal', header: t.subscriptions.renewal, cell: (row) => formatAdminDate(row.currentPeriodEnd) },
            ]}
            rows={list.items}
            rowKey={(row) => row.paddleSubscriptionId}
            empty={t.empty}
            countLabel={fillCopy(t.results, { count: list.total })}
          />
          <AdminPager
            page={list.page}
            pages={pages}
            label={fillCopy(t.page, { page: list.page, pages })}
            previous={t.previous}
            next={t.next}
            onPage={(next) => patch({ page: String(next) })}
          />
        </>
      ) : null}
      {detail ? (
        <article className="wd-card">
          <h2>{detail.email}</h2>
          <dl className="ad-meta ad-meta-grid">
            <div><dt>{t.subscriptions.status}</dt><dd><StatusBadge value={detail.status} tone={statusTone(detail.status)} /></dd></div>
            <div><dt>{t.users.plan}</dt><dd><StatusBadge value={detail.plan} tone={planTone(detail.plan)} /></dd></div>
            <div><dt>{t.subscriptions.interval}</dt><dd>{detail.interval}</dd></div>
            <div><dt>{t.subscriptions.amount}</dt><dd>{detail.amountCents == null ? t.subscriptions.noAmount : formatCents(detail.amountCents, detail.currency ?? 'USD')}</dd></div>
            <div><dt>{t.subscriptions.environment}</dt><dd>{detail.billingEnvironment}</dd></div>
            <div><dt>{t.subscriptions.paddleSubscription}</dt><dd>{detail.paddleSubscriptionId}</dd></div>
            <div><dt>{t.subscriptions.paddleCustomer}</dt><dd>{detail.paddleCustomerId}</dd></div>
            <div><dt>{t.subscriptions.cancelAtPeriodEnd}</dt><dd>{detail.cancelAtPeriodEnd ? t.yes : t.no}</dd></div>
            <div><dt>{t.subscriptions.created}</dt><dd>{formatAdminDate(detail.createdAt)}</dd></div>
            <div><dt>{t.subscriptions.periodEnd}</dt><dd>{formatAdminDate(detail.currentPeriodEnd)}</dd></div>
            <div><dt>{t.subscriptions.lastWebhook}</dt><dd>{formatAdminDate(detail.lastWebhookAt)}</dd></div>
            <div><dt>{t.subscriptions.lastEvent}</dt><dd>{detail.lastEventOccurredAt ?? '—'}</dd></div>
          </dl>
          <p>
            <AdminTableLink to={`/admin/users/${encodeURIComponent(detail.accountId)}`}>{t.openAccount}</AdminTableLink>
          </p>
        </article>
      ) : null}
    </div>
  )
}
