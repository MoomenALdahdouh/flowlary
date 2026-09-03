import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FeedbackShowcase } from '../components/feedback/FeedbackShowcase.tsx'

export function FeedbackPage() {
  const [params] = useSearchParams()
  const initialTab = useMemo(() => {
    const tab = params.get('tab')
    if (tab === 'features' || tab === 'support') return tab
    return 'feedback'
  }, [params])

  return <FeedbackShowcase initialTab={initialTab} />
}
