import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AdminUsageView } from '@flowlary/shared'
import { useMessages } from '../i18n/index.tsx'
import { fetchAdminUsage } from './client.ts'
import { StatusBadge, planTone, statusTone } from './StatusBadge.tsx'
import { AdminHeader, AdminStatusLine, SparkBars } from './ui.tsx'
import { AdminTable } from './AdminTable.tsx'

export function AdminUsagePage() {
  const t = useMessages().adminPanel
  const [params, setParams] = useSearchParams()
  const rangeDays = params.get('rangeDays') ?? '30'
  const feature = params.get('feature') ?? 'all'
  const status = params.get('status') ?? 'all'
  const plan = params.get('plan') ?? 'all'
  const provider = params.get('provider') ?? 'all'
  const [data, setData] = useState<AdminUsageView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)

  const query = useMemo(() => {
    const search = new URLSearchParams({ rangeDays })
    if (feature && feature !== 'all') search.set('feature', feature)
    if (status && status !== 'all') search.set('status', status)
    if (plan && plan !== 'all') search.set('plan', plan)
    if (provider && provider !== 'all') search.set('provider', provider)
    return `?${search.toString()}`
  }, [rangeDays, feature, status, plan, provider])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    void fetchAdminUsage(query).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setError(true)
        setData(null)
      } else setData(res.body.usage)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [query, tick])

  function patch(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <div className="wd-panel-stack ad-page">
      <AdminHeader title={t.usage.title} lead={t.usage.lead} />
      <form className="ad-filters ad-filters-wide" onSubmit={(event) => event.preventDefault()}>
        <label className="wd-field">
          <span>{t.range}</span>
          <select value={rangeDays} onChange={(event) => patch('rangeDays', event.target.value)}>
            <option value="1">{t.today}</option>
            <option value="7">{t.days7}</option>
            <option value="30">{t.days30}</option>
            <option value="90">{t.days90}</option>
          </select>
        </label>
        <label className="wd-field">
          <span>{t.usage.feature}</span>
          <select value={feature} onChange={(event) => patch('feature', event.target.value)}>
            {['all', 'correction', 'translation', 'layout-classification', 'hypothesis-advisor', 'writing-review'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="wd-field">
          <span>{t.subscriptions.status}</span>
          <select value={status} onChange={(event) => patch('status', event.target.value)}>
            <option value="all">{t.users.all}</option>
            <option value="success">{t.usage.success}</option>
            <option value="failure">{t.usage.failure}</option>
          </select>
        </label>
        <label className="wd-field">
          <span>{t.users.plan}</span>
          <select value={plan} onChange={(event) => patch('plan', event.target.value)}>
            {['all', 'free', 'trial', 'pro', 'anonymous'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="wd-field">
          <span>{t.usage.provider}</span>
          <select value={provider} onChange={(event) => patch('provider', event.target.value)}>
            {['all', 'groq', 'gemini', 'openrouter', 'google', 'unknown'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </form>
      <AdminStatusLine loading={loading} error={error} loadingLabel={t.loading} errorLabel={t.error} retryLabel={t.retry} onRetry={() => setTick((value) => value + 1)} />
      {data ? (
        <>
          <dl className="wd-stats-grid ad-kpi-grid">
            <div className="wd-stat-card"><dt>{t.kpis.requests}</dt><dd>{data.totals.requests.toLocaleString()}</dd></div>
            <div className="wd-stat-card"><dt>{t.usage.success}</dt><dd>{data.totals.success.toLocaleString()}</dd></div>
            <div className="wd-stat-card"><dt>{t.usage.failure}</dt><dd>{data.totals.failure.toLocaleString()}</dd></div>
            <div className="wd-stat-card"><dt>{t.kpis.creditsConsumed}</dt><dd>{data.totals.creditsConsumed.toLocaleString()}</dd></div>
          </dl>
          <p className="wd-lead">{t.usage.cache}</p>
          <p className="wd-lead">{t.usage.secretsNote}</p>
          <div className="wd-overview-split">
            <article className="wd-card">
              <h2>{t.usage.feature}</h2>
              <AdminTable
                embedded
                columns={[
                  { key: 'feature', header: t.usage.feature, cell: (row) => row.feature },
                  { key: 'requests', header: t.kpis.requests, cell: (row) => row.requests.toLocaleString() },
                  { key: 'credits', header: t.kpis.creditsConsumed, cell: (row) => row.credits.toLocaleString() },
                ]}
                rows={data.byFeature}
                rowKey={(row) => row.feature}
                empty={t.empty}
              />
            </article>
            <article className="wd-card">
              <h2>{t.usage.provider}</h2>
              <AdminTable
                embedded
                columns={[
                  { key: 'provider', header: t.usage.provider, cell: (row) => row.provider },
                  {
                    key: 'ratio',
                    header: t.subscriptions.status,
                    cell: (row) => <StatusBadge value={`${row.success}/${row.failure}`} tone={row.failure > 0 ? statusTone('failure') : 'ok'} />,
                  },
                ]}
                rows={data.byProvider}
                rowKey={(row) => row.provider}
                empty={t.empty}
              />
            </article>
          </div>
          <article className="wd-card">
            <h2>{t.usage.byPlan}</h2>
            <AdminTable
              embedded
              columns={[
                { key: 'plan', header: t.users.plan, cell: (row) => <StatusBadge value={row.plan} tone={planTone(row.plan)} /> },
                { key: 'requests', header: t.kpis.requests, cell: (row) => row.requests.toLocaleString() },
                { key: 'credits', header: t.kpis.creditsConsumed, cell: (row) => row.credits.toLocaleString() },
              ]}
              rows={data.byPlan}
              rowKey={(row) => row.plan}
              empty={t.empty}
            />
          </article>
          <article className="wd-card">
            <h2>{t.overview.aiUsage}</h2>
            <SparkBars
              empty={t.empty}
              rows={data.series.map((row) => ({
                key: row.date,
                label: row.date.slice(5),
                value: row.requests,
                extra: String(row.credits),
              }))}
            />
          </article>
        </>
      ) : null}
    </div>
  )
}
