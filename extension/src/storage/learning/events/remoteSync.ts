import {
  changePresentInWritingSample,
  hashWritingSample,
  isValidLearningChange,
  learningEventDedupeKeyFromParts,
  type LearningEvent,
  type LearningEventIngestInput,
  type LearningEventStoreV1,
} from '@flowlary/shared'
import type { LearningProfile, PracticeSessionStoreV1 } from '@flowlary/shared'
import { ensureApiAuth } from '../../../config/accountAuth.ts'
import { FLOWLARY_API_BASE } from '../../../config/endpoints.ts'
import { managedFetchTimeoutSignal } from '../../../config/fetchTimeout.ts'
import type { FlowlaryStorage } from '../../index.ts'
import { getLearningProfile } from '../index.ts'
import {
  getPracticeSessionStore,
  normalizePracticeSessionStore,
} from '../practice/sessions.ts'
import { getLearningEventService, type LearningEventInput } from './index.ts'
import { normalizeLearningEventStore } from './validation.ts'

function eventDedupeKey(event: LearningEvent): string {
  return learningEventDedupeKeyFromParts(
    event.batchId,
    event.category,
    event.normalizedOriginal,
    event.action,
  )
}

export function mergeLearningEventStores(
  local: LearningEventStoreV1,
  remote: LearningEventStoreV1,
): LearningEventStoreV1 {
  const eventsByKey = new Map<string, LearningEvent>()
  for (const event of [...local.events, ...remote.events].sort((a, b) => b.timestamp - a.timestamp)) {
    const key = eventDedupeKey(event)
    if (!eventsByKey.has(key)) eventsByKey.set(key, event)
  }

  const samplesByHash = new Map<string, (typeof local.samples)[number]>()
  for (const sample of [...local.samples, ...remote.samples].sort((a, b) => b.timestamp - a.timestamp)) {
    if (!samplesByHash.has(sample.hash)) samplesByHash.set(sample.hash, sample)
  }

  return {
    version: local.version,
    events: [...eventsByKey.values()],
    samples: [...samplesByHash.values()],
  }
}

function inputToIngest(input: LearningEventInput): LearningEventIngestInput | null {
  if (!isValidLearningChange(input.original, input.corrected)) return null
  if (!changePresentInWritingSample(input.sampleText, input.original)) return null
  return {
    batchId: input.batchId,
    category: input.category,
    original: input.original,
    corrected: input.corrected,
    action: input.action,
    source: input.source === 'practice' ? 'practice' : 'writing',
    sampleWordCount: input.sampleWordCount,
    sampleHash: hashWritingSample(input.sampleText),
    timestamp: input.timestamp,
  }
}

export async function pullRemoteLearningStore(
  storage: FlowlaryStorage,
): Promise<LearningEventStoreV1 | null> {
  const auth = await ensureApiAuth(storage)
  if (!auth.account) return null

  try {
    const response = await fetch(`${FLOWLARY_API_BASE}/api/learning/events`, {
      headers: { Authorization: `Bearer ${auth.account.accessToken}` },
      signal: managedFetchTimeoutSignal(),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; store?: unknown }
    if (!body.ok) return null
    return normalizeLearningEventStore(body.store)
  } catch {
    return null
  }
}

export async function syncLearningEventsToRemote(
  storage: FlowlaryStorage,
  inputs: LearningEventInput[],
): Promise<void> {
  const auth = await ensureApiAuth(storage)
  if (!auth.account || inputs.length === 0) return

  const events = inputs
    .map(inputToIngest)
    .filter((item): item is LearningEventIngestInput => item != null)
  if (events.length === 0) return

  try {
    await fetch(`${FLOWLARY_API_BASE}/api/learning/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.account.accessToken}`,
      },
      body: JSON.stringify({ events }),
    })
  } catch {
    /* best effort — local store remains authoritative until next sync */
  }
}

export async function clearRemoteLearningEvents(storage: FlowlaryStorage): Promise<void> {
  const auth = await ensureApiAuth(storage)
  if (!auth.account) return

  try {
    await fetch(`${FLOWLARY_API_BASE}/api/learning/events`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.account.accessToken}` },
    })
  } catch {
    /* best effort */
  }
}

export async function pullAndMergeRemoteLearningEvents(
  storage: FlowlaryStorage,
  local: LearningEventStoreV1,
): Promise<LearningEventStoreV1> {
  const remote = await pullRemoteLearningStore(storage)
  if (!remote) return local
  return mergeLearningEventStores(local, remote)
}

export async function pullRemoteLearningProfile(
  storage: FlowlaryStorage,
): Promise<LearningProfile | null> {
  const auth = await ensureApiAuth(storage)
  if (!auth.account) return null
  try {
    const response = await fetch(`${FLOWLARY_API_BASE}/api/learning/profile`, {
      headers: { Authorization: `Bearer ${auth.account.accessToken}` },
      signal: managedFetchTimeoutSignal(),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; profile?: LearningProfile | null }
    return body.ok ? (body.profile ?? null) : null
  } catch {
    return null
  }
}

export async function pushRemoteLearningProfile(
  storage: FlowlaryStorage,
  profile: LearningProfile,
): Promise<void> {
  const auth = await ensureApiAuth(storage)
  if (!auth.account) return
  try {
    await fetch(`${FLOWLARY_API_BASE}/api/learning/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.account.accessToken}`,
      },
      body: JSON.stringify({ profile }),
      signal: managedFetchTimeoutSignal(),
    })
  } catch {
    /* best effort */
  }
}

export async function pullRemotePracticeSessions(
  storage: FlowlaryStorage,
): Promise<PracticeSessionStoreV1 | null> {
  const auth = await ensureApiAuth(storage)
  if (!auth.account) return null
  try {
    const response = await fetch(`${FLOWLARY_API_BASE}/api/learning/practice-sessions`, {
      headers: { Authorization: `Bearer ${auth.account.accessToken}` },
      signal: managedFetchTimeoutSignal(),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; store?: PracticeSessionStoreV1 }
    return body.ok && body.store ? body.store : null
  } catch {
    return null
  }
}

export async function pushRemotePracticeSessions(
  storage: FlowlaryStorage,
  store: PracticeSessionStoreV1,
): Promise<void> {
  const auth = await ensureApiAuth(storage)
  if (!auth.account) return
  try {
    await fetch(`${FLOWLARY_API_BASE}/api/learning/practice-sessions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.account.accessToken}`,
      },
      body: JSON.stringify({ store }),
      signal: managedFetchTimeoutSignal(),
    })
  } catch {
    /* best effort */
  }
}

export async function syncLearningEventStoreToRemote(
  storage: FlowlaryStorage,
  store: LearningEventStoreV1,
): Promise<void> {
  const auth = await ensureApiAuth(storage)
  if (!auth.account || store.events.length === 0) return

  const events: LearningEventIngestInput[] = store.events.map((event) => ({
    batchId: event.batchId,
    category: event.category,
    original: event.original,
    corrected: event.corrected,
    action: event.action,
    source: event.source === 'practice' ? 'practice' : 'writing',
    sampleWordCount: event.sampleWordCount,
    sampleHash: event.sampleHash,
    timestamp: event.timestamp,
  }))

  for (let index = 0; index < events.length; index += 25) {
    const batch = events.slice(index, index + 25)
    try {
      await fetch(`${FLOWLARY_API_BASE}/api/learning/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.account.accessToken}`,
        },
        body: JSON.stringify({ events: batch }),
      })
    } catch {
      /* best effort */
    }
  }
}

export async function pushLocalLearningStateToRemote(storage: FlowlaryStorage): Promise<void> {
  const profile = await getLearningProfile(storage)
  await pushRemoteLearningProfile(storage, profile)
  const sessions = await getPracticeSessionStore(storage).list()
  const store = normalizePracticeSessionStore({ version: 1, sessions })
  await pushRemotePracticeSessions(storage, store)
  const eventStore = await getLearningEventService(storage).getStore()
  await syncLearningEventStoreToRemote(storage, eventStore)
}
