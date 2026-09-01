import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ExtensionStatus } from '../messaging/types.ts'
import { computeDomainState } from '../ui/domainState.ts'
import { fetchStatus, PopupApiError } from './api.ts'
import { t } from './i18n/index.ts'
import { computeConnectionState, computeFeatureStatus } from './status.ts'
import { parseAccountIdFromStorageKey } from '../storage/accountScopedStorage.ts'

const SYNC_PREFIX = 'flowlary.'

function isRelevantStorageKey(key: string, activeAccountId: string | null): boolean {
  if (!key.startsWith(SYNC_PREFIX)) return false
  const scopedAccount = parseAccountIdFromStorageKey(key)
  if (scopedAccount) {
    return activeAccountId != null && scopedAccount === activeAccountId
  }
  return true
}

export function useExtensionSession() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reloadSeq = useRef(0)
  const activeAccountIdRef = useRef<string | null>(null)

  const featureStatus = useMemo(() => computeFeatureStatus(status), [status])
  const domain = useMemo(() => computeDomainState(status, loading), [status, loading])
  const connectionState = useMemo(
    () => computeConnectionState(loading, error, status?.apiHealth),
    [loading, error, status?.apiHealth],
  )

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    const seq = ++reloadSeq.current
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const next = await fetchStatus()
      if (seq !== reloadSeq.current) return
      const nextId = next.account.accountId
      const prevId = activeAccountIdRef.current
      if (prevId && nextId && prevId !== nextId) {
        // Never show previous account data while hydrating the next.
        setStatus(null)
      }
      if (prevId && !nextId) {
        setStatus(null)
      }
      activeAccountIdRef.current = nextId
      setStatus(next)
      if (!silent) setError(null)
    } catch (err) {
      if (seq !== reloadSeq.current) return
      if (!silent) {
        setError(err instanceof PopupApiError ? err.message : t('errors.loadSettings'))
      }
    } finally {
      if (seq === reloadSeq.current && !silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Recover automatically when the local API comes back after being offline.
  useEffect(() => {
    if (status?.apiHealth !== 'offline') return
    const timer = setInterval(() => {
      void reload({ silent: true })
    }, 8_000)
    return () => clearInterval(timer)
  }, [reload, status?.apiHealth])

  useEffect(() => {
    if (typeof document === 'undefined') return
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void reload({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  // When the display countdown hits the server reset boundary, refresh entitlement (server remains authoritative).
  useEffect(() => {
    const resetAt = status?.entitlement.resetAt ?? 0
    if (!resetAt || !status?.account.signedIn) return
    const delay = Math.max(0, resetAt - Date.now()) + 250
    if (delay > 24 * 60 * 60 * 1000) return
    const timer = setTimeout(() => {
      void reload({ silent: true })
    }, delay)
    return () => clearTimeout(timer)
  }, [reload, status?.account.signedIn, status?.entitlement.resetAt])

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return
    let timer: ReturnType<typeof setTimeout> | undefined
    function onChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
      if (area !== 'local') return
      if (!Object.keys(changes).some((key) => isRelevantStorageKey(key, activeAccountIdRef.current))) {
        return
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void reload({ silent: true })
      }, 120)
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      if (timer) clearTimeout(timer)
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [reload])

  async function mutate(
    key: string,
    fn: () => Promise<ExtensionStatus>,
    rollback?: () => void,
  ): Promise<void> {
    setBusy(key)
    setError(null)
    try {
      const next = await fn()
      setStatus(next)
    } catch (err) {
      rollback?.()
      setError(err instanceof PopupApiError ? err.message : t('errors.saveSettings'))
    } finally {
      setBusy(null)
    }
  }

  return {
    status,
    setStatus,
    loading,
    busy,
    setBusy,
    error,
    setError,
    featureStatus,
    domain,
    connectionState,
    reload,
    mutate,
  }
}
