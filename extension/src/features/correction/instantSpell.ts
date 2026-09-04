/**
 * Conservative common English typo map for instant local fixes.
 * 1–2 letter tokens are never auto-applied (ambiguous / layout-collision risk).
 */
import { applyLocalEnglishRepair, lookupKnownTypo, MIN_AUTO_SPELL_CHARS } from '@flowlary/shared'
import { isSafeToken } from '../../core/safety/tokenKind.ts'
import { analyzeFieldText } from '../../core/engine/chunks.ts'

export { lookupKnownTypo, MIN_AUTO_SPELL_CHARS }

export function isAutoSpellCandidate(token: string): boolean {
  if (!lookupKnownTypo(token)) return false
  if ([...token].length < MIN_AUTO_SPELL_CHARS) return false
  if (!isSafeToken(token)) return false
  return true
}

export function applyInstantSpelling(text: string): string {
  if (!text) return text
  const trailingIncomplete = /[A-Za-z]+(?:'[A-Za-z]+)?$/.test(text) && !/[ \t\n.!?,;:]$/.test(text)
  let cut = text.length
  if (trailingIncomplete) {
    const m = text.match(/^(.*?)([A-Za-z]+(?:'[A-Za-z]+)?)$/)
    if (m) {
      const last = m[2]!
      if (!isAutoSpellCandidate(last)) {
        cut = m[1]!.length
      }
    }
  }
  return applyLocalEnglishRepair(text.slice(0, cut)) + text.slice(cut)
}

/** Never apply instant English spelling on text that looks like a layout mismatch. */
export function applyInstantSpellingIfSafe(text: string): string {
  if (!text) return text
  const analysis = analyzeFieldText(text)
  if (analysis.hasLayoutSuspicion) return text
  return applyInstantSpelling(text)
}

/** After an idle pause the last word is finished — include it (now → know). */
export function applyIdleEnglishRepair(text: string): string {
  if (!text) return text
  const analysis = analyzeFieldText(text)
  if (analysis.hasLayoutSuspicion) return text
  return applyLocalEnglishRepair(text)
}
