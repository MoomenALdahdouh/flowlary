import { STORAGE_KEYS, uiLocaleDirection, uiLocaleHtmlLang, type UiLocaleCode } from '@flowlary/shared'
import { readUiLocale } from '../../popup/i18n/localeStorage.ts'

export type SpeedBoxStrings = {
  title: string
  modeAria: string
  layout: string
  translate: string
  fix: string
  sourceLayout: string
  targetLayout: string
  swapLayouts: string
  sourceLanguage: string
  targetLanguage: string
  swapLanguages: string
  placeholder: string
  apply: string
  clickToCopy: string
  enterToInsert: string
  copied: string
  applied: string
  converted: string
  translated: string
  fixed: string
  looksGood: string
  conversionUnavailable: string
  error: (code: string, localApi?: boolean) => string
}

const EN: SpeedBoxStrings = {
  title: 'Speed Box',
  modeAria: 'Mode',
  layout: 'Layout',
  translate: 'Translate',
  fix: 'Fix',
  sourceLayout: 'Source keyboard layout',
  targetLayout: 'Target keyboard layout',
  swapLayouts: 'Swap layouts',
  sourceLanguage: 'Source language',
  targetLanguage: 'Target language',
  swapLanguages: 'Swap languages',
  placeholder: 'Type or paste…',
  apply: 'Apply',
  clickToCopy: 'Click to copy',
  enterToInsert: 'Enter to insert',
  copied: 'Copied',
  applied: 'Applied.',
  converted: 'Converted.',
  translated: 'Translated.',
  fixed: 'Fixed.',
  looksGood: 'Looks good.',
  conversionUnavailable: 'Conversion unavailable for this layout pair.',
  error: (code, localApi) => englishError(code, localApi),
}

const AR: SpeedBoxStrings = {
  title: 'صندوق السرعة',
  modeAria: 'الوضع',
  layout: 'تخطيط',
  translate: 'ترجمة',
  fix: 'تصحيح',
  sourceLayout: 'تخطيط لوحة المصدر',
  targetLayout: 'تخطيط لوحة الهدف',
  swapLayouts: 'تبديل التخطيطين',
  sourceLanguage: 'لغة المصدر',
  targetLanguage: 'لغة الهدف',
  swapLanguages: 'تبديل اللغتين',
  placeholder: 'اكتب أو الصق…',
  apply: 'تطبيق',
  clickToCopy: 'انقر للنسخ',
  enterToInsert: 'Enter للإدراج',
  copied: 'تم النسخ',
  applied: 'تم التطبيق.',
  converted: 'تم التحويل.',
  translated: 'تمت الترجمة.',
  fixed: 'تم التصحيح.',
  looksGood: 'النص سليم.',
  conversionUnavailable: 'التحويل غير متاح لهذا الزوج من التخطيطات.',
  error: (code, localApi) => arabicError(code, localApi),
}

function englishError(code: string, localApi?: boolean): string {
  switch (code) {
    case 'usage_exhausted':
    case 'entitlement_denied':
    case 'AI_ENTITLEMENT_DENIED':
      return "Today's AI checks are used up."
    case 'account_required':
      return 'Sign in to use AI.'
    case 'auth_failed':
      return 'Sign in again in Flowlary.'
    case 'consent_required':
      return 'Enable Flowlary AI in settings.'
    case 'disabled':
      return 'Turn this on in Flowlary settings.'
    case 'same-language':
      return 'Pick two different languages.'
    case 'extension_disconnected':
      return 'Reload the extension, then try again.'
    case 'too-long':
    case 'empty':
      return 'Add some text.'
    case 'translation_unavailable':
    case 'network':
    case 'upstream':
      return localApi ? 'Local API not running.' : 'Flowlary AI unavailable. Try again.'
    case 'AI_UNAVAILABLE':
    case 'AI_PROVIDER_ERROR':
    case 'AI_TIMEOUT':
      return 'AI unavailable. Try again.'
    case 'rate_limited':
    case 'AI_RATE_LIMITED':
    case 'rate-limited':
      return 'Too many requests. Wait a moment.'
    default:
      return 'Something went wrong.'
  }
}

function arabicError(code: string, localApi?: boolean): string {
  switch (code) {
    case 'usage_exhausted':
    case 'entitlement_denied':
    case 'AI_ENTITLEMENT_DENIED':
      return 'فحوصات الذكاء الاصطناعي لليوم انتهت.'
    case 'account_required':
      return 'سجّل الدخول لاستخدام الذكاء الاصطناعي.'
    case 'auth_failed':
      return 'سجّل الدخول مرة أخرى في فلوولاري.'
    case 'consent_required':
      return 'فعّل ذكاء فلوولاري من الإعدادات.'
    case 'disabled':
      return 'فعّل هذه الأداة من إعدادات فلوولاري.'
    case 'same-language':
      return 'اختر لغتين مختلفتين.'
    case 'extension_disconnected':
      return 'أعد تحميل الإضافة ثم حاول مرة أخرى.'
    case 'too-long':
    case 'empty':
      return 'أضف بعض النص.'
    case 'translation_unavailable':
    case 'network':
    case 'upstream':
      return localApi ? 'واجهة البرمجة المحلية غير شغّالة.' : 'ذكاء فلوولاري غير متاح. حاول مرة أخرى.'
    case 'AI_UNAVAILABLE':
    case 'AI_PROVIDER_ERROR':
    case 'AI_TIMEOUT':
      return 'الذكاء الاصطناعي غير متاح. حاول مرة أخرى.'
    case 'rate_limited':
    case 'AI_RATE_LIMITED':
    case 'rate-limited':
      return 'طلبات كثيرة. انتظر لحظة.'
    default:
      return 'حدث خطأ ما.'
  }
}

let cachedLocale: UiLocaleCode = 'en'
let cachedStrings: SpeedBoxStrings = EN

export function getSpeedBoxLocale(): UiLocaleCode {
  return cachedLocale
}

export function getSpeedBoxStrings(): SpeedBoxStrings {
  return cachedStrings
}

function catalogFor(locale: UiLocaleCode): SpeedBoxStrings {
  return locale === 'ar' ? AR : EN
}

export function applySpeedBoxLocale(locale: UiLocaleCode): SpeedBoxStrings {
  cachedLocale = locale
  cachedStrings = catalogFor(locale)
  return cachedStrings
}

export async function loadSpeedBoxStrings(): Promise<SpeedBoxStrings> {
  const locale = await readUiLocale()
  return applySpeedBoxLocale(locale)
}

export function resetSpeedBoxStringCache(): void {
  cachedLocale = 'en'
  cachedStrings = EN
}

export function speedBoxDir(): 'ltr' | 'rtl' {
  return uiLocaleDirection(cachedLocale)
}

export function speedBoxLang(): string {
  return uiLocaleHtmlLang(cachedLocale)
}

export function isSpeedBoxLocaleStorageKey(key: string | null): boolean {
  return key === STORAGE_KEYS.uiLocale || key === null
}
