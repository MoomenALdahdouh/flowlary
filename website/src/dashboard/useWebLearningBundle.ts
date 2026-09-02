import { useCallback, useEffect, useState } from 'react'
import {
  loadWebLearningBundle,
  type WebLearningBundle,
} from './services/learningData.ts'

export function useWebLearningBundle(accountId: string | null) {
  const [bundle, setBundle] = useState<WebLearningBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    if (!accountId) {
      setBundle(null)
      setLoading(false)
      setError(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const next = await loadWebLearningBundle(accountId)
      if (!next.ok) {
        setError(true)
        setBundle(null)
      } else {
        setBundle(next.bundle)
        setError(next.degraded)
      }
    } catch {
      setError(true)
      setBundle(null)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { bundle, loading, error, refresh }
}
