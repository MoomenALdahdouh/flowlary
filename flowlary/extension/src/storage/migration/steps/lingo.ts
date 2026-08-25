import { normalizeExcludedDomains } from '../../../core/safety/domains.ts'
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  normalizeLanguage,
} from '../../../features/translation/languages.ts'
import {
  createDefaultEntitlement,
  mergeLicenseCaches,
  mergeUsageStates,
  normalizeEntitlement,
  normalizeLicenseCache,
  normalizeUsageState,
} from '../../entitlement.ts'
import { LEGACY_LINGO } from '../../legacyKeys.ts'
import {
  normalizeSettings,
  normalizeTranslation,
  readStoredString,
} from '../../schemas.ts'
import type { MigrationStepId, MigrationStepResult } from '../types.ts'
import type { StorageReader } from './ewa.ts'

type LingoProfile = {
  enabled?: unknown
  shortcutEnabled?: unknown
  liveEnabled?: unknown
  sourceLanguage?: unknown
  targetLanguage?: unknown
  excludedDomains?: unknown
  pausedUntil?: unknown
}

function normalizeLingoProfile(raw: unknown): LingoProfile {
  if (!raw || typeof raw !== 'object') return {}
  return raw as LingoProfile
}

export async function migrateLingoTranslation(
  reader: StorageReader & {
    hasFlowlaryTranslation(): Promise<boolean>
    hasFlowlarySettings(): Promise<boolean>
    getFlowlaryTranslation(): Promise<ReturnType<typeof normalizeTranslation> | undefined>
    getFlowlarySettings(): Promise<ReturnType<typeof normalizeSettings>>
    setFlowlaryTranslation(value: ReturnType<typeof normalizeTranslation>): Promise<void>
    setFlowlarySettings(value: ReturnType<typeof normalizeSettings>): Promise<void>
  },
): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'lingo_translation'
  try {
    const hasTranslation = await reader.hasFlowlaryTranslation()
    const hasSettings = await reader.hasFlowlarySettings()

    const legacyRaw = await reader.getLocal<LingoProfile>(LEGACY_LINGO.profile)
    if (!legacyRaw) return { id: step, ok: true, skipped: true }

    const legacy = normalizeLingoProfile(legacyRaw)

    if (!hasTranslation) {
      const translation = normalizeTranslation({
        liveEnabled: legacy.liveEnabled === true,
        shortcutEnabled: legacy.shortcutEnabled !== false,
        sourceLanguage: normalizeLanguage(legacy.sourceLanguage, DEFAULT_SOURCE_LANGUAGE),
        targetLanguage: normalizeLanguage(legacy.targetLanguage, DEFAULT_TARGET_LANGUAGE),
      })
      await reader.setFlowlaryTranslation(translation)
    }

    if (!hasSettings) {
      const pausedUntil =
        typeof legacy.pausedUntil === 'number' && Number.isFinite(legacy.pausedUntil) && legacy.pausedUntil > 0
          ? legacy.pausedUntil
          : null
      const settings = normalizeSettings({
        enabled: legacy.enabled !== false,
        pausedUntil,
        excludedDomains: Array.isArray(legacy.excludedDomains)
          ? normalizeExcludedDomains(legacy.excludedDomains)
          : [],
      })
      await reader.setFlowlarySettings(settings)
    }

    return { id: step, ok: true, skipped: hasTranslation && hasSettings }
  } catch {
    return { id: step, ok: false, error: 'lingo_translation_failed' }
  }
}

export async function migrateLingoEntitlement(
  reader: StorageReader & {
    getFlowlaryEntitlement(): Promise<ReturnType<typeof normalizeEntitlement>>
    setFlowlaryEntitlement(value: ReturnType<typeof normalizeEntitlement>): Promise<void>
    getFlowlaryLicenseKey(): Promise<string>
    setFlowlaryLicenseKey(key: string, area: 'local' | 'sync'): Promise<void>
  },
  now = Date.now(),
): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'lingo_entitlement'
  try {
    const hasLegacy =
      (await reader.getLocal(LEGACY_LINGO.usage)) != null ||
      (await reader.getLocal(LEGACY_LINGO.licenseCache)) != null ||
      (await reader.getSync(LEGACY_LINGO.licenseKey)) != null ||
      (await reader.getSync(LEGACY_LINGO.firstActivatedAt)) != null

    if (!hasLegacy) return { id: step, ok: true, skipped: true }

    let entitlement = await reader.getFlowlaryEntitlement()
    const existingHasData =
      entitlement.license.migratedFrom !== 'none' ||
      entitlement.license.cache.valid ||
      entitlement.usage.firstActivatedAt !== entitlement.usage.lastRefillAt

    const legacyUsage = await reader.getLocal(LEGACY_LINGO.usage)
    const legacyCache = await reader.getLocal(LEGACY_LINGO.licenseCache)
    const legacyKey = readStoredString(await reader.getSync(LEGACY_LINGO.licenseKey))
    const legacyFirstActivated = await reader.getSync<number>(LEGACY_LINGO.firstActivatedAt)

    let usage = normalizeUsageState(legacyUsage, now)
    if (legacyFirstActivated && typeof legacyFirstActivated === 'number') {
      usage = normalizeUsageState(
        { ...usage, firstActivatedAt: legacyFirstActivated, trialEndsAt: legacyFirstActivated + 7 * 86400000 },
        now,
      )
    }

    const licenseCache = normalizeLicenseCache(legacyCache)
    const flowlaryKey = await reader.getFlowlaryLicenseKey()

    if (!existingHasData) {
      entitlement = createDefaultEntitlement(now)
      entitlement.usage = usage
      entitlement.license = { cache: licenseCache, migratedFrom: 'lingo' }
    } else {
      entitlement.usage = mergeUsageStates(entitlement.usage, usage)
      entitlement.license.cache = mergeLicenseCaches(entitlement.license.cache, licenseCache, now)
      entitlement.license.migratedFrom =
        entitlement.license.migratedFrom === 'layfix' ? 'both' : 'lingo'
    }

    entitlement.status = normalizeEntitlement(entitlement, now).status
    await reader.setFlowlaryEntitlement(entitlement)

    if (!flowlaryKey.trim() && legacyKey.trim()) {
      await reader.setFlowlaryLicenseKey(legacyKey, 'sync')
    }

    const verify = await reader.getFlowlaryEntitlement()
    if (!verify || verify.product !== 'FLOWLARY') {
      return { id: step, ok: false, error: 'verification_failed' }
    }
    return { id: step, ok: true }
  } catch {
    return { id: step, ok: false, error: 'lingo_entitlement_failed' }
  }
}
