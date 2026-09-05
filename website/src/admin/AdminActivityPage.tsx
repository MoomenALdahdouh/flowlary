import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AdminActivityView } from '@flowlary/shared'
import { useMessages } from '../i18n/index.tsx'
import { asAdminList, fetchAdminActivity } from './client.ts'
import { fillCopy, formatAdminDate, formatAdminDateTime } from './format.ts'
import { StatusBadge, statusTone } from './StatusBadge.tsx'
import { AdminTable, AdminTableLink } from './AdminTable.tsx'
import { AdminHeader, AdminPager, AdminStatusLine, DebouncedField } from './ui.tsx'

export function AdminActivityPage() {
  const t = useMessages().adminPanel
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = params.get('page') ?? '1'
  const [data, setData] = useState<AdminActivityView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const search = new URLSearchParams()
    if (q) search.set('q', q)
    search.set('page', page)
    void fetchAdminActivity(`?${search.toString()}`).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setError(true)
        setData(null)
      } else {
        const list = asAdminList(res.body)
        setData({
          ...res.body,
          items: list.items,
          page: list.page,
          pageSize: list.pageSize,
          total: list.total,
          operational: res.body.operational ?? { signups: [], subscriptionChanges: [], webhookEvents: [] },
        })
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [q, page, tick])

  function patch(nextPatch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(nextPatch)) {
      if (!value) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="wd-panel-stack ad-page">
      <AdminHeader title={t.activity.title} lead={t.activity.lead} />
      <form className="ad-filters" onSubmit={(event) => event.preventDefault()}>
        <DebouncedField label={t.users.search} value={q} onCommit={(next) => patch({ q: next || null, page: '1' })} />
      </form>
      <AdminStatusLine loading={loading} error={error} loadingLabel={t.loading} errorLabel={t.error} retryLabel={t.retry} onRetry={() => setTick((value) => value + 1)} />
      {data ? (
        <>
          <AdminTable
            columns={[
              { key: 'action', header: t.activity.audit, cell: (row) => row.action },
              { key: 'target', header: t.activity.target, cell: (row) => `${row.targetType} ${row.targetId.slice(0, 8)}` },
              { key: 'actor', header: t.activity.actor, cell: (row) => row.actorEmail },
              { key: 'when', header: t.activity.when, cell: (row) => formatAdminDateTime(row.createdAt) },
            ]}
            rows={data.items}
            rowKey={(row) => row.id}
            empty={t.empty}
            countLabel={fillCopy(t.results, { count: data.total })}
          />
          <AdminPager
            page={data.page}
            pages={pages}
            label={fillCopy(t.page, { page: data.page, pages })}
            previous={t.previous}
            next={t.next}
            onPage={(next) => patch({ page: String(next) })}
          />
          <div className="wd-overview-split">
            <article className="wd-card">
              <h2>{t.activity.signups}</h2>
              <AdminTable
                embedded
                columns={[
                  {
                    key: 'email',
                    header: t.users.email,
                    cell: (row) => <AdminTableLink to={`/admin/users/${encodeURIComponent(row.id)}`}>{row.email}</AdminTableLink>,
                  },
                  { key: 'when', header: t.activity.when, cell: (row) => formatAdminDateTime(row.createdAt) },
                ]}
                rows={data.operational.signups}
                rowKey={(row) => row.id}
                empty={t.empty}
              />
            </article>
            <article className="wd-card">
              <h2>{t.activity.billing}</h2>
              <AdminTable
                embedded
                columns={[
                  {
                    key: 'email',
                    header: t.users.email,
                    cell: (row) => (
                      <AdminTableLink to={`/admin/subscriptions?id=${encodeURIComponent(row.paddleSubscriptionId)}`}>
                        {row.email}
                      </AdminTableLink>
                    ),
                  },
                  { key: 'status', header: t.subscriptions.status, cell: (row) => <StatusBadge value={row.status} tone={statusTone(row.status)} /> },
                ]}
                rows={data.operational.subscriptionChanges}
                rowKey={(row) => row.paddleSubscriptionId}
                empty={t.empty}
              />
            </article>
          </div>
          <article className="wd-card">
            <h2>{t.activity.webhooks}</h2>
            <AdminTable
              embedded
              columns={[
                { key: 'type', header: t.activity.webhooks, cell: (row) => row.eventType },
                { key: 'when', header: t.activity.when, cell: (row) => formatAdminDate(row.processedAt) },
              ]}
              rows={data.operational.webhookEvents}
              rowKey={(row) => row.eventId}
              empty={t.empty}
            />
          </article>
        </>
      ) : null}
    </div>
  )
}
