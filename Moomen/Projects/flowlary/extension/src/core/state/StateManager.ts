import { STORAGE_KEYS } from '@flowlary/shared'

export type FlowlarySettings = {
  enabled: boolean
  pausedUntil: number | null
  excludedDomains: string[]
  version: number
}

export type CorrectionSettings = {
  enabled: boolean
  mode: 'box' | 'direct'
  highlights: boolean
  consentAccepted: boolean
  groqApiKey: string
}

export type TranslationSettings = {
  liveEnabled: boolean
  shortcutEnabled: boolean
  sourceLanguage: string
  targetLanguage: string
}

export type LayoutSettings = {
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
}

export const DEFAULT_CORRECTION: CorrectionSettings = {
  enabled: true,
  mode: 'direct',
  highlights: true,
  consentAccepted: false,
  groqApiKey: '',
}

export const DEFAULT_TRANSLATION: TranslationSettings = {
  liveEnabled: false,
  shortcutEnabled: true,
  sourceLanguage: 'ar',
  targetLanguage: 'en',
}

export const DEFAULT_LAYOUT: LayoutSettings = {
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
