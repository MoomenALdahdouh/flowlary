import type { UiLocaleCode } from '@flowlary/shared'
import { en, ar, tr, ru, de, fr, el, es, it, pt, uk, fa } from '../../../popup/i18n/index.ts'
import type { MessageCatalog } from '../../../popup/i18n/types.ts'
import {
  CORRECTION_EXPLAIN_STRINGS,
  type CorrectionExplainStrings,
} from './explanationStrings.ts'

const LOCALE_CATALOGS: Record<UiLocaleCode, MessageCatalog> = {
  en,
  ar,
  tr,
  ru,
  de,
  fr,
  el,
  es,
  it,
  pt,
  uk,
  fa,
}

function pickCorrectionExplain(catalog: MessageCatalog): CorrectionExplainStrings {
  const copy = catalog.correctionExplain
  if (!copy) return CORRECTION_EXPLAIN_STRINGS
  return {
    explain: copy.explain ?? CORRECTION_EXPLAIN_STRINGS.explain,
    explainAria: copy.explainAria ?? CORRECTION_EXPLAIN_STRINGS.explainAria,
    whyTitle: copy.whyTitle ?? CORRECTION_EXPLAIN_STRINGS.whyTitle,
    youWrote: copy.youWrote ?? CORRECTION_EXPLAIN_STRINGS.youWrote,
    suggested: copy.suggested ?? CORRECTION_EXPLAIN_STRINGS.suggested,
    why: copy.why ?? CORRECTION_EXPLAIN_STRINGS.why,
    rule: copy.rule ?? CORRECTION_EXPLAIN_STRINGS.rule,
    example: copy.example ?? CORRECTION_EXPLAIN_STRINGS.example,
    practiceThis: copy.practiceThis ?? CORRECTION_EXPLAIN_STRINGS.practiceThis,
    close: copy.close ?? CORRECTION_EXPLAIN_STRINGS.close,
    closeAria: copy.closeAria ?? CORRECTION_EXPLAIN_STRINGS.closeAria,
    unavailable: copy.unavailable ?? CORRECTION_EXPLAIN_STRINGS.unavailable,
    changeLabel: copy.changeLabel ?? CORRECTION_EXPLAIN_STRINGS.changeLabel,
  }
}

export function resolveCorrectionExplainStrings(locale: UiLocaleCode): CorrectionExplainStrings {
  return pickCorrectionExplain(LOCALE_CATALOGS[locale] ?? en)
}
