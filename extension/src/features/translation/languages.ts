import type { LanguageCode } from './types.ts'

export type LanguageOption = {
  code: LanguageCode
  name: string
  native: string
  direction: 'ltr' | 'rtl'
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', name: 'English', native: 'English', direction: 'ltr' },
  { code: 'ar', name: 'Arabic', native: 'العربية', direction: 'rtl' },
] as const

const CODES = new Set<string>(SUPPORTED_LANGUAGES.map((item) => item.code))

export const DEFAULT_SOURCE_LANGUAGE: LanguageCode = 'ar'
export const DEFAULT_TARGET_LANGUAGE: LanguageCode = 'en'

export function isSupportedLanguage(value: unknown): value is LanguageCode {
  return typeof value === 'string' && CODES.has(value)
}

export function normalizeLanguage(value: unknown, fallback: LanguageCode): LanguageCode {
  return isSupportedLanguage(value) ? value : fallback
}
