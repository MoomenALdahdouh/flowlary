import type { FlowlaryStorage } from '../../index.ts'
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
      const groq = readStoredString(await storage.get(storage.keys.correctionGroqKey, 'local'))
      return normalizeCorrection(raw, groq)
    },
    getFlowlaryGroqKey: async () =>
      readStoredString(await storage.get(storage.keys.correctionGroqKey, 'local')),
    setFlowlaryCorrection: async (value) => {
      const { groqApiKey, ...rest } = value
      await storage.set(storage.keys.correction, withVersion(rest), 'local')
      if (groqApiKey.trim()) {
        await storage.setPrimitive(storage.keys.correctionGroqKey, groqApiKey, 'local')
      }
    },
    setGroqKey: (key) => storage.setPrimitive(storage.keys.correctionGroqKey, key, 'local'),
    getFlowlaryHistory: async () =>
      normalizeHistoryPreserve(await storage.get(storage.keys.history, 'local')),
    setFlowlaryHistory: (value) => storage.set(storage.keys.history, value, 'local'),
  }
}

function normalizeEwaMode(value: unknown): 'box' | 'direct' {
  return value === 'direct' ? 'direct' : 'box'
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

    const groqKey = await reader.getFlowlaryGroqKey()
    const legacyGroq = readStoredString(await reader.getLocal(LEGACY_EWA.groqApiKey))
    const merged = normalizeCorrection(
      {
        enabled: raw.enabled,
        highlights: raw.highlights,
        mode: normalizeEwaMode(raw.correctionMode),
        consentAccepted: raw.consentAccepted,
      },
      groqKey || legacyGroq,
    )

    await reader.setFlowlaryCorrection(merged)

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
