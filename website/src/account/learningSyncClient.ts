import type { LearningProfile, PracticeSessionStoreV1 } from '@flowlary/shared'
import { resolvePublicApiUrl } from '../config.ts'
import { ensureFreshWebSession } from './client.ts'

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'X-Flowlary-Client': 'website',
    'Content-Type': 'application/json',
  }
}

export async function fetchRemoteLearningProfile(): Promise<LearningProfile | null> {
  const session = await ensureFreshWebSession()
  if (!session) return null
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/profile`, {
      headers: authHeaders(session.accessToken),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; profile?: LearningProfile | null }
    return body.ok ? (body.profile ?? null) : null
  } catch {
    return null
  }
}

export async function pushRemoteLearningProfile(profile: LearningProfile): Promise<boolean> {
  const session = await ensureFreshWebSession()
  if (!session) return false
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/profile`, {
      method: 'PUT',
      headers: authHeaders(session.accessToken),
      body: JSON.stringify({ profile }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function fetchRemotePracticeSessions(): Promise<PracticeSessionStoreV1 | null> {
  const session = await ensureFreshWebSession()
  if (!session) return null
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/practice-sessions`, {
      headers: authHeaders(session.accessToken),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; store?: PracticeSessionStoreV1 }
    return body.ok && body.store ? body.store : null
  } catch {
    return null
  }
}

export async function pushRemotePracticeSessions(store: PracticeSessionStoreV1): Promise<boolean> {
  const session = await ensureFreshWebSession()
  if (!session) return false
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/learning/practice-sessions`, {
      method: 'PUT',
      headers: authHeaders(session.accessToken),
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
