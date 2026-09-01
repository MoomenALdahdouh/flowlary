/** UI locales aligned with implemented keyboard layout languages. */
export const UI_LOCALE_CODES = [
  'en',
  'ar',
  'ru',
  'de',
  'fr',
  'tr',
  'el',
  'es',
  'it',
  'pt',
  'uk',
  'fa',
] as const

export type UiLocaleCode = (typeof UI_LOCALE_CODES)[number]

export type UiLocaleMeta = {
  code: UiLocaleCode
  label: string
  nativeLabel: string
  direction: 'ltr' | 'rtl'
  /** BCP 47 tag for document.documentElement.lang */
  htmlLang: string
  /** Open Graph locale tag */
  ogLocale: string
}

export const UI_LOCALES: readonly UiLocaleMeta[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', direction: 'ltr', htmlLang: 'en', ogLocale: 'en_US' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', direction: 'rtl', htmlLang: 'ar', ogLocale: 'ar_SA' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', direction: 'ltr', htmlLang: 'ru', ogLocale: 'ru_RU' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', direction: 'ltr', htmlLang: 'de', ogLocale: 'de_DE' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', direction: 'ltr', htmlLang: 'fr', ogLocale: 'fr_FR' },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', direction: 'ltr', htmlLang: 'tr', ogLocale: 'tr_TR' },
  { code: 'el', label: 'Greek', nativeLabel: 'Ελληνικά', direction: 'ltr', htmlLang: 'el', ogLocale: 'el_GR' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', direction: 'ltr', htmlLang: 'es', ogLocale: 'es_ES' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', direction: 'ltr', htmlLang: 'it', ogLocale: 'it_IT' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', direction: 'ltr', htmlLang: 'pt', ogLocale: 'pt_BR' },
  { code: 'uk', label: 'Ukrainian', nativeLabel: 'Українська', direction: 'ltr', htmlLang: 'uk', ogLocale: 'uk_UA' },
  { code: 'fa', label: 'Persian', nativeLabel: 'فارسی', direction: 'rtl', htmlLang: 'fa', ogLocale: 'fa_IR' },
]

export const RTL_UI_LOCALE_CODES = new Set<UiLocaleCode>(['ar', 'fa'])

export function isUiLocaleCode(value: unknown): value is UiLocaleCode {
  return typeof value === 'string' && (UI_LOCALE_CODES as readonly string[]).includes(value)
}

export function uiLocaleDirection(code: UiLocaleCode): 'ltr' | 'rtl' {
  return RTL_UI_LOCALE_CODES.has(code) ? 'rtl' : 'ltr'
}

export function uiLocaleMeta(code: UiLocaleCode): UiLocaleMeta {
  const match = UI_LOCALES.find((item) => item.code === code)
  if (!match) throw new Error(`Unknown UI locale: ${code}`)
  return match
}

export function uiLocaleHtmlLang(code: UiLocaleCode): string {
  return uiLocaleMeta(code).htmlLang
}

export function uiLocaleOgLocale(code: UiLocaleCode): string {
  return uiLocaleMeta(code).ogLocale
}
