import { describe, expect, it } from 'vitest'
import { catalogs, isLocaleEnabled } from '../i18n/index.tsx'
import { en } from '../i18n/en.ts'
import { ar } from '../i18n/ar.ts'
import { ru } from '../i18n/ru.ts'
import { fa } from '../i18n/fa.ts'
import { ENABLED_LOCALES } from '../config.ts'

function shape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item && typeof item === 'object' ? shape(item) : typeof item))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, shape(nested)]))
  }
  return typeof value
}

describe('i18n architecture', () => {
  it('ships English as a complete production catalog', () => {
    expect(en.meta.complete).toBe(true)
    expect(en.meta.direction).toBe('ltr')
    expect(isLocaleEnabled('en')).toBe(true)
  })

  it('enables English and Arabic UI locales', () => {
    expect(ENABLED_LOCALES).toEqual(['en', 'ar'])
    expect(isLocaleEnabled('en')).toBe(true)
    expect(isLocaleEnabled('ar')).toBe(true)
    expect(catalogs.en.meta.complete).toBe(true)
    expect(catalogs.ar.meta.complete).toBe(true)
    expect(isLocaleEnabled('ru')).toBe(false)
  })

  it('enables Arabic with a complete RTL catalog', () => {
    expect(ar.meta.complete).toBe(true)
    expect(ar.meta.direction).toBe('rtl')
    expect(isLocaleEnabled('ar')).toBe(true)
    expect(catalogs.ar.brand.name).toBe('Flowlary')
    expect(ar.home.heroTitle).toMatch(/[\u0600-\u06FF]/)
    expect(ar.nav.features).toMatch(/[\u0600-\u06FF]/)
    expect(ar.cta.primary).toMatch(/[\u0600-\u06FF]/)
    expect(ar.featuresPage.journey.learn.title).toMatch(/[\u0600-\u06FF]/)
    expect(ar.pricing.title).toMatch(/[\u0600-\u06FF]/)
    expect(ar.pricing.faq.items.every((item) => /[\u0600-\u06FF]/.test(item.q))).toBe(true)
  })

  it('translates shell UI for additional locales', () => {
    expect(ru.nav.features).toMatch(/[А-Яа-яЁё]/)
    expect(ru.home.heroTitle).toMatch(/[А-Яа-яЁё]/)
    expect(fa.meta.direction).toBe('rtl')
    expect(fa.nav.features).toMatch(/[\u0600-\u06FF]/)
  })

  it('mirrors catalog shape between English and Arabic', () => {
    expect(shape(ar)).toEqual(shape(en))
    expect(Object.keys(ar.nav)).toEqual(Object.keys(en.nav))
    expect(Object.keys(ar.cta)).toEqual(Object.keys(en.cta))
    expect(Object.keys(ar.footer)).toEqual(Object.keys(en.footer))
    expect(Object.keys(ar.a11y)).toEqual(Object.keys(en.a11y))
    expect(Object.keys(ar.legal)).toEqual(Object.keys(en.legal))
  })
})
