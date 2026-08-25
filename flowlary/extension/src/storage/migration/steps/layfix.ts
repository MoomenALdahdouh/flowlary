import { normalizeExcludedDomains } from '../../../core/safety/domains.ts'
import { normalizeExceptions } from '../../../features/layout/profile/exceptions.ts'
import { normalizeEvents } from '../../../features/layout/profile/trust.ts'
import { normalizeProfile } from '../../../features/layout/layouts/profile.ts'
import {
  createDefaultEntitlement,
  mergeLicenseCaches,
  mergeUsageStates,
  normalizeEntitlement,
  normalizeLicenseCache,
  normalizeUsageState,
} from '../../entitlement.ts'
import { LEGACY_LAYFIX } from '../../legacyKeys.ts'
import {
  isValidLayout,
  normalizeHistoryPreserve,
  normalizeLayout,
  normalizeLayoutProfile,
  normalizeSettings,
  readStoredString,
} from '../../schemas.ts'
import type { MigrationStepId, MigrationStepResult } from '../types.ts'
import type { StorageReader } from './ewa.ts'

type LayfixProfile = {
  enabled?: unknown
  manualConversionEnabled?: unknown
  directShortcutEnabled?: unknown
  sourceLayout?: unknown
  enabledLayouts?: unknown
  excludedDomains?: unknown
  personalExceptions?: unknown
  pausedUntil?: unknown
}

function normalizeLayfixProfile(raw: unknown): LayfixProfile {
  if (!raw || typeof raw !== 'object') return {}
  return raw as LayfixProfile
}

function layfixProfileFromLegacy(input: {
  current?: unknown
  syncEnabled?: unknown
  syncLayoutProfile?: unknown
  syncExcludedDomains?: unknown
}): LayfixProfile | null {
  const current = normalizeLayfixProfile(input.current)
  if (input.current != null && Object.keys(current).length > 0) {
    return current
  }

  const hasSync =
    input.syncEnabled !== undefined ||
    input.syncLayoutProfile != null ||
    (Array.isArray(input.syncExcludedDomains) && input.syncExcludedDomains.length > 0)

  if (!hasSync) return null

  return {
    enabled: input.syncEnabled,
    ...(typeof input.syncLayoutProfile === 'object' && input.syncLayoutProfile
      ? (input.syncLayoutProfile as LayfixProfile)
      : {}),
    excludedDomains: input.syncExcludedDomains,
  }
}

export async function migrateLayfixLayout(
  reader: StorageReader & {
    hasFlowlaryLayout(): Promise<boolean>
    hasFlowlaryLayoutProfile(): Promise<boolean>
    getFlowlaryLayout(): Promise<ReturnType<typeof normalizeLayout> | undefined>
    getFlowlarySettings(): Promise<ReturnType<typeof normalizeSettings>>
    getFlowlaryLayoutProfile(): Promise<ReturnType<typeof normalizeLayoutProfile>>
    setFlowlaryLayout(value: ReturnType<typeof normalizeLayout>): Promise<void>
    setFlowlarySettings(value: ReturnType<typeof normalizeSettings>): Promise<void>
    setFlowlaryLayoutProfile(value: ReturnType<typeof normalizeLayoutProfile>): Promise<void>
  },
): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'layfix_layout'
  try {
    const localRaw = await reader.getLocal(LEGACY_LAYFIX.profile)
    const syncEnabled = await reader.getSync(LEGACY_LAYFIX.syncEnabled)
    const syncLayoutProfile = await reader.getSync(LEGACY_LAYFIX.syncLayoutProfile)
    const syncExcludedDomains = await reader.getSync(LEGACY_LAYFIX.syncExcludedDomains)

    const legacy = layfixProfileFromLegacy({
      current: localRaw,
      syncEnabled,
      syncLayoutProfile,
      syncExcludedDomains,
    })
    if (!legacy) return { id: step, ok: true, skipped: true }

    const hasLayout = await reader.hasFlowlaryLayout()
    const hasProfile = await reader.hasFlowlaryLayoutProfile()
    const existingProfile = await reader.getFlowlaryLayoutProfile()
    const hasExceptions = hasProfile && existingProfile.personalExceptions.length > 0

    if (!hasLayout) {
      const layouts = normalizeProfile({
        sourceLayout: legacy.sourceLayout,
        enabledLayouts: legacy.enabledLayouts,
      })
      const targetLayouts = layouts.enabledLayouts.filter((id) => id !== layouts.sourceLayout)
      const layout = normalizeLayout({
        autoEnabled: legacy.enabled !== false,
        manualConversionEnabled: legacy.manualConversionEnabled !== false,
        directShortcutEnabled: legacy.directShortcutEnabled !== false,
        sourceLayout: layouts.sourceLayout,
        targetLayouts,
      })
      await reader.setFlowlaryLayout(layout)
      const verifyLayout = await reader.getFlowlaryLayout()
      if (!verifyLayout || !isValidLayout(verifyLayout)) {
        return { id: step, ok: false, error: 'layout_verification_failed' }
      }
    }

    if (!hasExceptions && legacy.personalExceptions != null) {
      const profile = normalizeLayoutProfile({
        layoutProfile: normalizeProfile({
          sourceLayout: legacy.sourceLayout,
          enabledLayouts: legacy.enabledLayouts,
        }),
        personalExceptions: normalizeExceptions(legacy.personalExceptions),
        events: existingProfile.events,
      })
      await reader.setFlowlaryLayoutProfile(profile)
      const verifyProfile = await reader.getFlowlaryLayoutProfile()
      if (legacy.personalExceptions && Array.isArray(legacy.personalExceptions)) {
        const legacyCount = normalizeExceptions(legacy.personalExceptions).length
        if (verifyProfile.personalExceptions.length < legacyCount) {
          return { id: step, ok: false, error: 'exceptions_verification_failed' }
        }
      }
    }

    const existingSettings = await reader.getFlowlarySettings()
    if (
      existingSettings.excludedDomains.length === 0 &&
      legacy.excludedDomains != null
    ) {
      const pausedUntil =
        typeof legacy.pausedUntil === 'number' && Number.isFinite(legacy.pausedUntil) && legacy.pausedUntil > 0
          ? legacy.pausedUntil
          : existingSettings.pausedUntil
      await reader.setFlowlarySettings(
        normalizeSettings({
          ...existingSettings,
          pausedUntil,
          excludedDomains: normalizeExcludedDomains(legacy.excludedDomains),
        }),
      )
    }

    return { id: step, ok: true, skipped: hasLayout && hasExceptions }
  } catch {
    return { id: step, ok: false, error: 'layfix_layout_failed' }
  }
}

export async function migrateLayfixEvents(
  reader: StorageReader & {
    getFlowlaryLayoutProfile(): Promise<ReturnType<typeof normalizeLayoutProfile>>
    setFlowlaryLayoutProfile(value: ReturnType<typeof normalizeLayoutProfile>): Promise<void>
  },
): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'layfix_events'
  try {
    const legacyEvents = await reader.getLocal(LEGACY_LAYFIX.events)
    if (!legacyEvents) return { id: step, ok: true, skipped: true }

    const profile = await reader.getFlowlaryLayoutProfile()
    if (profile.events.length > 0) return { id: step, ok: true, skipped: true }

    const events = normalizeEvents(legacyEvents)
    const next = normalizeLayoutProfile({ ...profile, events })
    await reader.setFlowlaryLayoutProfile(next)

    const verify = await reader.getFlowlaryLayoutProfile()
    if (verify.events.length !== events.length) {
      return { id: step, ok: false, error: 'verification_failed' }
    }
    return { id: step, ok: true }
  } catch {
    return { id: step, ok: false, error: 'layfix_events_failed' }
  }
}

export async function migrateLayfixHistoryPreserve(
  reader: StorageReader & {
    getFlowlaryHistory(): Promise<ReturnType<typeof normalizeHistoryPreserve>>
    setFlowlaryHistory(value: ReturnType<typeof normalizeHistoryPreserve>): Promise<void>
  },
): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'layfix_history_preserve'
  try {
    const history = await reader.getFlowlaryHistory()
    if (history.layfix && history.layfix.length > 0) {
      return { id: step, ok: true, skipped: true }
    }

    const legacy = await reader.getLocal<unknown[]>(LEGACY_LAYFIX.history)
    if (!legacy || !Array.isArray(legacy) || legacy.length === 0) {
      return { id: step, ok: true, skipped: true }
    }

    const next = normalizeHistoryPreserve({ ...history, layfix: legacy })
    await reader.setFlowlaryHistory(next)

    const verify = await reader.getFlowlaryHistory()
    if (!verify.layfix || verify.layfix.length !== legacy.length) {
      return { id: step, ok: false, error: 'verification_failed' }
    }
    return { id: step, ok: true }
  } catch {
    return { id: step, ok: false, error: 'layfix_history_failed' }
  }
}

export async function migrateLayfixEntitlement(
  reader: StorageReader & {
    getFlowlaryEntitlement(): Promise<ReturnType<typeof normalizeEntitlement>>
    setFlowlaryEntitlement(value: ReturnType<typeof normalizeEntitlement>): Promise<void>
    getFlowlaryLicenseKey(): Promise<string>
    setFlowlaryLicenseKey(key: string, area: 'local' | 'sync'): Promise<void>
  },
  now = Date.now(),
): Promise<MigrationStepResult> {
  const step: MigrationStepId = 'layfix_entitlement'
  try {
    const hasLegacy =
      (await reader.getLocal(LEGACY_LAYFIX.usage)) != null ||
      (await reader.getLocal(LEGACY_LAYFIX.licenseCache)) != null ||
      (await reader.getSync(LEGACY_LAYFIX.licenseKey)) != null ||
      (await reader.getSync(LEGACY_LAYFIX.firstActivatedAt)) != null

    if (!hasLegacy) return { id: step, ok: true, skipped: true }

    let entitlement = await reader.getFlowlaryEntitlement()
    const legacyUsage = await reader.getLocal(LEGACY_LAYFIX.usage)
    const legacyCache = await reader.getLocal(LEGACY_LAYFIX.licenseCache)
    const legacyKey = readStoredString(await reader.getSync(LEGACY_LAYFIX.licenseKey))
    const legacyFirstActivated = await reader.getSync<number>(LEGACY_LAYFIX.firstActivatedAt)

    let usage = normalizeUsageState(legacyUsage, now)
    if (legacyFirstActivated && typeof legacyFirstActivated === 'number') {
      usage = normalizeUsageState(
        { ...usage, firstActivatedAt: legacyFirstActivated, trialEndsAt: legacyFirstActivated + 7 * 86400000 },
        now,
      )
    }

    const licenseCache = normalizeLicenseCache(legacyCache)
    const flowlaryKey = await reader.getFlowlaryLicenseKey()

    if (entitlement.license.migratedFrom === 'none' && !entitlement.license.cache.valid) {
      entitlement = createDefaultEntitlement(now)
      entitlement.usage = usage
      entitlement.license = { cache: licenseCache, migratedFrom: 'layfix' }
    } else {
      entitlement.usage = mergeUsageStates(entitlement.usage, usage)
      entitlement.license.cache = mergeLicenseCaches(entitlement.license.cache, licenseCache, now)
      entitlement.license.migratedFrom =
        entitlement.license.migratedFrom === 'lingo' ? 'both' : 'layfix'
    }

    entitlement.status = normalizeEntitlement(entitlement, now).status
    await reader.setFlowlaryEntitlement(entitlement)

    if (!flowlaryKey.trim() && legacyKey.trim()) {
      await reader.setFlowlaryLicenseKey(legacyKey, 'sync')
    }

    const verify = await reader.getFlowlaryEntitlement()
    if (!verify) return { id: step, ok: false, error: 'verification_failed' }
    return { id: step, ok: true }
  } catch {
    return { id: step, ok: false, error: 'layfix_entitlement_failed' }
  }
}

/** wordCacheV2 — Option B: preserve legacy cache untouched; Flowlary rebuilds naturally (Phase 12). */
export async function shouldMigrateWordCache(): Promise<boolean> {
  return false
}
