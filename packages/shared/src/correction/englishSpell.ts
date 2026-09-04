import {
  ENGLISH_SPELL_RANK,
  englishSpellCandidates,
  isSpellDictionaryWord,
} from './englishLexicon.ts'

const MIN_FUZZY = 4

function applyCase(source: string, replacement: string): string {
  if (replacement.includes(' ')) return replacement
  if (source[0] === source[0]?.toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  }
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase()
  return replacement
}

function isSubsequence(small: string, large: string): boolean {
  let i = 0
  for (const ch of large) {
    if (ch === small[i]) i += 1
    if (i === small.length) return true
  }
  return false
}

/** Damerau–Levenshtein, capped. */
function damerau(left: string, right: string, max: number): number {
  if (left === right) return 0
  const n = left.length
  const m = right.length
  if (Math.abs(n - m) > max) return max + 1
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      let best = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        best = Math.min(best, dp[i - 2]![j - 2]! + 1)
      }
      dp[i]![j] = best
    }
  }
  return dp[n]![m]!
}

type Candidate = { word: string; score: number; rank: number }

const CONS = /[bcdfghjklmnpqrstvwxyz]/
const VOWEL = /[aeiou]/

/** stop, plan, grab — last three letters are consonant-vowel-consonant. */
function isCvcStem(stem: string): boolean {
  if (stem.length < 3) return false
  const a = stem[stem.length - 3]!
  const b = stem[stem.length - 2]!
  const c = stem[stem.length - 1]!
  return CONS.test(a) && VOWEL.test(b) && CONS.test(c) && c !== 'w' && c !== 'x' && c !== 'y'
}

/**
 * stoped → stopped (forgot the doubled consonant). Never maps walked → walkked.
 */
function recoverForgottenDoubling(lower: string): string | null {
  if (lower.length < 6) return null
  for (const suffix of ['ed', 'ing'] as const) {
    if (!lower.endsWith(suffix)) continue
    const stem = lower.slice(0, -suffix.length)
    if (!isSpellDictionaryWord(stem) || !isCvcStem(stem)) continue
    if (lower !== `${stem}${suffix}`) continue
    return `${stem}${stem[stem.length - 1]}${suffix}`
  }
  return null
}

/**
 * Learners often drop letters (manul, testng, setp, guid). Never chop a
 * misspelling down to a shorter real word (stoped → stop, setp → set).
 */
export function correctEnglishToken(token: string): string | null {
  if (!/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(token)) return null
  const lower = token.toLowerCase()
  if (lower.length < MIN_FUZZY) return null
  if (isSpellDictionaryWord(lower)) return null

  const doubled = recoverForgottenDoubling(lower)
  if (doubled) return applyCase(token, doubled)

  const found: Candidate[] = []
  for (const word of englishSpellCandidates()) {
    if (word.length < lower.length) continue
    if (word[0] !== lower[0] && word.length > 3) continue
    if (word.length - lower.length > 2) continue
    const missing = word.length > lower.length && isSubsequence(lower, word)
    const dist = damerau(lower, word, 2)
    let score = 99
    if (missing && word.length - lower.length <= 2) {
      score = word.length - lower.length
    } else if (dist === 1) {
      score = 10 + dist
    } else if (dist === 2 && lower.length >= 6) {
      score = 20 + dist
    }
    if (score >= 99) continue
    found.push({ word, score, rank: ENGLISH_SPELL_RANK.get(word) ?? 9999 })
  }
  if (found.length === 0) return null
  found.sort((a, b) => a.score - b.score || a.rank - b.rank)
  const best = found[0]!
  const rival = found[1]
  if (rival && rival.score === best.score && rival.rank - best.rank < 8 && best.score >= 10) {
    return null
  }
  return applyCase(token, best.word)
}

export function applyDictionarySpelling(text: string): string {
  return text.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (word) => correctEnglishToken(word) ?? word)
}
