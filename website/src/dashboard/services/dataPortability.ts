import {
  FLOWLARY_EXPORT_SCHEMA_VERSION,
  type FlowlaryExportPayloadV1,
  type LearningEventIngestInput,
} from '@flowlary/shared'
import { fetchLearningEvents, ingestLearningEvents } from '../../account/learningEventsClient.ts'
import {
  pushRemoteLearningProfile,
  pushRemotePracticeSessions,
} from '../../account/learningSyncClient.ts'
import {
  readLearningProfile,
  readPracticeSessionStore,
  writeLearningProfile,
  writePracticeSessionStore,
} from '../storage/webLocalStore.ts'
import { normalizeLearningProfile } from '../storage/profile.ts'
import { normalizePracticeSessionStore } from '../learning/practice/sessions.ts'

export function buildWebLearningExport(accountId: string): FlowlaryExportPayloadV1 {
  const profile = readLearningProfile(accountId)
  const practice = readPracticeSessionStore(accountId)
  return {
    schemaVersion: FLOWLARY_EXPORT_SCHEMA_VERSION,
    product: 'flowlary',
    exportedAt: new Date().toISOString(),
    data: {
      learningProfile: profile as unknown as Record<string, unknown>,
      practiceSessions: { sessions: practice.sessions },
    },
  }
}

export async function buildWebLearningExportWithEvents(
  accountId: string,
): Promise<FlowlaryExportPayloadV1> {
  const base = buildWebLearningExport(accountId)
  const remote = await fetchLearningEvents()
  if (remote.ok) {
    base.data.learningEvents = {
      events: remote.store.events,
      samples: remote.store.samples,
    }
  }
  return base
}

function eventToIngest(event: {
  batchId: string
  category: import('@flowlary/shared').LearningEventCategory
  original: string
  corrected: string
  action: import('@flowlary/shared').LearningEventAction
  source: string
  sampleWordCount: number
  sampleHash: string
  timestamp: number
}): LearningEventIngestInput {
  return {
    batchId: event.batchId,
    category: event.category,
    original: event.original,
    corrected: event.corrected,
    action: event.action,
    source: event.source === 'practice' ? 'practice' : 'writing',
    sampleWordCount: event.sampleWordCount,
    sampleHash: event.sampleHash,
    timestamp: event.timestamp,
  }
}

export async function importWebLearningExport(
  accountId: string,
  payload: FlowlaryExportPayloadV1,
  options: { replaceProfile: boolean },
): Promise<{ profile: boolean; events: number; practice: number }> {
  let profileImported = false
  let eventsImported = 0
  let practiceImported = 0

  if (payload.data.learningProfile && options.replaceProfile) {
    const profile = normalizeLearningProfile(payload.data.learningProfile)
    writeLearningProfile(accountId, profile)
    await pushRemoteLearningProfile(profile)
    profileImported = true
  }

  if (payload.data.learningEvents?.events) {
    const inputs = payload.data.learningEvents.events
      .filter((event): event is NonNullable<typeof event> => Boolean(event && typeof event === 'object'))
      .map((event) => eventToIngest(event as Parameters<typeof eventToIngest>[0]))
    for (let index = 0; index < inputs.length; index += 25) {
      const batch = inputs.slice(index, index + 25)
      const result = await ingestLearningEvents(batch)
      if (result.ok) eventsImported += result.accepted
    }
  }

  if (payload.data.practiceSessions?.sessions) {
    const current = readPracticeSessionStore(accountId)
    const incoming = normalizePracticeSessionStore({
      version: current.version,
      sessions: payload.data.practiceSessions.sessions,
    })
    const byId = new Map(current.sessions.map((session) => [session.id, session]))
    for (const session of incoming.sessions) {
      if (!byId.has(session.id)) practiceImported += 1
      byId.set(session.id, session)
    }
    const merged = normalizePracticeSessionStore({
      version: current.version,
      sessions: [...byId.values()],
    })
    writePracticeSessionStore(accountId, merged)
    await pushRemotePracticeSessions(merged)
  }

  return { profile: profileImported, events: eventsImported, practice: practiceImported }
}

export function parseWebLearningExport(raw: string): FlowlaryExportPayloadV1 {
  const parsed = JSON.parse(raw) as FlowlaryExportPayloadV1
  if (parsed.product !== 'flowlary' || parsed.schemaVersion !== FLOWLARY_EXPORT_SCHEMA_VERSION) {
    throw new Error('invalid_export')
  }
  return parsed
}
