import { vi } from 'vitest'

/**
 * Learning report/brief tests freeze Date for quota day keys. They must not
 * also fake setTimeout/AbortSignal.timeout, or remote sync/narration fetch
 * can hang until the Vitest timeout.
 *
 * Stub managed learning API calls as unavailable so sync stays async and
 * best-effort without a real network.
 */
export function stubLearningRemoteUnavailable(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })),
  )
}
