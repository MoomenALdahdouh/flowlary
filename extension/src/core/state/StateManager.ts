import { STORAGE_KEYS } from '@flowlary/shared'

export type HelpStyle = 'auto' | 'suggestions' | 'shortcuts_only'

export type FlowlarySettings = {
  enabled: boolean
  pausedUntil: number | null
  excludedDomains: string[]
  version: number
  /** Optional explicit policy. Unset → derived from feature toggles (Phase 1). */
  helpStyle?: HelpStyle | null
  /** Optional persisted capability overrides. Unset → derived from feature toggles. */
  fixWrongTyping?: boolean | null
  improveEnglish?: boolean | null
  arabicToEnglishMode?: boolean | null
  polishAfterTranslate?: boolean | null
  improveEnglishAfterTranslate?: boolean | null
  /** When false, the LLM advisor is not consulted. Default on. */
  aiAdvisorEnabled?: boolean | null
  /** When false, sentence-island writing review is not consulted. Default on. */
  aiWritingReviewEnabled?: boolean | null
}

export type FeatureApplyMode = 'box' | 'direct'

export type CorrectionSettings = {
  enabled: boolean
  mode: FeatureApplyMode
  highlights: boolean
  consentAccepted: boolean
}

export type TranslationSettings = {
  mode: FeatureApplyMode
  liveEnabled: boolean
  shortcutEnabled: boolean
  sourceLanguage: string
  targetLanguage: string
}

export type LayoutSettings = {
  mode: FeatureApplyMode
  autoEnabled: boolean
  manualConversionEnabled: boolean
  directShortcutEnabled: boolean
  sourceLayout: string
  targetLayouts: string[]
}

export const DEFAULT_SETTINGS: FlowlarySettings = {
  enabled: true,
  pausedUntil: null,
  excludedDomains: [],
  version: 1,
  helpStyle: 'auto',
  fixWrongTyping: true,
  improveEnglish: true,
  arabicToEnglishMode: false,
  polishAfterTranslate: false,
  improveEnglishAfterTranslate: false,
  aiAdvisorEnabled: true,
  aiWritingReviewEnabled: true,
}

export const DEFAULT_CORRECTION: CorrectionSettings = {
  enabled: true,
  mode: 'direct',
  highlights: true,
  consentAccepted: false,
}

export const DEFAULT_TRANSLATION: TranslationSettings = {
  mode: 'direct',
  liveEnabled: false,
  shortcutEnabled: true,
  sourceLanguage: 'ar',
  targetLanguage: 'en',
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  mode: 'direct',
  autoEnabled: true,
  manualConversionEnabled: true,
  directShortcutEnabled: true,
  sourceLayout: 'en-US-qwerty',
  targetLayouts: ['ar-101'],
}

export class StateManager {
  settings: FlowlarySettings = { ...DEFAULT_SETTINGS }
  correction: CorrectionSettings = { ...DEFAULT_CORRECTION }
  translation: TranslationSettings = { ...DEFAULT_TRANSLATION }
  layout: LayoutSettings = { ...DEFAULT_LAYOUT }
  /** Runtime copy of layout-profile exceptions. Not a second persist path. */
  personalExceptions: string[] = []
  /** Thresholded accepted-token hashes from layout events. */
  vocabularyHashes: string[] = []

  isActive(now = Date.now()): boolean {
    if (!this.settings.enabled) return false
    if (this.settings.pausedUntil != null && now < this.settings.pausedUntil) return false
    return true
  }

  storageKeys() {
    return STORAGE_KEYS
  }
}

export const stateManager = new StateManager()
