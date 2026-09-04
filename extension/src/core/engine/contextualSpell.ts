/**
 * Known-typo lookup plus dictionary edit-distance (shared local English repair).
 */
import { correctEnglishToken, lookupKnownTypo } from '@flowlary/shared'
import { isEnglishWord } from '../../features/layout/layouts/lexicons/en-words.ts'

function applyCase(source: string, replacement: string): string {
  if (source[0] === source[0]?.toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  }
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase()
  return replacement
}

export function suggestSpelling(
  token: string,
  previousToken = '',
): { replacement: string; source: 'instant_spell' | 'contextual_spell'; distance: number } | null {
  const known = lookupKnownTypo(token)
  if (known) return { replacement: applyCase(token, known), source: 'instant_spell', distance: 1 }

  if (previousToken.length > 0 && /[A-Za-z]/.test(previousToken) === false) {
    return null
  }

  const lower = token.toLocaleLowerCase()
  if (lower.length < 4 || isEnglishWord(lower)) return null
  const fuzzy = correctEnglishToken(token)
  if (!fuzzy || fuzzy.toLowerCase() === lower) return null
  return { replacement: fuzzy, source: 'contextual_spell', distance: 1 }
}
