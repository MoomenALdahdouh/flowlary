import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHero } from '../components/Ui.tsx'
import { FeedbackHub } from '../components/feedback/FeedbackHub.tsx'
import { useMessages } from '../i18n/index.tsx'

export function FeedbackPage() {
  const t = useMessages()
  const f = t.feedback
  const [params] = useSearchParams()
  const initialTab = useMemo(() => {
    const tab = params.get('tab')
    if (tab === 'features' || tab === 'support') return tab
    return 'feedback'
  }, [params])

  return (
    <>
      <PageHero kicker={f.kicker} title={f.title} lead={f.lead} />
      <section className="section">
        <div className="container container-narrow">
          <FeedbackHub initialTab={initialTab} />
        </div>
      </section>
    </>
  )
}
