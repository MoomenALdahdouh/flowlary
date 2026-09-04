/** Central capability map — UI must derive language options from this data. */
export type LanguageCapability = {
  correction: boolean
  translation: boolean
  learning: boolean
}

export const LANGUAGE_CAPABILITIES: Record<string, LanguageCapability> = {
  en: { correction: true, translation: true, learning: true },
  ar: { correction: false, translation: true, learning: false },
}

export const LEARNING_LANGUAGES = ['en'] as const

export function getLanguageCapability(code: string): LanguageCapability {
  return LANGUAGE_CAPABILITIES[code] ?? { correction: false, translation: false, learning: false }
}

export function supportsCorrection(code: string): boolean {
  return getLanguageCapability(code).correction
}

export function supportsTranslation(code: string): boolean {
  return getLanguageCapability(code).translation
}
