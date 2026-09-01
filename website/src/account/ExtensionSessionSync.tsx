import { useEffect } from 'react'
import { hasStoredWebSession } from '../account/client.ts'
import {
  FLOWLARY_EXT_SOURCE,
  syncStoredSessionToExtension,
} from '../account/extensionBridge.ts'

/**
 * Push website auth into the Chrome extension once the content bridge is ready.
 * Do not re-push on an interval — sharing/rotating the same refresh token signs
 * one surface out of the other.
 */
export function ExtensionSessionSync() {
  useEffect(() => {
    function sync() {
      if (!hasStoredWebSession()) return
      syncStoredSessionToExtension()
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data as { source?: string; type?: string } | null
      if (data?.source === FLOWLARY_EXT_SOURCE && data.type === 'bridge-ready') {
        sync()
      }
    }

    window.addEventListener('message', onMessage)
    sync()

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
