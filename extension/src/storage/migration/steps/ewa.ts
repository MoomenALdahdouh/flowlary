import type { FlowlarySettings } from '../../../core/state/StateManager.ts'
import type { FlowlaryStorage } from '../../index.ts'
import { getSettings, setSettings } from '../../facade.ts'
import { LEGACY_EWA } from '../../legacyKeys.ts'
import {
  isValidCorrection,
  normalizeCorrection,
  normalizeHistoryPreserve,
  readStoredString,
  withVersion,
} from '../../schemas.ts'
import type { MigrationStepId, MigrationStepResult } from '../types.ts'

type StorageReader = {
  getLocal<T>(key: string): Promise<T | undefined>
  getSync<T>(key: string): Promise<T | undefined>
  hasFlowlaryCorrection(): Promise<boolean>
  hasFlowlaryGroqKey(): Promise<boolean>
  getFlowlaryCorrection(): Promise<ReturnType<typeof normalizeCorrection> | undefined>
  getFlowlaryGroqKey(): Promise<string>
  setFlowlaryCorrection(value: ReturnType<typeof normalizeCorrection>): Promise<void>
  setGroqKey(key: string): Promise<void>
  getFlowlaryHistory(): Promise<ReturnType<typeof normalizeHistoryPreserve>>
  setFlowlaryHistory(value: ReturnType<typeof normalizeHistoryPreserve>): Promise<void>
  hasFlowlarySettings(): Promise<boolean>
  getFlowlarySettings(): Promise<FlowlarySettings>
  setFlowlarySettings(value: FlowlarySettings): Promise<void>
}

export function createStorageReader(storage: FlowlaryStorage): StorageReader {
  return {
    getLocal: (key) => storage.get(key, 'local'),
    getSync: (key) => storage.get(key, 'sync'),
    hasFlowlaryCorrection: async () =>
      Boolean(await storage.get(storage.keys.correction, 'local')),
    hasFlowlaryGroqKey: async () =>
      Boolean(await storage.get(storage.keys.correctionGroqKey, 'local')),
    getFlowlaryCorrection: async () => {
      const raw = await storage.get(storage.keys.correction, 'local')
      if (!raw) return undefined
      return normalizeCorrection(raw)
    },
    getFlowlaryGroqKey: async () =>
      readStoredString(await storage.get(storage.keys.correctionGroqKey, 'local')),
    setFlowlaryCorrection: async (value) => {
      await storage.set(storage.keys.correction, withVersion(value), 'local')
    },
    setGroqKey: (key) => storage.setPrimitive(storage.keys.correctionGroqKey, key, 'local'),
    getFlowlaryHistory: async () =>
      normalizeHistoryPreserve(await storage.get(storage.keys.history, 'local')),
    setFlowlaryHistory: (value) => storage.set(storage.keys.history, value, 'local'),
    hasFlowlarySettings: async () => Boolean(await storage.get(storage.keys.settings, 'local')),
    getFlowlarySettings: () => getSettings(storage),
    setFlowlarySettings: (value) => setSettings(storage, value),
  }
}

function normalizeEwaMode(value: unknown): 'box' | 'direct' {
  return value === 'direct' ? 'direct' : 'box'
}

/**
 * Unified policy reads `settings.improveEnglish` / `helpStyle` ahead of
 * `correction.enabled` / `correction.mode`. Persist explicit EWA values so
 * hydrate defaults cannot re-enable English or rewrite apply mode.
 * Skip fields the user already set in unified settings.
 */
async function persistUnifiedPolicyFromEwa(
  reader: StorageReader,
  raw: Record<string, unknown>,
): Promise<void> {
  const existing = await reader.getFlowlarySettings()
  const next = { ...existing }
  let changed = false

  if (typeof raw.enabled === 'boolean' && typeof existing.improveEnglish !== 'boolean') {
    next.improveEnglish = raw.enabled
    changed = true
  }
  if (
    (existing.helpStyle == null || existing.helpStyle === undefined) &&
    (raw.correctionMode === 'box' || raw.correctionMode === 'direct')
  ) {
    next.helpStyle = raw.correctionMode === 'box' ? 'suggestions' : 'auto'
    changed = true
  }
  if (changed) await reader.setFlowlarySettings(next)
}

export async function migrateEwaCorrection(reader: StorageReader): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'ewa_correction'
  try {
    const hasCorrection = await reader.hasFlowlaryCorrection()
    if (hasCorrection) {
      return { id: step, ok: true, skipped: true }
    }

    const raw = await reader.getSync<Record<string, unknown>>(LEGACY_EWA.settings)
    if (!raw) return { id: step, ok: true, skipped: true }

    const merged = normalizeCorrection({
      enabled: raw.enabled,
      highlights: raw.highlights,
      mode: normalizeEwaMode(raw.correctionMode),
      consentAccepted: raw.consentAccepted,
    })

    await reader.setFlowlaryCorrection(merged)
    await persistUnifiedPolicyFromEwa(reader, raw)

    const verify = await reader.getFlowlaryCorrection()
    if (!verify || !isValidCorrection(verify)) {
      return { id: step, ok: false, error: 'verification_failed' }
    }
    return { id: step, ok: true }
  } catch {
    return { id: step, ok: false, error: 'ewa_correction_failed' }
  }
}

export async function migrateEwaGroqKey(reader: StorageReader): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'ewa_groq_key'
  try {
    const hasKey = await reader.hasFlowlaryGroqKey()
    if (hasKey) return { id: step, ok: true, skipped: true }

    const legacy = readStoredString(await reader.getLocal(LEGACY_EWA.groqApiKey))
    if (!legacy) return { id: step, ok: true, skipped: true }

    await reader.setGroqKey(legacy)
    const verify = await reader.getFlowlaryGroqKey()
    if (verify !== legacy) {
      return { id: step, ok: false, error: 'verification_failed' }
    }
    return { id: step, ok: true }
  } catch {
    return { id: step, ok: false, error: 'ewa_groq_key_failed' }
  }
}

export async function migrateEwaHistoryPreserve(reader: StorageReader): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'ewa_history_preserve'
  try {
    const history = await reader.getFlowlaryHistory()
    if (history.ewa && history.ewa.length > 0) {
      return { id: step, ok: true, skipped: true }
    }

    const legacy = await reader.getLocal<unknown[]>(LEGACY_EWA.history)
    if (!legacy || !Array.isArray(legacy) || legacy.length === 0) {
      return { id: step, ok: true, skipped: true }
    }

    const next = normalizeHistoryPreserve({ ...history, ewa: legacy })
    await reader.setFlowlaryHistory(next)

    const verify = await reader.getFlowlaryHistory()
    if (!verify.ewa || verify.ewa.length !== legacy.length) {
      return { id: step, ok: false, error: 'verification_failed' }
    }
    return { id: step, ok: true }
  } catch {
    return { id: step, ok: false, error: 'ewa_history_failed' }
  }
}

export type { StorageReader }
