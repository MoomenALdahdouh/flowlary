import type { ContactPageContent, LegalDocumentContent } from './types.ts'
import { privacyEn, termsEn, cookiesEn, contactEn } from './en.ts'
import { privacyAr, termsAr, cookiesAr, contactAr } from './ar.ts'
import type { Locale } from '../../config.ts'

export function legalPrivacy(locale: Locale): LegalDocumentContent {
  return locale === 'ar' ? privacyAr : privacyEn
}

export function legalTerms(locale: Locale): LegalDocumentContent {
  return locale === 'ar' ? termsAr : termsEn
}

export function legalCookies(locale: Locale): LegalDocumentContent {
  return locale === 'ar' ? cookiesAr : cookiesEn
}

export function contactContent(locale: Locale): ContactPageContent {
  return locale === 'ar' ? contactAr : contactEn
}

export function legalLocaleNote(locale: Locale, englishNote: string, arabicNote: string): string | undefined {
  if (locale === 'ar') return arabicNote
  if (locale !== 'en') return englishNote
  return undefined
}
