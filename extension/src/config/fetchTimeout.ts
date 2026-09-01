/** Default timeout for managed API calls from extension contexts. */
export const MANAGED_FETCH_TIMEOUT_MS = 12_000

export function managedFetchTimeoutSignal(ms = MANAGED_FETCH_TIMEOUT_MS): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}
