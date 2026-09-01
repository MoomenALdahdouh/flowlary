/** Content-script correction explain UI strings (English baseline; WL-4C-F localizes). */
import type { UiLocaleCode } from '@flowlary/shared'
import { readUiLocale } from '../../../popup/i18n/localeStorage.ts'
import { resolveCorrectionExplainStrings } from './localeCatalog.ts'

export type CorrectionExplainStrings = {
  explain: string
  explainAria: string
  whyTitle: string
  youWrote: string
  suggested: string
  why: string
  rule: string
  example: string
  practiceThis: string
  close: string
  closeAria: string
  unavailable: string
  changeLabel: string
}

export const CORRECTION_EXPLAIN_STRINGS: CorrectionExplainStrings = {
  explain: 'Explain',
  explainAria: 'Explain why this was corrected',
  whyTitle: 'Why was this changed?',
  youWrote: 'You wrote',
  suggested: 'Suggested',
  why: 'Why',
  rule: 'Rule',
  example: 'Example',
  practiceThis: 'Practice this',
  close: 'Close',
  closeAria: 'Close explanation',
  unavailable: 'Explanation is not available for this correction.',
  changeLabel: 'Change',
}

let cachedLocale: UiLocaleCode | null = null
let cachedStrings: CorrectionExplainStrings = CORRECTION_EXPLAIN_STRINGS

export function getCorrectionExplainStrings(): CorrectionExplainStrings {
  return cachedStrings
}

export async function loadCorrectionExplainStrings(): Promise<CorrectionExplainStrings> {
  const locale = await readUiLocale()
  if (locale === cachedLocale) return cachedStrings
  cachedLocale = locale
  cachedStrings = resolveCorrectionExplainStrings(locale)
  return cachedStrings
}

/** Test helper — reset module cache between tests. */
export function resetCorrectionExplainStringCache(): void {
  cachedLocale = null
  cachedStrings = CORRECTION_EXPLAIN_STRINGS
}
