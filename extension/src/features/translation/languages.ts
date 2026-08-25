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
  { code: 'tr', name: 'Turkish', native: 'Türkçe', direction: 'ltr' },
  { code: 'es', name: 'Spanish', native: 'Español', direction: 'ltr' },
  { code: 'fr', name: 'French', native: 'Français', direction: 'ltr' },
  { code: 'de', name: 'German', native: 'Deutsch', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', native: 'Português', direction: 'ltr' },
  { code: 'it', name: 'Italian', native: 'Italiano', direction: 'ltr' },
  { code: 'ru', name: 'Russian', native: 'Русский', direction: 'ltr' },
  { code: 'zh', name: 'Chinese', native: '中文', direction: 'ltr' },
  { code: 'ja', name: 'Japanese', native: '日本語', direction: 'ltr' },
  { code: 'ko', name: 'Korean', native: '한국어', direction: 'ltr' },
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
