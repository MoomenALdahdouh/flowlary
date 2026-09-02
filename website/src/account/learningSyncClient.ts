import type { LearningProfile, PracticeSessionStoreV1 } from '@flowlary/shared'
import { resolvePublicApiUrl } from '../config.ts'
import { ensureFreshWebSession } from './client.ts'

export type RemoteLearningError = 'auth' | 'network'

export type RemoteFetchResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: RemoteLearningError }

function bearerHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

function writeHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Flowlary-Client': 'website',
    'X-Flowlary-Surface': 'website',
  }
}

function mapHttpFailure(status: number): RemoteLearningError {
  return status === 401 ? 'auth' : 'network'
}

export async function fetchRemoteLearningProfile(): Promise<RemoteFetchResult<LearningProfile | null>> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, code: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/profile`, {
      headers: bearerHeaders(session.accessToken),
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return { ok: false, code: mapHttpFailure(response.status) }
    const body = (await response.json()) as { ok?: boolean; profile?: LearningProfile | null }
    if (!body.ok) return { ok: false, code: 'network' }
    return { ok: true, value: body.profile ?? null }
  } catch {
    return { ok: false, code: 'network' }
  }
}

export async function pushRemoteLearningProfile(profile: LearningProfile): Promise<boolean> {
  const session = await ensureFreshWebSession()
  if (!session) return false
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/profile`, {
      method: 'PUT',
      headers: writeHeaders(session.accessToken),
      body: JSON.stringify({ profile }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function fetchRemotePracticeSessions(): Promise<RemoteFetchResult<PracticeSessionStoreV1 | null>> {
  const session = await ensureFreshWebSession()
  if (!session) return { ok: false, code: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/practice-sessions`, {
      headers: bearerHeaders(session.accessToken),
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return { ok: false, code: mapHttpFailure(response.status) }
    const body = (await response.json()) as { ok?: boolean; store?: PracticeSessionStoreV1 | null }
    if (!body.ok) return { ok: false, code: 'network' }
    return { ok: true, value: body.store ?? null }
  } catch {
    return { ok: false, code: 'network' }
  }
}

export async function pushRemotePracticeSessions(store: PracticeSessionStoreV1): Promise<boolean> {
  const session = await ensureFreshWebSession()
  if (!session) return false
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/practice-sessions`, {
      method: 'PUT',
      headers: writeHeaders(session.accessToken),
      body: JSON.stringify({ store }),
    })
    return response.ok
  } catch {
    return false
  }
}

export function mergeLearningProfiles(local: LearningProfile, remote: LearningProfile | null): LearningProfile {
  if (!remote) return local
  return remote.updatedAt >= local.updatedAt ? remote : local
}

export function mergePracticeStores(
  local: PracticeSessionStoreV1,
  remote: PracticeSessionStoreV1 | null,
): PracticeSessionStoreV1 {
  if (!remote) return local
  const byId = new Map(local.sessions.map((session) => [session.id, session]))
  for (const session of remote.sessions) {
    if (!session?.id) continue
    byId.set(session.id, session)
  }
  return {
    version: local.version,
    sessions: [...byId.values()].sort(
      (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt),
    ),
  }
}
