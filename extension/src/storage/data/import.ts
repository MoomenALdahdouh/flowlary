import {
  FLOWLARY_EXPORT_SCHEMA_VERSION,
  type DataImportPreview,
  type FlowlaryExportPayloadV1,
} from '@flowlary/shared'
import type { FlowlaryStorage } from '../index.ts'
import { activeAccountContext } from '../activeAccountContext.ts'
import { getAccountScopedStorage } from '../accountScopedStorage.ts'
import {
  setCorrectionSettings,
  setLayoutSettings,
  setSettings,
  setTranslationSettings,
} from '../facade.ts'
import { normalizeHistoryStore } from '../history/index.ts'
import { setLearningProfile } from '../learning/index.ts'
import { getLearningEventService, normalizeLearningEventStore } from '../learning/events/index.ts'
import {
  normalizePracticeSessionStore,
} from '../learning/practice/sessions.ts'
import {
  normalizeCorrection,
  normalizeLayout,
  normalizeSettings,
  normalizeTranslation,
} from '../schemas.ts'
import { normalizeLearningProfile } from '../learning/index.ts'

export type ImportUserDataOptions = {
  replaceProfile: boolean
}

export type ImportUserDataResult = {
  activityAdded: number
  learningEventsAdded: number
  practiceSessionsAdded: number
  profileReplaced: boolean
}

export function parseExportJson(raw: string): FlowlaryExportPayloadV1 {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('invalid_json')
  }
  return validateExportPayload(parsed)
}

export function validateExportPayload(raw: unknown): FlowlaryExportPayloadV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('invalid_schema')
  }
  const value = raw as Partial<FlowlaryExportPayloadV1>
  if (value.product !== 'flowlary') throw new Error('invalid_product')
  if (typeof value.schemaVersion !== 'number') throw new Error('invalid_schema')
  if (value.schemaVersion > FLOWLARY_EXPORT_SCHEMA_VERSION) {
    throw new Error('unsupported_version')
  }
  if (value.schemaVersion < 1) throw new Error('unsupported_version')
  if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
    throw new Error('invalid_schema')
  }
  return value as FlowlaryExportPayloadV1
}

export function previewImport(payload: FlowlaryExportPayloadV1): DataImportPreview {
  const data = payload.data
  return {
    schemaVersion: payload.schemaVersion,
    profileCount: data.learningProfile ? 1 : 0,
    learningEventCount: Array.isArray(data.learningEvents?.events) ? data.learningEvents.events.length : 0,
    practiceSessionCount: Array.isArray(data.practiceSessions?.sessions)
      ? data.practiceSessions.sessions.length
      : 0,
    activityCount: Array.isArray(data.activity?.entries) ? data.activity.entries.length : 0,
    hasSettings: Boolean(data.settings || data.correction || data.translation || data.layout),
  }
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): { merged: T[]; added: number } {
  const seen = new Set(existing.map((item) => item.id))
  const merged = [...existing]
  let added = 0
  for (const item of incoming) {
    if (!item?.id || seen.has(item.id)) continue
    merged.push(item)
    seen.add(item.id)
    added += 1
  }
  return { merged, added }
}

export async function importUserData(
  storage: FlowlaryStorage,
  payload: FlowlaryExportPayloadV1,
  options: ImportUserDataOptions,
): Promise<ImportUserDataResult> {
  if (!activeAccountContext.getAccountId()) {
    throw new Error('account_required')
  }

  const data = payload.data
  let activityAdded = 0
  let learningEventsAdded = 0
  let practiceSessionsAdded = 0
  let profileReplaced = false

  // Never import auth / identity. Settings (device) may update; account prefs write to active account only.
  if (data.settings) {
    await setSettings(storage, normalizeSettings(data.settings))
  }
  if (data.correction) {
    const normalized = normalizeCorrection(data.correction)
    await setCorrectionSettings(storage, normalized)
  }
  if (data.translation) {
    await setTranslationSettings(storage, normalizeTranslation(data.translation))
  }
  if (data.layout) {
    await setLayoutSettings(storage, normalizeLayout(data.layout))
  }

  if (data.learningProfile && options.replaceProfile) {
    await setLearningProfile(storage, normalizeLearningProfile(data.learningProfile))
    profileReplaced = true
  }

  if (data.activity?.entries) {
    const scoped = getAccountScopedStorage(storage)
    const current = normalizeHistoryStore(await scoped.get('history'))
    const incoming = normalizeHistoryStore({ version: 1, entries: data.activity.entries })
    const { merged, added } = mergeById(current.entries, incoming.entries)
    activityAdded = added
    await scoped.set('history', {
      version: 1,
      entries: merged,
      legacyImported: current.legacyImported ?? true,
      _v: 1,
    } as Record<string, unknown>)
  }

  if (data.learningEvents) {
    const scoped = getAccountScopedStorage(storage)
    const service = getLearningEventService(storage)
    await service.initialize()
    const current = await service.getStore()
    const incoming = normalizeLearningEventStore(data.learningEvents)
    const { merged, added } = mergeById(current.events, incoming.events)
    learningEventsAdded = added
    const sampleSeen = new Set(current.samples.map((s) => s.hash))
    const samples = [...current.samples]
    for (const sample of incoming.samples) {
      if (!sampleSeen.has(sample.hash)) {
        samples.push(sample)
        sampleSeen.add(sample.hash)
      }
    }
    await scoped.set(
      'learningEvents',
      normalizeLearningEventStore({ events: merged, samples }) as unknown as Record<string, unknown>,
    )
  }

  if (data.practiceSessions?.sessions) {
    const scoped = getAccountScopedStorage(storage)
    const current = normalizePracticeSessionStore(await scoped.get('learningSessions'))
    const incoming = normalizePracticeSessionStore({ version: 1, sessions: data.practiceSessions.sessions })
    const { merged, added } = mergeById(current.sessions, incoming.sessions)
    practiceSessionsAdded = added
    await scoped.set('learningSessions', {
      version: 1,
      sessions: merged,
      _v: 1,
    } as Record<string, unknown>)
  }

  return { activityAdded, learningEventsAdded, practiceSessionsAdded, profileReplaced }
}
