import { isEnglishWord } from '../../features/layout/layouts/lexicons/en-words.ts'

/**
 * Conservative Arabizi hypothesis.
 * Digit-substitution (2/5/7/9 inside letters) only.
 * Isolated leetspeak and trailing-digit identifiers are not Arabizi.
 * Digit-less transliteration is unknown, not a closed word list.
 */
export function looksLikeArabizi(token: string): boolean {
  if (!token || !/^[A-Za-z0-9]+$/.test(token)) return false
  const lower = token.toLocaleLowerCase()
  if (isEnglishWord(lower)) return false
  if (/^[a-z]+\d+$/i.test(token)) return false
  if (/^\d+$/.test(token)) return false
  const marks = lower.match(/[2579]/g)?.length ?? 0
  const threes = lower.match(/3/g)?.length ?? 0
  if (marks === 0) return false
  if (/[a-z][2579][a-z0-9]/i.test(token) || /[2579][a-z]/i.test(token)) return true
  return marks + threes >= 2
}
