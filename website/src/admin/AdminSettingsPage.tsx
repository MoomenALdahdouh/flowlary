import { useCallback, useEffect, useState } from 'react'
import type { AdminSettingsView } from '@flowlary/shared'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import { fetchAdminSettings } from './client.ts'
import { fetchAdminTestimonials, patchAdminTestimonial, type AdminTestimonialRow } from '../trust/client.ts'
import { StatusBadge, statusTone } from './StatusBadge.tsx'
import { AdminHeader, AdminStatusLine } from './ui.tsx'

export function AdminSettingsPage() {
  const t = useMessages()
  const copy = t.adminPanel
  const testimonialCopy = t.trust.adminTestimonials
  const [data, setData] = useState<AdminSettingsView | null>(null)
  const [testimonials, setTestimonials] = useState<AdminTestimonialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const res = await fetchAdminSettings()
    if (!res.ok) {
      setError(true)
      setData(null)
      setLoading(false)
      return
    }
    setData(res.body.settings)
    const items = await fetchAdminTestimonials()
    setTestimonials(items ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="wd-panel-stack ad-page">
      <AdminHeader title={copy.settings.title} lead={copy.settings.lead} />
      <AdminStatusLine loading={loading} error={error} loadingLabel={copy.loading} errorLabel={copy.error} retryLabel={copy.retry} onRetry={() => void load()} />
      {data ? (
        <>
          <div className="wd-overview-split">
            <article className="wd-card">
              <h2>{copy.settings.platform}</h2>
              <dl className="ad-meta">
                <div>
                  <dt>{copy.settings.environment}</dt>
                  <dd>{data.env}</dd>
                </div>
              </dl>
            </article>
            <article className="wd-card">
              <h2>{copy.settings.billing}</h2>
              <dl className="ad-meta">
                <div><dt>{copy.settings.provider}</dt><dd>{data.billing.provider}</dd></div>
                <div>
                  <dt>{copy.settings.status}</dt>
                  <dd>
                    <StatusBadge
                      value={data.billing.configured ? copy.settings.configured : copy.notConfigured}
                      tone={data.billing.configured ? 'ok' : 'warn'}
                    />
                  </dd>
                </div>
                <div>
                  <dt>{copy.settings.environment}</dt>
                  <dd>{data.billing.environment === 'production' ? copy.settings.production : copy.settings.sandbox}</dd>
                </div>
                <div><dt>{copy.settings.checkout}</dt><dd>{data.billing.checkoutAvailable ? copy.settings.configured : copy.notConfigured}</dd></div>
                <div><dt>{copy.settings.webhook}</dt><dd>{data.billing.webhookConfigured ? copy.settings.configured : copy.notConfigured}</dd></div>
                <div><dt>{copy.settings.portal}</dt><dd>{data.billing.portalAvailable ? copy.settings.configured : copy.notConfigured}</dd></div>
              </dl>
            </article>
          </div>
          <article className="wd-card">
            <h2>{copy.settings.providers}</h2>
            <ul className="ad-plain-list">
              {Object.entries(data.providers).map(([name, value]) => (
                <li key={name}>
                  <span>{name}</span>
                  <StatusBadge
                    value={value === 'configured' ? copy.settings.configured : copy.notConfigured}
                    tone={value === 'configured' ? 'ok' : 'warn'}
                  />
                </li>
              ))}
            </ul>
          </article>
          <article className="wd-card">
            <h2>{copy.settings.features}</h2>
            <ul className="ad-plain-list">
              {Object.entries(data.features).map(([name, value]) => (
                <li key={name}>
                  <span>{name}</span>
                  <StatusBadge value={value ? copy.settings.on : copy.settings.off} tone={value ? 'ok' : 'neutral'} />
                </li>
              ))}
            </ul>
          </article>
          <article className="wd-card">
            <h2>{copy.settings.health}</h2>
            {data.providerHealth.length === 0 ? <p>{copy.empty}</p> : (
              <ul className="ad-plain-list">
                {data.providerHealth.map((row) => (
                  <li key={row.provider}>
                    <span>
                      {row.provider}
                      {row.recentLatencyMs != null ? ` · ${copy.settings.latency} ${row.recentLatencyMs}ms` : ''}
                      {row.consecutiveFailures > 0 ? ` · ${copy.settings.failures} ${row.consecutiveFailures}` : ''}
                    </span>
                    <StatusBadge value={row.state} tone={statusTone(row.state === 'HEALTHY' ? 'active' : 'paused')} />
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="wd-card">
            <h2>{copy.settings.testimonials}</h2>
            <p className="wd-lead">{testimonialCopy.lead}</p>
            {testimonials.length === 0 ? <p>{testimonialCopy.empty}</p> : (
              <ul className="ad-plain-list">
                {testimonials.map((item) => (
                  <li key={item.id}>
                    <span>{item.displayName} — {item.published ? testimonialCopy.published : testimonialCopy.draft}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        void patchAdminTestimonial(item.id, { published: !item.published }).then((ok) => {
                          if (ok) void load()
                        })
                      }}
                    >
                      {item.published ? testimonialCopy.unpublish : testimonialCopy.publish}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </>
      ) : null}
    </div>
  )
}
