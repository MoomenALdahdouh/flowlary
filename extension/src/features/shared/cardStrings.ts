import { peekUiLocale } from '../../popup/i18n/localeStorage.ts'
import { en } from '../../popup/i18n/en.ts'
import { ar } from '../../popup/i18n/ar.ts'

export type CardActionStrings = {
  apply: string
  dismiss: string
  clickToAccept: string
  applied: string
  analyzing: string
  spelling: string
  grammar: string
  wording: string
  layout: string
}

const DEFAULT: CardActionStrings = {
  apply: en.card.apply,
  dismiss: en.card.dismiss,
  clickToAccept: en.card.clickToAccept,
  applied: en.card.applied,
  analyzing: en.card.analyzing,
  spelling: en.learning.focus.spelling,
  grammar: en.learning.focus.grammar,
  wording: en.learning.focus.wording,
  layout: en.features.layout,
}

export function resolveCardActionStrings(): CardActionStrings {
  const locale = peekUiLocale()
  if (locale === 'ar') {
    return {
      apply: ar.card?.apply ?? DEFAULT.apply,
      dismiss: ar.card?.dismiss ?? DEFAULT.dismiss,
      clickToAccept: ar.card?.clickToAccept ?? DEFAULT.clickToAccept,
      applied: ar.card?.applied ?? DEFAULT.applied,
      analyzing: ar.card?.analyzing ?? DEFAULT.analyzing,
      spelling: ar.learning?.focus?.spelling ?? DEFAULT.spelling,
      grammar: ar.learning?.focus?.grammar ?? DEFAULT.grammar,
      wording: ar.learning?.focus?.wording ?? DEFAULT.wording,
      layout: ar.features?.layout ?? DEFAULT.layout,
    }
  }
  return DEFAULT
}
