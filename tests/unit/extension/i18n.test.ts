import { describe, expect, it } from 'vitest'
import { LANGUAGE_CAPABILITIES, supportsCorrection, supportsTranslation } from '@flowlary/shared'
import { resolveMessage } from '../../../extension/src/popup/i18n/I18nProvider.tsx'
import { localeDirection } from '../../../extension/src/popup/i18n/types.ts'
import { deepMerge } from '../../../extension/src/popup/i18n/merge.ts'
import { en } from '../../../extension/src/popup/i18n/en.ts'

describe('language capabilities', () => {
  it('english supports correction and translation', () => {
    expect(supportsCorrection('en')).toBe(true)
    expect(supportsTranslation('en')).toBe(true)
  })

  it('arabic supports translation only', () => {
    expect(supportsCorrection('ar')).toBe(false)
    expect(supportsTranslation('ar')).toBe(true)
    expect(LANGUAGE_CAPABILITIES.ar?.learning).toBe(false)
  })
})

describe('extension i18n', () => {
  it('falls back to English for missing Arabic keys', () => {
    expect(resolveMessage('progress.summary', 'ar')).toBe('الملخص')
    expect(resolveMessage('progress.byType', 'ar')).toBe(en.progress.byType)
  })

  it('returns key path when missing in all catalogs in production-safe way', () => {
    expect(resolveMessage('nonexistent.key', 'en')).toBe('nonexistent.key')
  })

  it('locale direction is rtl for Arabic', () => {
    expect(localeDirection('ar')).toBe('rtl')
    expect(localeDirection('en')).toBe('ltr')
  })

  it('deepMerge preserves untranslated nested keys', () => {
    const merged = deepMerge(en, { nav: { home: 'الرئيسية' } } as typeof en)
    expect(merged.nav.home).toBe('الرئيسية')
    expect(merged.nav.practice).toBe('Practice')
  })
})
