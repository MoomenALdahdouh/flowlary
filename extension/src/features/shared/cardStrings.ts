import { readUiLocale } from '../../popup/i18n/localeStorage.ts'
import { en } from '../../popup/i18n/en.ts'
import { ar } from '../../popup/i18n/ar.ts'

export type CardActionStrings = {
  apply: string
  dismiss: string
  clickToAccept: string
  applied: string
  analyzing: string
}

const DEFAULT: CardActionStrings = {
  apply: en.card.apply,
  dismiss: en.card.dismiss,
  clickToAccept: en.card.clickToAccept,
  applied: en.card.applied,
  analyzing: en.card.analyzing,
}

export function resolveCardActionStrings(): CardActionStrings {
  const locale = readUiLocale()
  if (locale === 'ar') {
    return {
      apply: ar.card?.apply ?? DEFAULT.apply,
      dismiss: ar.card?.dismiss ?? DEFAULT.dismiss,
      clickToAccept: ar.card?.clickToAccept ?? DEFAULT.clickToAccept,
      applied: ar.card?.applied ?? DEFAULT.applied,
      analyzing: ar.card?.analyzing ?? DEFAULT.analyzing,
    }
  }
  return DEFAULT
}
