import type { Locale } from '../../../config.ts'

export function formatBlogDate(isoDate: string, locale: Locale): string {
  const date = new Date(`${isoDate}T12:00:00`)
  const tag = locale === 'ar' ? 'ar' : 'en-GB'
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}
