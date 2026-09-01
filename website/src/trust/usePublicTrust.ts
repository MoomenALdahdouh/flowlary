import { useEffect, useState } from 'react'
import type { PublicTrustPayload } from '@flowlary/shared'
import { fetchPublicTrust } from './client.ts'

export function usePublicTrust() {
  const [payload, setPayload] = useState<PublicTrustPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchPublicTrust().then((result) => {
      if (cancelled) return
      setPayload(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { payload, loading }
}
