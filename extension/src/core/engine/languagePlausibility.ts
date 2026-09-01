/**
 * Heuristic language plausibility from script + character n-grams.
 * Scores are NOT calibrated probabilities.
 */
const ARABIC_LETTER = /[\u0600-\u06FF]/
const LATIN_LETTER = /[A-Za-z]/

/** Common MSA/dialect bigrams. Morphological, not a word list. */
const AR_BIGRAM_HIGH = new Set([
  'ال', 'لا', 'ان', 'من', 'في', 'ون', 'ين', 'هل', 'يا', 'وا', 'عل',
  'ها', 'هم', 'هن', 'نا', 'ني', 'تي', 'ات', 'ية', 'له', 'كم', 'تم',
  'ست', 'تع', 'بت', 'يت', 'كت', 'ما', 'هذ',
])

const AR_BIGRAM_MID = new Set([
  'أه', 'لي', 'عم', 'مل', 'شو', 'زل', 'لم', 'جد', 'حس', 'صب', 'مس',
  'يو', 'وم', 'فل', 'مش', 'رو', 'حو', 'خو', 'فو', 'قو', 'سو', 'تو',
  'بو', 'مو', 'نو', 'هو', 'يو', 'أه', 'هل', 'بي', 'كي', 'شي', 'ضي',
])

const EN_BIGRAM_HIGH = new Set([
  'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es',
  'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar', 'st', 'to', 'nt', 'ng',
  'se', 'ha', 'as', 'ou', 'io', 'le', 've', 'co', 'me', 'de', 'hi', 'ri',
  'ro', 'ic', 'ne', 'ea', 'ra', 'ce',
])

const EN_VOWEL = /[aeiouy]/i

function lettersOf(text: string, test: RegExp): string[] {
  return [...text].filter((char) => test.test(char))
}

function bigramScore(letters: string[], high: Set<string>, mid?: Set<string>): number {
  if (letters.length < 2) return letters.length === 1 ? 0.35 : 0
  let weight = 0
  let count = 0
  for (let i = 0; i < letters.length - 1; i += 1) {
    const pair = `${letters[i]}${letters[i + 1]}`
    count += 1
    if (high.has(pair)) weight += 1
    else if (mid?.has(pair)) weight += 0.55
    else weight += 0.12
  }
  return weight / count
}

export function arabicScriptRatio(text: string): number {
  const letters = [...text].filter((char) => /\p{L}/u.test(char))
  if (letters.length === 0) return 0
  return letters.filter((char) => ARABIC_LETTER.test(char)).length / letters.length
}

export function latinScriptRatio(text: string): number {
  const letters = [...text].filter((char) => /\p{L}/u.test(char))
  if (letters.length === 0) return 0
  return letters.filter((char) => LATIN_LETTER.test(char)).length / letters.length
}

export function arabicPlausibility(text: string): number {
  const letters = lettersOf(text, ARABIC_LETTER)
  if (letters.length === 0) return 0
  const script = arabicScriptRatio(text)
  const ngram = bigramScore(letters, AR_BIGRAM_HIGH, AR_BIGRAM_MID)
  let morph = 0
  const joined = letters.join('')
  if (joined.startsWith('ال') && letters.length >= 3) morph += 0.12
  if (joined.startsWith('و') && letters.length >= 3) morph += 0.06
  if (/[ةهاني]$/.test(joined) && letters.length >= 3) morph += 0.06
  return Math.min(1, 0.25 * script + 0.65 * ngram + morph)
}

export function englishPlausibility(text: string): number {
  const letters = lettersOf(text, LATIN_LETTER)
  if (letters.length === 0) return 0
  const script = latinScriptRatio(text)
  const lower = letters.join('').toLocaleLowerCase()
  const ngram = bigramScore([...lower], EN_BIGRAM_HIGH)
  const vowelRatio = (lower.match(EN_VOWEL) ?? []).length / lower.length
  let vowel = 0
  if (lower.length <= 3) vowel = 0.2
  else if (vowelRatio >= 0.2 && vowelRatio <= 0.6) vowel = 0.2
  else if (vowelRatio === 0 && lower.length >= 5) vowel = -0.15
  if (/q[^u]/i.test(lower)) vowel -= 0.1
  return Math.max(0, Math.min(1, 0.3 * script + 0.55 * ngram + vowel))
}

export function hasLetters(text: string): boolean {
  return /\p{L}/u.test(text)
}

export function isSymbolsOnly(text: string): boolean {
  return text.length > 0 && !/\p{L}/u.test(text) && !/\p{N}/u.test(text)
}
