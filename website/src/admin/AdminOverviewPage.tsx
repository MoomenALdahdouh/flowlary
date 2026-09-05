import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AdminOverviewView } from '@flowlary/shared'
import { useMessages } from '../i18n/index.tsx'
import { fetchAdminOverview } from './client.ts'
import { fillCopy, formatAdminDate, formatCents, formatDelta, deltaTone } from './format.ts'
import { StatusBadge, planTone, statusTone } from './StatusBadge.tsx'
import { AdminHeader, AdminStatusLine, SparkBars } from './ui.tsx'
import { AdminTable, AdminTableLink } from './AdminTable.tsx'

const RANGES = [1, 7, 30, 90] as const

export function AdminOverviewPage() {
  const t = useMessages().adminPanel
  const [params, setParams] = useSearchParams()
  const rangeDays = RANGES.includes(Number(params.get('range')) as (typeof RANGES)[number])
    ? (Number(params.get('range')) as (typeof RANGES)[number])
    : 30
  const [data, setData] = useState<AdminOverviewView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    void fetchAdminOverview(rangeDays).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setError(true)
        setData(null)
      } else {
        setData(res.body.overview)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [rangeDays, tick])

  const rangeLabel = rangeDays === 1 ? t.today : rangeDays === 7 ? t.days7 : rangeDays === 90 ? t.days90 : t.days30

  return (
    <div className="wd-panel-stack ad-page">
      <AdminHeader
        kicker={t.kicker}
        title={t.title}
        lead={t.lead}
        actions={
          <label className="wd-field">
            <span>{t.range}</span>
            <select
              value={String(rangeDays)}
              onChange={(event) => {
                const next = new URLSearchParams(params)
                next.set('range', event.target.value)
                setParams(next, { replace: true })
              }}
            >
              <option value="1">{t.today}</option>
              <option value="7">{t.days7}</option>
              <option value="30">{t.days30}</option>
              <option value="90">{t.days90}</option>
            </select>
          </label>
        }
      />
      <AdminStatusLine
        loading={loading}
        error={error}
        loadingLabel={t.loading}
        errorLabel={t.error}
        retryLabel={t.retry}
        onRetry={() => setTick((value) => value + 1)}
      />
      {data ? (
        <>
          <dl className="wd-stats-grid ad-kpi-grid">
            {(
              [
                ['totalUsers', data.kpis.totalUsers],
                ['activeUsers', data.kpis.activeUsers],
                ['newUsers', data.kpis.newUsers],
                ['freeUsers', data.kpis.freeUsers],
                ['trialUsers', data.kpis.trialUsers],
                ['proUsers', data.kpis.proUsers],
                ['activeSubscriptions', data.kpis.activeSubscriptions],
                ['aiRequests', data.kpis.aiRequests],
                ['creditsConsumed', data.kpis.creditsConsumed],
              ] as const
            ).map(([key, kpi]) => {
              const delta = formatDelta(kpi.deltaPct)
              return (
                <div key={key} className="wd-stat-card">
                  <dt>{t.kpis[key]}</dt>
                  <dd>{kpi.value.toLocaleString()}</dd>
                  {delta ? (
                    <small className={`ad-delta ad-delta-${deltaTone(kpi.deltaPct)}`}>
                      {fillCopy(t.kpis.vsPrevious, { value: `${delta} · ${rangeLabel}` })}
                    </small>
                  ) : null}
                </div>
              )
            })}
          </dl>
          <article className="wd-card">
            <h2>{t.overview.catalogMrr}</h2>
            <p className="ad-mrr">
              {data.estimatedCatalogMrrCents == null ? t.unavailable : formatCents(data.estimatedCatalogMrrCents)}
            </p>
            <p className="wd-lead">{t.overview.catalogMrrNote}</p>
          </article>
          <div className="wd-overview-split">
            <article className="wd-card">
              <h2>{t.overview.userGrowth}</h2>
              <SparkBars
                empty={t.empty}
                rows={data.userGrowth.map((row) => ({
                  key: row.date,
                  label: row.date.slice(5),
                  value: row.newUsers,
                }))}
              />
            </article>
            <article className="wd-card">
              <h2>{t.overview.planDistribution}</h2>
              <ul className="ad-plan-list">
                {data.planDistribution.map((row) => (
                  <li key={row.plan}>
                    <StatusBadge value={row.plan} tone={planTone(row.plan)} />
                    <strong>{row.count.toLocaleString()}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <article className="wd-card">
            <h2>{t.overview.aiUsage}</h2>
            <SparkBars
              empty={t.empty}
              rows={data.aiUsage.map((row) => ({
                key: row.date,
                label: row.date.slice(5),
                value: row.requests,
                extra: String(row.credits),
              }))}
            />
          </article>
          <div className="wd-overview-split">
            <article className="wd-card">
              <header className="ad-card-head">
                <h2>{t.overview.recentSignups}</h2>
                <Link to="/admin/users">{t.viewAll}</Link>
              </header>
              {data.recentSignups.length === 0 ? <p>{t.empty}</p> : (
                <AdminTable
                  embedded
                  columns={[
                    {
                      key: 'email',
                      header: t.users.email,
                      cell: (user) => <AdminTableLink to={`/admin/users/${encodeURIComponent(user.id)}`}>{user.email}</AdminTableLink>,
                    },
                    { key: 'joined', header: t.users.joined, cell: (user) => formatAdminDate(user.joinedAt) },
                  ]}
                  rows={data.recentSignups}
                  rowKey={(user) => user.id}
                  empty={t.empty}
                />
              )}
            </article>
            <article className="wd-card">
              <header className="ad-card-head">
                <h2>{t.overview.recentSubscriptions}</h2>
                <Link to="/admin/subscriptions">{t.viewAll}</Link>
              </header>
              {data.recentSubscriptions.length === 0 ? <p>{t.empty}</p> : (
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
                  rows={data.recentSubscriptions}
                  rowKey={(row) => row.paddleSubscriptionId}
                  empty={t.empty}
                />
              )}
            </article>
          </div>
          <div className="wd-overview-split">
            <article className="wd-card">
              <header className="ad-card-head">
                <h2>{t.overview.recentSupport}</h2>
                <Link to="/admin/support">{t.viewAll}</Link>
              </header>
              {data.recentSupport.length === 0 ? <p>{t.empty}</p> : (
                <AdminTable
                  embedded
                  columns={[
                    {
                      key: 'subject',
                      header: t.overview.recentSupport,
                      cell: (row) => <AdminTableLink to={`/admin/support?id=${encodeURIComponent(row.id)}`}>{row.subject}</AdminTableLink>,
                    },
                    { key: 'status', header: t.users.status, cell: (row) => <StatusBadge value={row.status} tone={statusTone(row.status)} /> },
                  ]}
                  rows={data.recentSupport}
                  rowKey={(row) => row.id}
                  empty={t.empty}
                />
              )}
            </article>
            <article className="wd-card">
              <header className="ad-card-head">
                <h2>{t.overview.recentActivity}</h2>
                <Link to="/admin/activity">{t.viewAll}</Link>
              </header>
              {data.recentAdminActivity.length === 0 ? <p>{t.empty}</p> : (
                <AdminTable
                  embedded
                  columns={[
                    { key: 'action', header: t.activity.audit, cell: (row) => row.action },
                    { key: 'actor', header: t.activity.actor, cell: (row) => row.actorEmail },
                  ]}
                  rows={data.recentAdminActivity}
                  rowKey={(row) => row.id}
                  empty={t.empty}
                />
              )}
            </article>
          </div>
        </>
      ) : null}
    </div>
  )
}
