/**
 * Known-typo lookup plus conservative edit-distance against the English lexicon.
 * Does not carry a hand-picked example word list.
 */
import { lookupKnownTypo } from '../../features/correction/instantSpell.ts'
import { englishLexiconCandidates, isEnglishWord } from '../../features/layout/layouts/lexicons/en-words.ts'

function editDistance(left: string, right: string): number {
  if (left === right) return 0
  if (Math.abs(left.length - right.length) > 1) return 99
  const rows = left.length + 1
  const cols = right.length + 1
  const grid: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = Array.from({ length: cols }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
    return row
  })
  for (let i = 1; i < rows; i += 1) {
    const prev = grid[i - 1]!
    const cur = grid[i]!
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
    }
  }
  return grid[left.length]![right.length]!
}

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

  const lower = token.toLocaleLowerCase()
  if (lower.length < 4 || isEnglishWord(lower)) return null
  if (!/^[A-Za-z']+$/.test(token)) return null

  const neighborEnglish = previousToken ? isEnglishWord(previousToken) : false
  if (!neighborEnglish && previousToken.length > 0 && /[A-Za-z]/.test(previousToken) === false) {
    return null
  }

  let best: { word: string; distance: number } | null = null
  for (const word of englishLexiconCandidates()) {
    if (Math.abs(word.length - lower.length) > 1) continue
    if (word[0] !== lower[0] && word.length > 4) continue
    const distance = editDistance(lower, word)
    if (distance !== 1) continue
    if (!best || distance < best.distance) best = { word, distance }
  }
  if (!best) return null
  return {
    replacement: applyCase(token, best.word),
    source: 'contextual_spell',
    distance: best.distance,
  }
}
