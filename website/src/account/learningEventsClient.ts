import type { LearningEventIngestInput, LearningEventStoreV1 } from '@flowlary/shared'
import { resolvePublicApiUrl } from '../config.ts'
import { ensureFreshWebSession } from './client.ts'

export type LearningEventsClientError = 'auth' | 'network' | 'invalid'

export type IngestLearningEventsResult =
  | { ok: true; accepted: number; deduplicated: number; rejected: number }
  | { ok: false; code: LearningEventsClientError }

export type FetchLearningEventsResult =
  | { ok: true; store: LearningEventStoreV1 }
  | { ok: false; code: LearningEventsClientError }

function authHeaders(token: string, client = false): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(client
      ? {
          'X-Flowlary-Client': 'website',
          'X-Flowlary-Surface': 'website',
        }
      : {}),
  }
}

/** POST /api/learning/events — canonical account-scoped ingestion. */
export async function ingestLearningEvents(
  events: LearningEventIngestInput[],
): Promise<IngestLearningEventsResult> {
  if (events.length === 0) {
    return { ok: true, accepted: 0, deduplicated: 0, rejected: 0 }
  }

  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, code: 'auth' }

  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(session.accessToken, true),
      },
      body: JSON.stringify({ events }),
    })

    let body: {
      ok?: boolean
      result?: { accepted?: number; deduplicated?: number; rejected?: number }
    } = {}
    try {
      body = (await response.json()) as typeof body
    } catch {
      return { ok: false, code: 'invalid' }
    }

    if (!response.ok || !body.ok || !body.result) {
      if (response.status === 401) return { ok: false, code: 'auth' }
      return { ok: false, code: response.ok ? 'invalid' : 'network' }
    }

    return {
      ok: true,
      accepted: body.result.accepted ?? 0,
      deduplicated: body.result.deduplicated ?? 0,
      rejected: body.result.rejected ?? 0,
    }
  } catch {
    return { ok: false, code: 'network' }
  }
}

/** GET /api/learning/events — canonical learning history for the signed-in account. */
export async function fetchLearningEvents(): Promise<FetchLearningEventsResult> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, code: 'auth' }

  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/events`, {
      headers: authHeaders(session.accessToken),
      signal: AbortSignal.timeout(12_000),
    })

    let body: { ok?: boolean; store?: LearningEventStoreV1 } = {}
    try {
      body = (await response.json()) as typeof body
    } catch {
      return { ok: false, code: 'invalid' }
    }

    if (!response.ok || !body.ok || !body.store) {
      if (response.status === 401) return { ok: false, code: 'auth' }
      return { ok: false, code: 'network' }
    }

    return { ok: true, store: body.store }
  } catch {
    return { ok: false, code: 'network' }
  }
}

/** DELETE /api/learning/events — clears canonical learning history (data control parity). */
export async function clearRemoteLearningEvents(): Promise<boolean> {
  const session = await ensureFreshWebSession()
  if (!session) return false

  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/events`, {
      method: 'DELETE',
      headers: authHeaders(session.accessToken),
    })
    const body = (await response.json()) as { ok?: boolean }
    return response.ok && body.ok === true
  } catch {
    return false
  }
}
