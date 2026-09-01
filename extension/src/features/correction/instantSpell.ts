/**
 * Conservative common English typo map for instant local fixes.
 * 1–2 letter tokens are never auto-applied (ambiguous / layout-collision risk).
 */
import { isSafeToken } from '../../core/safety/tokenKind.ts'
import { analyzeFieldText } from '../../core/engine/chunks.ts'

const COMMON_TYPOS: Record<string, string> = {
  hwo: 'how',
  yuo: 'you',
  yuor: 'your',
  teh: 'the',
  adn: 'and',
  nad: 'and',
  taht: 'that',
  waht: 'what',
  whihc: 'which',
  wiht: 'with',
  tehse: 'these',
  thier: 'their',
  recive: 'receive',
  recieve: 'receive',
  seperate: 'separate',
  definately: 'definitely',
  occured: 'occurred',
  untill: 'until',
  becuase: 'because',
  beacuse: 'because',
  freind: 'friend',
  wierd: 'weird',
  alot: 'a lot',
  dont: "don't",
  doesnt: "doesn't",
  cant: "can't",
  wont: "won't",
  isnt: "isn't",
  wasnt: "wasn't",
  arent: "aren't",
  didnt: "didn't",
  havent: "haven't",
  hasnt: "hasn't",
  ive: "I've",
  youre: "you're",
  theyre: "they're",
  weve: "we've",
}

/** Tokens shorter than this MUST NOT auto-replace (`fo`, `ot`, `im`, …). */
export const MIN_AUTO_SPELL_CHARS = 3

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)?/g

export function lookupKnownTypo(token: string): string | null {
  const key = token.toLowerCase()
  return COMMON_TYPOS[key] ?? null
}

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
  const head = text.slice(0, cut)
  const tail = text.slice(cut)
  const fixedHead = head.replace(WORD_RE, (word) => {
    if (!isAutoSpellCandidate(word)) return word
    const repl = COMMON_TYPOS[word.toLowerCase()]!
    if (word[0] === word[0]!.toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
      return repl.charAt(0).toUpperCase() + repl.slice(1)
    }
    if (word === word.toUpperCase() && word.length > 1) return repl.toUpperCase()
    return repl
  })
  return fixedHead + tail
}

/** Never apply instant English spelling on text that looks like a layout mismatch. */
export function applyInstantSpellingIfSafe(text: string): string {
  if (!text) return text
  const analysis = analyzeFieldText(text)
  if (analysis.hasLayoutSuspicion) return text
  return applyInstantSpelling(text)
}
