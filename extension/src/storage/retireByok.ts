import type { FlowlaryStorage } from './facade.ts'
import { getCorrectionSettings, setCorrectionSettings } from './facade.ts'
import { normalizeCorrection, readStoredString, withVersion } from './schemas.ts'
import { activeAccountContext } from './activeAccountContext.ts'

function legacyByokInStoredCorrection(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const value = raw as Record<string, unknown>
  if (value.aiProvider === 'byok') return true
  if (typeof value.groqApiKey === 'string' && value.groqApiKey.trim()) return true
  return false
}

/** Removes legacy BYOK keys and strips legacy provider fields from correction settings. Idempotent. */
export async function retireByokIfNeeded(storage: FlowlaryStorage): Promise<void> {
  const storedKey = readStoredString(await storage.get(storage.keys.correctionGroqKey, 'local'))
  const rawUnscoped = await storage.get(storage.keys.correction, 'local')

  const needsKeyRemoval = Boolean(storedKey.trim())
  const needsUnscopedFix = legacyByokInStoredCorrection(rawUnscoped)

  if (needsKeyRemoval) {
    await storage.remove(storage.keys.correctionGroqKey, 'local')
  }

  // Always scrub unscoped legacy correction envelopes (pre-isolation / migration leftovers).
  if (needsUnscopedFix) {
    const cleaned = normalizeCorrection(rawUnscoped)
    await storage.set(storage.keys.correction, withVersion(cleaned), 'local')
  }

  if (activeAccountContext.getAccountId()) {
    const correction = await getCorrectionSettings(storage)
    await setCorrectionSettings(storage, correction)
  }
}
