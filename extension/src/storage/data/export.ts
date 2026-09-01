import {
  FLOWLARY_EXPORT_SCHEMA_VERSION,
  STORAGE_KEYS,
  type FlowlaryExportPayloadV1,
} from '@flowlary/shared'
import type { FlowlaryStorage } from '../index.ts'
import { activeAccountContext } from '../activeAccountContext.ts'
import { getCorrectionSettings, getLayoutSettings, getSettings, getTranslationSettings } from '../facade.ts'
import { getLearningProfile } from '../learning/index.ts'
import { getLearningEventService } from '../learning/events/index.ts'
import { getPracticeSessionStore, normalizePracticeSessionStore } from '../learning/practice/sessions.ts'
import { getUnifiedHistoryStore } from '../facade.ts'

const SECRET_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.correctionGroqKey,
  STORAGE_KEYS.authInstallToken,
  STORAGE_KEYS.authAccessToken,
  STORAGE_KEYS.authRefreshToken,
  STORAGE_KEYS.authSessionId,
  STORAGE_KEYS.authAccountId,
  STORAGE_KEYS.entitlementLicenseKey,
])

function stripLegacyCorrectionSecrets(value: Record<string, unknown>): Record<string, unknown> {
  const { aiProvider: _ai, groqApiKey: _key, ...rest } = value
  return rest
}

/** Build a user-owned export without secrets or auth tokens. Requires active account. */
export async function buildFlowlaryExport(storage: FlowlaryStorage): Promise<FlowlaryExportPayloadV1> {
  if (!activeAccountContext.getAccountId()) {
    throw new Error('account_required')
  }
  await getLearningEventService(storage).initialize()
  const [settings, correction, translation, layout, profile, eventStore, history, sessions] =
    await Promise.all([
      getSettings(storage),
      getCorrectionSettings(storage),
      getTranslationSettings(storage),
      getLayoutSettings(storage),
      getLearningProfile(storage),
      getLearningEventService(storage).getStore(),
      getUnifiedHistoryStore(storage),
      getPracticeSessionStore(storage).list().then((list) => normalizePracticeSessionStore({ sessions: list })),
    ])

  return {
    schemaVersion: FLOWLARY_EXPORT_SCHEMA_VERSION,
    product: 'flowlary',
    exportedAt: new Date().toISOString(),
    data: {
      settings: settings as unknown as Record<string, unknown>,
      correction: stripLegacyCorrectionSecrets(correction as unknown as Record<string, unknown>),
      translation: translation as unknown as Record<string, unknown>,
      layout: layout as unknown as Record<string, unknown>,
      learningProfile: profile as unknown as Record<string, unknown>,
      learningEvents: { events: eventStore.events, samples: eventStore.samples },
      practiceSessions: { sessions: sessions.sessions },
      activity: { entries: history.entries },
    },
  }
}

export function exportContainsSecrets(json: string): boolean {
  for (const key of SECRET_STORAGE_KEYS) {
    if (json.includes(key)) return true
  }
  if (/gsk_[a-zA-Z0-9]+/.test(json)) return true
  if (/"groqApiKey"\s*:/.test(json)) return true
  if (/"aiProvider"\s*:\s*"byok"/.test(json)) return true
  return false
}

export async function serializeFlowlaryExport(storage: FlowlaryStorage): Promise<string> {
  const payload = await buildFlowlaryExport(storage)
  const json = JSON.stringify(payload, null, 2)
  if (exportContainsSecrets(json)) {
    throw new Error('export_secret_leak')
  }
  return json
}
