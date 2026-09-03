import { useCallback, useEffect, useState } from 'react'
import { PageHero, Button } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import { fetchAdminFeedbackItems, fetchAdminFeedbackSummary, patchAdminFeedbackItem } from '../../feedback/client.ts'

export function FeedbackAdminPage() {
  const t = useMessages()
  const a = t.feedback.admin
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<Record<string, unknown>[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const summaryRes = await fetchAdminFeedbackSummary()
    if (!summaryRes.ok) {
      setForbidden(summaryRes.error === 'auth' || summaryRes.error.includes('403'))
      setLoading(false)
      return
    }
    setSummary(summaryRes.body.summary)
    const itemsRes = await fetchAdminFeedbackItems('?limit=100')
    if (itemsRes.ok) setItems(itemsRes.body.items)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function resolveItem(id: string) {
    const res = await patchAdminFeedbackItem(id, { status: 'RESOLVED' })
    if (res.ok) void load()
  }

  if (loading) {
    return (
      <>
        <PageHero kicker={a.kicker} title={a.title} lead={a.lead} />
        <section className="section">
          <div className="container">
            <p role="status">{a.loading}</p>
          </div>
        </section>
      </>
    )
  }

  if (forbidden) {
    return (
      <>
        <PageHero kicker={a.kicker} title={a.title} lead={a.lead} />
        <section className="section">
          <div className="container container-narrow">
            <p role="alert">{a.forbidden}</p>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHero kicker={a.kicker} title={a.title} lead={a.lead} />
      <section className="section">
        <div className="container">
          <div className="fb-admin-stats">
            {(
              [
                [a.total, summary?.total],
                [a.open, summary?.open],
                [a.unresolved, summary?.unresolved],
                [a.featureRequests, summary?.featureRequests],
                [a.bugReports, summary?.bugReports],
                [a.averageRating, summary?.averageRating ?? '-'],
              ] as const
            ).map(([label, value]) => (
              <article key={label} className="fl-surface-1 fb-admin-stat">
                <p className="muted">{label}</p>
                <strong>{String(value ?? '-')}</strong>
              </article>
            ))}
          </div>
          <div className="btn-row" style={{ marginBottom: '1rem' }}>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              {a.refresh}
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="muted">{a.noItems}</p>
          ) : (
            <div className="fb-admin-list">
              {items.map((item) => (
                <article key={String(item.id)} className="fl-surface-1 fb-admin-item">
                  <header>
                    <strong>{String(item.title ?? item.type ?? item.id)}</strong>
                    <span className="fb-badge">{String(item.status ?? 'SUBMITTED')}</span>
                  </header>
                  <p>{String(item.message ?? item.description ?? '')}</p>
                  <footer className="fb-admin-meta">
                    <span>{String(item.plan ?? '-')}</span>
                    <span>{String(item.accountEmailMasked ?? '-')}</span>
                    <Button type="button" variant="ghost" onClick={() => void resolveItem(String(item.id))}>
                      Resolve
                    </Button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
