import {
  DEFAULT_CORRECTION,
  DEFAULT_LAYOUT,
  DEFAULT_SETTINGS,
  DEFAULT_TRANSLATION,
  type CorrectionSettings,
  type FlowlarySettings,
  type LayoutSettings,
  type TranslationSettings,
} from '../core/state/StateManager.ts'
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  normalizeLanguage,
} from '../features/translation/languages.ts'
import { isSupportedLayout } from '../features/layout/layouts/registry.ts'
import type { LayoutId } from '../features/layout/layouts/types.ts'
import {
  DEFAULT_LAYOUT_PROFILE_STATE,
  normalizeLayoutProfileState,
  type LayoutProfileState,
} from '../features/layout/profile/index.ts'
import { normalizeExcludedDomains } from '../core/safety/domains.ts'

const STORAGE_VERSION = 1

export type StoredRecord<T> = T & { _v?: number }

function stripVersion<T extends Record<string, unknown>>(raw: unknown): Partial<T> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const { _v: _ignored, ...rest } = raw as Record<string, unknown>
  return rest as Partial<T>
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeSettings(raw: unknown): FlowlarySettings {
  const value = stripVersion<FlowlarySettings>(raw)
  const pausedUntil =
    typeof value.pausedUntil === 'number' && Number.isFinite(value.pausedUntil)
      ? value.pausedUntil
      : null
  const helpStyle =
    value.helpStyle === 'auto' ||
    value.helpStyle === 'suggestions' ||
    value.helpStyle === 'shortcuts_only'
      ? value.helpStyle
      : null
  return {
    enabled: asBoolean(value.enabled, DEFAULT_SETTINGS.enabled),
    pausedUntil,
    excludedDomains: Array.isArray(value.excludedDomains)
      ? normalizeExcludedDomains(value.excludedDomains)
      : [],
    version: STORAGE_VERSION,
    helpStyle,
    fixWrongTyping: typeof value.fixWrongTyping === 'boolean' ? value.fixWrongTyping : null,
    improveEnglish: typeof value.improveEnglish === 'boolean' ? value.improveEnglish : null,
    arabicToEnglishMode:
      typeof value.arabicToEnglishMode === 'boolean' ? value.arabicToEnglishMode : null,
    polishAfterTranslate:
      typeof value.polishAfterTranslate === 'boolean'
        ? value.polishAfterTranslate
        : typeof value.improveEnglishAfterTranslate === 'boolean'
          ? value.improveEnglishAfterTranslate
          : null,
    improveEnglishAfterTranslate:
      typeof value.improveEnglishAfterTranslate === 'boolean'
        ? value.improveEnglishAfterTranslate
        : typeof value.polishAfterTranslate === 'boolean'
          ? value.polishAfterTranslate
          : null,
    aiAdvisorEnabled:
      typeof value.aiAdvisorEnabled === 'boolean'
        ? value.aiAdvisorEnabled
        : DEFAULT_SETTINGS.aiAdvisorEnabled,
    aiWritingReviewEnabled:
      typeof value.aiWritingReviewEnabled === 'boolean'
        ? value.aiWritingReviewEnabled
        : DEFAULT_SETTINGS.aiWritingReviewEnabled,
  }
}

export function normalizeCorrection(raw: unknown): CorrectionSettings {
  const value = stripVersion<CorrectionSettings>(raw)
  const mode = value.mode === 'box' || value.mode === 'direct' ? value.mode : DEFAULT_CORRECTION.mode
  return {
    enabled: asBoolean(value.enabled, DEFAULT_CORRECTION.enabled),
    mode,
    highlights: asBoolean(value.highlights, DEFAULT_CORRECTION.highlights),
    consentAccepted: asBoolean(value.consentAccepted, DEFAULT_CORRECTION.consentAccepted),
  }
}

export function normalizeTranslation(raw: unknown): TranslationSettings {
  const value = stripVersion<TranslationSettings>(raw)
  const mode =
    value.mode === 'box' || value.mode === 'direct' ? value.mode : DEFAULT_TRANSLATION.mode
  const sourceLanguage = normalizeLanguage(value.sourceLanguage, DEFAULT_SOURCE_LANGUAGE)
  let targetLanguage = normalizeLanguage(value.targetLanguage, DEFAULT_TARGET_LANGUAGE)
  if (targetLanguage === sourceLanguage) {
    targetLanguage =
      sourceLanguage === DEFAULT_TARGET_LANGUAGE
        ? DEFAULT_SOURCE_LANGUAGE
        : DEFAULT_TARGET_LANGUAGE
  }
  const liveEnabled = mode === 'box' ? false : value.liveEnabled === true
  return {
    mode,
    liveEnabled,
    shortcutEnabled: value.shortcutEnabled !== false,
    sourceLanguage,
    targetLanguage,
  }
}

export function normalizeLayout(raw: unknown): LayoutSettings {
  const value = stripVersion<LayoutSettings>(raw)
  const mode = value.mode === 'box' || value.mode === 'direct' ? value.mode : DEFAULT_LAYOUT.mode
  const sourceLayout =
    typeof value.sourceLayout === 'string' && isSupportedLayout(value.sourceLayout)
      ? value.sourceLayout
      : DEFAULT_LAYOUT.sourceLayout
  const targetLayouts = Array.isArray(value.targetLayouts)
    ? value.targetLayouts.filter((id): id is LayoutId => isSupportedLayout(id))
    : DEFAULT_LAYOUT.targetLayouts
  const uniqueTargets = [...new Set(targetLayouts.filter((id) => id !== sourceLayout))]
  return {
    mode,
    autoEnabled: value.autoEnabled !== false,
    manualConversionEnabled: value.manualConversionEnabled !== false,
    directShortcutEnabled: value.directShortcutEnabled !== false,
    sourceLayout,
    targetLayouts: uniqueTargets.length > 0 ? uniqueTargets : DEFAULT_LAYOUT.targetLayouts,
  }
}

export function normalizeLayoutProfile(raw: unknown): LayoutProfileState {
  return normalizeLayoutProfileState(raw)
}

export type FlowlaryHistoryPreserve = {
  _v: number
  ewa?: unknown[]
  layfix?: unknown[]
}

export function normalizeHistoryPreserve(raw: unknown): FlowlaryHistoryPreserve {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { _v: STORAGE_VERSION }
  }
  const value = raw as Partial<FlowlaryHistoryPreserve>
  const ewa = Array.isArray(value.ewa) ? value.ewa : undefined
  const layfix = Array.isArray(value.layfix) ? value.layfix : undefined
  return { _v: STORAGE_VERSION, ewa, layfix }
}

export function isValidSettings(value: FlowlarySettings): boolean {
  return typeof value.enabled === 'boolean' && Array.isArray(value.excludedDomains)
}

export function isValidCorrection(value: CorrectionSettings): boolean {
  return (value.mode === 'box' || value.mode === 'direct') && typeof value.enabled === 'boolean'
}

export function isValidTranslation(value: TranslationSettings): boolean {
  return (
    (value.mode === 'box' || value.mode === 'direct') &&
    typeof value.sourceLanguage === 'string' &&
    typeof value.targetLanguage === 'string'
  )
}

export function isValidLayout(value: LayoutSettings): boolean {
  return (value.mode === 'box' || value.mode === 'direct') && isSupportedLayout(value.sourceLayout)
}

export function withVersion<T extends Record<string, unknown>>(value: T): StoredRecord<T> {
  return { ...value, _v: STORAGE_VERSION }
}

export function readStoredString(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>
    if (typeof value.value === 'string') return value.value.trim()
  }
  return ''
}
