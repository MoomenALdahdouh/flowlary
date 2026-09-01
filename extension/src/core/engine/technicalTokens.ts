/**
 * Structural / contextual technical-token evidence.
 * Not a closed vocabulary of product words.
 */
const ALL_CAPS = /^[A-Z]{2,8}$/
const CAMEL = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/
const PASCAL = /^[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*$/
const SNAKE = /^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+$/
const SLASH_STACK = /^[A-Za-z]{1,5}\/[A-Za-z]{1,5}$/
const LOCALHOST = /^localhost(?::\d+)?$/i
const VERSIONISH = /^(?:v)?\d+[A-Za-z0-9._-]+$|^[A-Za-z]+[._-]\d+[A-Za-z0-9._-]*$/
const FILE_EXT = /\.(?:js|ts|tsx|jsx|py|rb|go|rs|java|kt|cs|php|json|ya?ml|toml|md|sh)$/i

export function isStructuralTechnicalToken(token: string): boolean {
  const value = token.trim()
  if (!value) return false
  if (ALL_CAPS.test(value)) return true
  if (CAMEL.test(value) || PASCAL.test(value) || SNAKE.test(value)) return true
  if (SLASH_STACK.test(value)) return true
  if (LOCALHOST.test(value)) return true
  if (VERSIONISH.test(value)) return true
  if (FILE_EXT.test(value)) return true
  return false
}

export function isTechnicalToken(token: string): boolean {
  return isStructuralTechnicalToken(token)
}

export function isPlausibleEnglishTarget(token: string, isEnglishWord: (word: string) => boolean): boolean {
  return isEnglishWord(token) || isStructuralTechnicalToken(token)
}

export function looksLikeIntentionalLatinInArabic(
  token: string,
  hasArabicNeighbor: boolean,
  layoutArabicScore: number,
): boolean {
  if (!hasArabicNeighbor) return false
  if (!/^[A-Za-z][A-Za-z0-9/+._-]*$/.test(token)) return false
  if (isStructuralTechnicalToken(token)) return true
  return layoutArabicScore < 0.35
}

/** Two or three Latin letters beside another short Latin token. */
export function isPairedShortLatinToken(token: string, neighbors: string[]): boolean {
  if (!/^[A-Za-z]{2}$/.test(token)) return false
  return neighbors.some((item) => /^[A-Za-z]{2}$/.test(item))
}

/** Title-case Latin word: evidence of a name/product, not a layout error. */
export function looksLikeTitleCaseToken(token: string): boolean {
  return /^[A-Z][a-z]{3,}$/.test(token)
}
