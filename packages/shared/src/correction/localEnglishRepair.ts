import { correctEnglishToken } from './englishSpell.ts'
import { isSpellDictionaryWord } from './englishLexicon.ts'

export const MIN_AUTO_SPELL_CHARS = 3

/** Conservative learner typos — never 1–2 letter tokens. */
export const COMMON_ENGLISH_TYPOS: Record<string, string> = {
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
  im: "I'm",
  thats: "that's",
  whats: "what's",
  youre: "you're",
  theyre: "they're",
  weve: "we've",
  nee: 'need',
  hel: 'help',
  pleas: 'please',
  comming: 'coming',
  tommorow: 'tomorrow',
  tomorow: 'tomorrow',
  recieved: 'received',
  mesage: 'message',
  colord: 'color',
  evrywhere: 'everywhere',
  dashbaord: 'dashboard',
  feture: 'feature',
  werite: 'write',
  nigth: 'night',
  bech: 'beach',
  realy: 'really',
  coplete: 'complete',
  complet: 'complete',
  stoped: 'stopped',
  stope: 'stopped',
}

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)?/g
const ARABIC = /[\u0600-\u06FF]/
const HAS_TERMINAL = /[.!?…؟]$/
const OPEN_TAIL =
  /\b(and|or|but|if|because|so|that|when|while|to|a|an|the|my|your|our|their|with|for|of|in|on|at)\s*$/i
const BARE_QUESTION =
  /^(how|what|why|when|where|who|which|whose|is|are|am|do|does|did|can|could|would|will|have|has|was|were)\b/i
const GREETING = /^(hi|hello|hey|yo)[,!]?\s+/i
const EXCLAIM = /^(wow|yay|oops|ouch|hooray|amazing)\b/i

export function lookupKnownTypo(token: string): string | null {
  return COMMON_ENGLISH_TYPOS[token.toLowerCase()] ?? null
}

function applyCase(source: string, replacement: string): string {
  if (replacement.includes(' ')) return replacement
  if (source[0] === source[0]?.toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  }
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase()
  return replacement
}

function replaceKnownTypos(text: string): string {
  return text.replace(WORD_RE, (word) => {
    if (word.length < MIN_AUTO_SPELL_CHARS) return word
    const known = lookupKnownTypo(word)
    if (known) return applyCase(word, known)
    const repl = correctEnglishToken(word)
    if (!repl) return word
    return applyCase(word, repl)
  })
}

function applyPhraseCase(matched: string, replacement: string): string {
  if (matched === matched.toUpperCase() && matched.length > 1) return replacement.toUpperCase()
  if (matched[0] && matched[0] === matched[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  }
  return replacement
}

/**
 * Real-word learner mistakes a spellchecker will not flag (now/know, gonna).
 * Never rewrite a lone "now" — only the phrases English speakers actually mean.
 */
const PHRASE_REPAIRS: Array<[RegExp, string]> = [
  [/\blet me now\b/gi, 'let me know'],
  [/\blet you now\b/gi, 'let you know'],
  [/\blet us now\b/gi, 'let us know'],
  [/\blet him now\b/gi, 'let him know'],
  [/\blet her now\b/gi, 'let her know'],
  [/\blet them now\b/gi, 'let them know'],
  [/\blemme now\b/gi, 'let me know'],
  [/\bi don't no\b/gi, "I don't know"],
  [/\bi dont no\b/gi, "I don't know"],
  [/\bi dunno\b/gi, "I don't know"],
  [/\bdunno\b/gi, "don't know"],
  [/\bdo you no\b/gi, 'do you know'],
  [/\bdid you no\b/gi, 'did you know'],
  [/\bi no (how|why|that|if|what)\b/gi, 'I know $1'],
  [/\byour welcome\b/gi, "you're welcome"],
  [/\bgonna\b/gi, 'going to'],
  [/\bwanna\b/gi, 'want to'],
  [/\bgotta\b/gi, 'have to'],
  [/\blemme\b/gi, 'let me'],
  [/\bgimme\b/gi, 'give me'],
  [/\bkinda\b/gi, 'kind of'],
  [/\bsorta\b/gi, 'sort of'],
  [/\bcuz\b/gi, 'because'],
  [/\bpls\b/gi, 'please'],
  [/\bplz\b/gi, 'please'],
  [/\bthx\b/gi, 'thanks'],
  [/\bhow r u\b/gi, 'how are you'],
  [/\bhow r you\b/gi, 'how are you'],
  [/\b(are|were)\s+stop(?:e|ed)?\b/gi, '$1 stopped'],
]

function restoreShortContractions(text: string): string {
  if (wordCount(text) < 3) return text
  return text.replace(/\bim\b/g, "I'm")
}

function applyPhraseRepairs(text: string): string {
  let next = text
  for (const [pattern, replacement] of PHRASE_REPAIRS) {
    next = next.replace(pattern, (matched, group1) => {
      const rebuilt =
        replacement.includes('$1') && typeof group1 === 'string'
          ? replacement.replace('$1', group1)
          : replacement
      return applyPhraseCase(matched, rebuilt)
    })
  }
  return next
}

/** "hell how are you" is a greeting, not the noun hell. */
export function applyGreetingRepair(text: string): string {
  return text.replace(/\bhell(\s+)(?=how\b|there\b)/gi, (_full, space: string, offset: number) => {
    const original = text.slice(offset, offset + 4)
    const hello = original[0] === 'H' ? 'Hello' : 'hello'
    return hello + space
  })
}

function wordCount(text: string): number {
  return (text.trim().match(WORD_RE) ?? []).length
}

function lastSentence(text: string): string {
  const parts = text.split(/(?<=[.!?…؟])\s+/)
  return (parts[parts.length - 1] ?? text).trim()
}

function looksLikeQuestion(sentence: string): boolean {
  const t = sentence.trim()
  if (wordCount(t) < 3) return false
  if (OPEN_TAIL.test(t)) return false
  if (BARE_QUESTION.test(t)) return true
  const greeting = t.match(GREETING)
  if (greeting) {
    const rest = t.slice(greeting[0].length)
    if (OPEN_TAIL.test(rest) || /\b(if|because|but)\b/i.test(rest)) return false
    if (BARE_QUESTION.test(rest) || /^(how are you|how's it going|what's up|how is it going)\b/i.test(rest)) {
      return true
    }
  }
  return /\b(are you|do you|can you|will you|did you|have you|is it|isn't it)\b[^?]*$/i.test(t)
}

function looksLikeExclamation(sentence: string): boolean {
  const t = sentence.trim()
  return EXCLAIM.test(t) && wordCount(t) <= 6
}

function splitStackedQuestions(text: string): string {
  return text.replace(
    /\b(how are you|how is it going|how's it going)\s+(are you|do you|can you|will you)\b/gi,
    (_full, first: string, second: string) =>
      `${first}? ${second.charAt(0).toUpperCase()}${second.slice(1)}`,
  )
}

/** "Are you coming or not let me know" → two native sentences. */
function splitOrNotFollowup(text: string): string {
  return text.replace(
    /\b(or not)\s+(let me|tell me|please|thanks|thank you|i\b|i'll|i am)\b/gi,
    (_full, orNot: string, next: string) =>
      `${orNot}? ${next.charAt(0).toUpperCase()}${next.slice(1)}`,
  )
}

function restorePronounI(text: string): string {
  return text.replace(/\bi\b/g, 'I')
}

function capitalizeSentences(text: string): string {
  const withOpenQuotes = text.replace(/"([a-z])/g, (full, letter: string, offset: number) => {
    const quoteCountBefore = (text.slice(0, offset).match(/"/g) ?? []).length
    if (quoteCountBefore % 2 === 1) return full
    const firstWord = text.slice(offset + 1).match(/^[A-Za-z']+/)?.[0] ?? ''
    if (firstWord.length < 3 && firstWord.toLowerCase() !== 'i' && firstWord.toLowerCase() !== 'hi') {
      return full
    }
    return `"${letter.toUpperCase()}`
  })
  return withOpenQuotes.replace(/(^|[.!?…؟]\s+)([a-z])/g, (full, prefix: string, letter: string, offset: number) => {
    const firstWord = withOpenQuotes.slice(offset + String(prefix).length).match(/^[A-Za-z']+/)?.[0] ?? ''
    if (firstWord.length < 3 && firstWord.toLowerCase() !== 'i' && firstWord.toLowerCase() !== 'hi') {
      return full
    }
    return prefix + letter.toUpperCase()
  })
}

function greetingComma(text: string): string {
  return text.replace(/\b(Hello|Hi|Hey) (how|what|are|is|do)\b/g, '$1, $2')
}

const SPEECH_VERB_QUOTE = /\b(said|asked|replied|answered|whispered|shouted|yelled|explained|added|wrote) (?=")/gi

function commaBeforeSpeechQuotes(text: string): string {
  return text.replace(SPEECH_VERB_QUOTE, '$1, ')
}

function normalizeDoubleSingleQuotes(text: string): string {
  return text.replace(/''([^'\n]{1,200})''/g, '"$1"')
}

/** Close an unmatched " after a finished sentence: He said, "Hello. → He said, "Hello." */
function closeUnmatchedQuotes(text: string): string {
  const count = (text.match(/"/g) ?? []).length
  if (count % 2 !== 1) return text
  const trimmed = text.trimEnd()
  if (!HAS_TERMINAL.test(trimmed) || trimmed.endsWith('"')) return text
  return `${trimmed}"${text.slice(trimmed.length)}`
}

function quoteFirstPersonAfterSpeech(text: string): string {
  return text.replace(
    /\b(said|asked|replied|whispered|shouted|yelled)(?:,)?\s+(I(?:'m| am)\b[^"\n]*?)([.!?])(\s*)$/gi,
    (full, verb: string, speech: string, punct: string, tail: string) => {
      if (speech.includes('"')) return full
      if (speech.trim().split(/\s+/).length > 12) return full
      return `${verb}, "${speech}${punct}"${tail}`
    },
  )
}

function applyQuotationMechanics(text: string): string {
  if (!text.trim() || ARABIC.test(text)) return text
  return closeUnmatchedQuotes(
    quoteFirstPersonAfterSpeech(commaBeforeSpeechQuotes(text)),
  )
}

function applyTerminalPunctuation(text: string): string {
  const trimmed = text.trimEnd()
  if (!trimmed || HAS_TERMINAL.test(trimmed) || OPEN_TAIL.test(trimmed)) return text
  if (wordCount(trimmed) < 3) return text
  const trailing = text.slice(trimmed.length)
  if (trailing) return text
  const sentence = lastSentence(trimmed)
  let mark = ''
  if (looksLikeQuestion(sentence) || /\bor not\s*$/i.test(sentence)) mark = '?'
  else if (looksLikeExclamation(sentence)) mark = '!'
  else if (wordCount(sentence) >= 3 && /[a-zA-Z]/.test(sentence)) mark = '.'
  if (!mark) return text
  const evenQuotes = (trimmed.match(/"/g) ?? []).length % 2 === 0
  if (evenQuotes && /[a-zA-Z']"$/.test(trimmed)) {
    return `${trimmed.slice(0, -1)}${mark}"`
  }
  return `${trimmed}${mark}`
}

/** Capital letters, I, and ? / ! / . for finished English sentences. */
export function applySentenceMechanics(text: string): string {
  if (!text.trim() || ARABIC.test(text)) return text
  if (/^(https?:\/\/|www\.|@|#)/i.test(text.trim())) return text
  const stacked = splitOrNotFollowup(splitStackedQuestions(restorePronounI(text)))
  return applyTerminalPunctuation(greetingComma(capitalizeSentences(stacked)))
}

const KNOWN_CONTRACTIONS = new Set([
  "i'm",
  "i've",
  "i'd",
  "i'll",
  "you're",
  "we're",
  "they're",
  "don't",
  "doesn't",
  "didn't",
  "can't",
  "won't",
  "isn't",
  "aren't",
  "wasn't",
  "haven't",
  "hasn't",
  "that's",
  "what's",
  "let's",
])

function isKnownEnglishToken(token: string): boolean {
  const lower = token.toLowerCase()
  if (lower === 'i' || lower === 'a') return true
  if (KNOWN_CONTRACTIONS.has(lower)) return true
  return isSpellDictionaryWord(lower)
}

/**
 * Local repair is only safe to show as a teacher card when every word is real
 * English. "Complet where you are stop" must not be presented as a finished fix.
 */
export function isCredibleLocalEnglish(text: string): boolean {
  if (!text.trim() || ARABIC.test(text)) return false
  const tokens = text.match(WORD_RE) ?? []
  if (tokens.length === 0) return false
  return tokens.every((token) => isKnownEnglishToken(token))
}

export function applyLocalEnglishRepair(text: string): string {
  if (!text) return text
  const spelled = restoreShortContractions(
    applyPhraseRepairs(applyGreetingRepair(replaceKnownTypos(text))),
  )
  return applyQuotationMechanics(applySentenceMechanics(normalizeDoubleSingleQuotes(spelled)))
}
