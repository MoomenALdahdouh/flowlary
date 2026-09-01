import { useCallback, useEffect, useState } from 'react'
import { PageHero, Button } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import {
  fetchAdminGrowthSummary,
  fetchAdminTestimonials,
  patchAdminTestimonial,
  type AdminTestimonialRow,
} from '../../trust/client.ts'

export function GrowthAdminPage() {
  const t = useMessages()
  const copy = t.trust.adminGrowth
  const testimonialCopy = t.trust.adminTestimonials
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [testimonials, setTestimonials] = useState<AdminTestimonialRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchAdminGrowthSummary()
    if (!result) {
      setForbidden(true)
      setLoading(false)
      return
    }
    setSummary(result)
    const items = await fetchAdminTestimonials()
    setTestimonials(items ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function togglePublished(item: AdminTestimonialRow) {
    const ok = await patchAdminTestimonial(item.id, { published: !item.published })
    if (ok) void load()
  }

  if (loading) {
    return (
      <>
        <PageHero kicker={copy.kicker} title={copy.title} lead={copy.lead} />
        <section className="section">
          <div className="container">
            <p role="status">{copy.loading}</p>
          </div>
        </section>
      </>
    )
  }

  if (forbidden || !summary) {
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
          <pre className="fl-surface-1" style={{ padding: '1rem', overflow: 'auto', fontSize: '0.85rem' }}>
            {JSON.stringify(summary, null, 2)}
          </pre>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <h2>{testimonialCopy.title}</h2>
          <p className="muted">{testimonialCopy.lead}</p>
          {testimonials.length === 0 ? (
            <p>{testimonialCopy.empty}</p>
          ) : (
            <ul className="fb-admin-list">
              {testimonials.map((item) => (
                <li key={item.id} className="fl-surface-1 fb-admin-item">
                  <p>
                    <strong>{item.displayName}</strong>
                    {item.role ? ` · ${item.role}` : ''}
                  </p>
                  <p>{item.displayQuote}</p>
                  <p className="muted">
                    {item.accountEmailMasked}
                    {item.published ? ` · ${testimonialCopy.published}` : ` · ${testimonialCopy.draft}`}
                  </p>
                  <Button type="button" variant="secondary" onClick={() => void togglePublished(item)}>
                    {item.published ? testimonialCopy.unpublish : testimonialCopy.publish}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
