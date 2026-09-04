/**
 * Keyboard layout as a physical transform + sequence evidence.
 * Does not memorize example strings. Lexicon hits are a bonus, not a gate.
 */
import { isBoundaryChar, tokenizeText, type TokenSpan } from '../safety/tokenize.ts'
import { skipReasonForToken } from '../safety/tokenKind.ts'
import { isArabicWord } from '../../features/layout/layouts/lexicons/ar-words.ts'
import { isEnglishWord } from '../../features/layout/layouts/lexicons/en-words.ts'
import { mapLayout, mapLayoutText } from '../../features/layout/layouts/registry.ts'
import {
  arabicPlausibility,
  englishPlausibility,
  hasLetters,
  isSymbolsOnly,
  latinScriptRatio,
  arabicScriptRatio,
} from './languagePlausibility.ts'
import { isStructuralTechnicalToken, isTechnicalToken, looksLikeTitleCaseToken } from './technicalTokens.ts'
import type { HypothesisRisk, LayoutSpanInference, PendingLayoutRun, TextRange } from './types.ts'

const AR_LETTER_PUNCT = /[[\]';,./`]/
const EN = 'en-US-qwerty'
const AR = 'ar-101'

export type TokenLayoutVote =
  | 'as_is'
  | 'en_on_ar'
  | 'ar_on_en'
  | 'neutral'
  | 'protected'
  | 'skip'

type TokenEval = {
  index: number
  span: TokenSpan
  vote: TokenLayoutVote
  mappedAr: string | null
  mappedEn: string | null
  coverageAr: number
  coverageEn: number
  asIsEn: number
  asIsAr: number
  mappedArScore: number
  mappedEnScore: number
  lexiconBonus: number
  structuralToAr: boolean
  structuralToEn: boolean
  confirmedAsIs: boolean
}

export function layoutMappingCoverage(
  token: string,
  source: string,
  target: string,
): { mapped: string | null; coverage: number } {
  if (!token) return { mapped: null, coverage: 0 }
  const strict = mapLayout(token, source, target)
  if (strict && strict !== token) {
    const letters = [...token].filter((char) => /\p{L}/u.test(char) || AR_LETTER_PUNCT.test(char))
    return { mapped: strict, coverage: letters.length > 0 ? 1 : 0 }
  }
  const loose = mapLayoutText(token, source, target)
  if (!loose || loose === token) return { mapped: strict ?? loose, coverage: 0 }
  let mappedChars = 0
  let total = 0
  for (let i = 0; i < token.length; i += 1) {
    const from = token[i]!
    const to = loose[i]
    if (from === ' ') continue
    total += 1
    if (to && to !== from) mappedChars += 1
  }
  return { mapped: loose, coverage: total === 0 ? 0 : mappedChars / total }
}

function mappedEnglishQuality(mapped: string): number {
  const base = englishPlausibility(mapped)
  const letters = [...mapped].filter((char) => /[A-Za-z]/.test(char))
  const junk = [...mapped].filter((char) => /[^A-Za-z\s'.-]/.test(char))
  let score = base - junk.length * 0.18
  if (letters.length <= 3) score = Math.min(score, 0.38)
  return Math.max(0, Math.min(1, score))
}

function mappedArabicQuality(mapped: string): number {
  const base = arabicPlausibility(mapped)
  const letters = [...mapped].filter((char) => /[\u0600-\u06FF]/.test(char))
  const junk = [...mapped].filter((char) => /[A-Za-z]/.test(char))
  let score = base - junk.length * 0.12
  if (letters.length <= 3) score = Math.min(score, 0.4)
  return Math.max(0, Math.min(1, score))
}

function physicalForm(span: TokenSpan): string {
  if (span.raw && span.raw !== span.token && AR_LETTER_PUNCT.test(span.raw)) {
    if (span.raw.startsWith(span.token) && /^[.,!?]+$/.test(span.raw.slice(span.token.length))) {
      return span.token
    }
    return span.raw
  }
  return span.token || span.raw
}

function physicalRange(span: TokenSpan): TextRange {
  if (span.raw && span.raw !== span.token && AR_LETTER_PUNCT.test(span.raw)) {
    if (span.raw.startsWith(span.token) && /^[.,!?]+$/.test(span.raw.slice(span.token.length))) {
      return { start: span.start, end: span.end }
    }
    return { start: span.rawStart, end: span.rawEnd }
  }
  return { start: span.start, end: span.end }
}

function evaluateToken(span: TokenSpan, index: number): TokenEval {
  const form = physicalForm(span)
  const protectedKind = skipReasonForToken(span.token, span.context, span.raw)
  const base: TokenEval = {
    index,
    span,
    vote: 'skip',
    mappedAr: null,
    mappedEn: null,
    coverageAr: 0,
    coverageEn: 0,
    asIsEn: 0,
    asIsAr: 0,
    mappedArScore: 0,
    mappedEnScore: 0,
    lexiconBonus: 0,
    structuralToAr: false,
    structuralToEn: false,
    confirmedAsIs: false,
  }
  if (/^[÷×]$/.test(form)) {
    const toEn = layoutMappingCoverage(form, AR, EN)
    const mapped = toEn.mapped
    if (mapped && /^[A-Za-z]$/.test(mapped)) {
      const lexiconEn = isEnglishWord(mapped) ? 0.25 : 0
      return {
        ...base,
        vote: 'ar_on_en',
        mappedEn: mapped,
        coverageEn: 1,
        mappedEnScore: 0.9,
        lexiconBonus: lexiconEn,
        structuralToEn: true,
      }
    }
  }
  if (!form || isSymbolsOnly(form) || /^\d+$/.test(form)) {
    return { ...base, vote: 'neutral' }
  }
  if (
    protectedKind
    && protectedKind !== 'digits'
  ) {
    return { ...base, vote: 'protected' }
  }
  if (
    isStructuralTechnicalToken(form)
    || isStructuralTechnicalToken(span.token)
    || looksLikeTitleCaseToken(form)
  ) {
    return { ...base, vote: 'protected' }
  }
  if (!hasLetters(form) && !AR_LETTER_PUNCT.test(form)) {
    return { ...base, vote: 'neutral' }
  }

  const asIsEn = isEnglishWord(form) ? 0.95 : englishPlausibility(form)
  const asIsAr = isArabicWord(form) ? 0.95 : arabicPlausibility(form)
  const toAr = layoutMappingCoverage(form, EN, AR)
  const toEn = layoutMappingCoverage(form, AR, EN)
  const mappedArScore = toAr.mapped ? mappedArabicQuality(toAr.mapped) : 0
  const mappedEnScore = toEn.mapped ? mappedEnglishQuality(toEn.mapped) : 0
  const lexiconAr = toAr.mapped && isArabicWord(toAr.mapped) ? 0.25 : 0
  const lexiconEn = toEn.mapped && isEnglishWord(toEn.mapped) ? 0.25 : 0

  let vote: TokenLayoutVote = 'as_is'
  const latin = latinScriptRatio(form)
  const arabic = arabicScriptRatio(form)
  const letterCount = [...form].length
  const short = letterCount <= 3
  const knownEnglish = isEnglishWord(form)
  const knownArabic = isArabicWord(form)

  const structuralToAr = toAr.coverage >= 0.7
    && latin > 0.5
    && Boolean(toAr.mapped && toAr.mapped !== form)
    && !knownEnglish
    && !isTechnicalToken(form)
    && !isStructuralTechnicalToken(form)
  const structuralToEn = toEn.coverage >= 0.7
    && arabic > 0.5
    && Boolean(toEn.mapped && toEn.mapped !== form)
    && !knownArabic

  const mapsToEnglishWord = Boolean(
    toEn.mapped
    && toEn.coverage >= 0.7
    && (
      isEnglishWord(toEn.mapped)
      || isTechnicalToken(toEn.mapped)
      || isStructuralTechnicalToken(toEn.mapped)
    ),
  )
  const layoutToAr = structuralToAr && (
    lexiconAr >= 0.2
    || mappedArScore > asIsEn + 0.1
    || (
      AR_LETTER_PUNCT.test(form)
      && toAr.coverage >= 0.99
      && mappedArScore >= 0.25
      && !knownEnglish
    )
  )
  // Arabic script that does not map to a real English/technical word stays as-is.
  const layoutToEn = structuralToEn && mapsToEnglishWord && (
    lexiconEn >= 0.2
    || mappedEnScore > asIsAr + 0.1
    || (short && mappedEnScore > asIsAr + 0.14 && asIsAr < 0.4)
  )

  if (layoutToAr && !layoutToEn) vote = 'en_on_ar'
  else if (layoutToEn && !layoutToAr) vote = 'ar_on_en'
  else if (layoutToAr && layoutToEn) {
    vote = mappedArScore + lexiconAr >= mappedEnScore + lexiconEn ? 'en_on_ar' : 'ar_on_en'
  }

  let confirmedAsIs = false
  if (
    latin >= 0.75
    && lexiconAr < 0.2
    && !AR_LETTER_PUNCT.test(form)
    && (knownEnglish || (asIsEn >= 0.58 && asIsEn + 0.04 >= mappedArScore))
  ) {
    vote = 'as_is'
    confirmedAsIs = knownEnglish || asIsEn >= 0.64
  }
  if (
    arabic >= 0.75
    && !mapsToEnglishWord
    && (knownArabic || asIsAr >= 0.48)
  ) {
    vote = 'as_is'
    confirmedAsIs = knownArabic || asIsAr >= 0.52
  }

  return {
    ...base,
    vote,
    mappedAr: toAr.mapped,
    mappedEn: toEn.mapped,
    coverageAr: toAr.coverage,
    coverageEn: toEn.coverage,
    asIsEn,
    asIsAr,
    mappedArScore,
    mappedEnScore,
    lexiconBonus: lexiconAr + lexiconEn,
    structuralToAr: structuralToAr && !confirmedAsIs,
    structuralToEn: structuralToEn && !confirmedAsIs,
    confirmedAsIs,
  }
}

function neighborTargetBoost(evals: TokenEval[], start: number, end: number, target: 'ar' | 'en'): number {
  let boost = 0
  const left = evals[start - 1]
  const right = evals[end + 1]
  for (const side of [left, right]) {
    if (!side) continue
    if (target === 'ar' && (side.asIsAr >= 0.45 || side.vote === 'en_on_ar')) boost += 0.12
    if (target === 'en' && (side.asIsEn >= 0.45 || side.vote === 'ar_on_en')) boost += 0.12
  }
  return Math.min(0.24, boost)
}

function buildSpanReplacement(
  text: string,
  evals: TokenEval[],
  indexes: number[],
  direction: 'en_on_ar' | 'ar_on_en',
): { range: TextRange; replacement: string } | null {
  const first = evals[indexes[0]!]!
  const last = evals[indexes[indexes.length - 1]!]!
  const start = physicalRange(first.span).start
  const end = physicalRange(last.span).end
  let cursor = start
  let out = ''
  for (const index of indexes) {
    const item = evals[index]!
    const range = physicalRange(item.span)
    if (range.start > cursor) out += text.slice(cursor, range.start)
    const mapped = direction === 'en_on_ar' ? item.mappedAr : item.mappedEn
    if (mapped && (item.vote === direction || structuralMatch(item, direction))) out += mapped
    else out += text.slice(range.start, range.end)
    cursor = range.end
  }
  if (cursor < end) out += text.slice(cursor, end)
  if (!out || out === text.slice(start, end)) return null
  return { range: { start, end }, replacement: out }
}

function scoreSpan(
  evals: TokenEval[],
  indexes: number[],
  direction: 'en_on_ar' | 'ar_on_en',
  pending?: PendingLayoutRun | null,
): Omit<LayoutSpanInference, 'range' | 'replacement' | 'sourceChunkIds'> & { sourceIndexes: number[] } {
  const members = indexes.map((index) => evals[index]!)
  const supporting = members.filter((item) => item.vote === direction || structuralMatch(item, direction))
  const coverage = supporting.reduce((sum, item) => (
    sum + (direction === 'en_on_ar' ? item.coverageAr : item.coverageEn)
  ), 0) / Math.max(1, supporting.length)
  const plausibility = supporting.reduce((sum, item) => (
    sum + (direction === 'en_on_ar' ? item.mappedArScore : item.mappedEnScore)
  ), 0) / Math.max(1, supporting.length)
  const asIs = supporting.reduce((sum, item) => (
    sum + (direction === 'en_on_ar' ? item.asIsEn : item.asIsAr)
  ), 0) / Math.max(1, supporting.length)
  const lexiconBonus = supporting.reduce((sum, item) => sum + item.lexiconBonus, 0) / Math.max(1, supporting.length)
  const neighbor = neighborTargetBoost(evals, indexes[0]!, indexes[indexes.length - 1]!, direction === 'en_on_ar' ? 'ar' : 'en')
  const left = evals[indexes[0]! - 1]
  const right = evals[indexes[indexes.length - 1]! + 1]
  const continuing = pending?.direction === direction
  const mixedContext = !continuing && [left, right].some((side) => {
    if (!side || side.vote === 'neutral' || side.vote === 'protected') return false
    if (direction === 'ar_on_en') {
      return side.confirmedAsIs && side.asIsEn >= 0.4
        || (side.vote === 'as_is' && side.asIsEn >= 0.55 && side.asIsAr < 0.3)
    }
    return side.confirmedAsIs && side.asIsAr >= 0.4
      || (side.vote === 'as_is' && side.asIsAr >= 0.55 && side.asIsEn < 0.3)
  })
  const consecutive = supporting.length + (continuing ? pending.consecutiveCount : 0)
  const sequenceBoost = Math.min(0.35, Math.max(0, consecutive - 1) * 0.12)
  const letterCount = supporting.reduce((sum, item) => sum + [...physicalForm(item.span)].length, 0)
  const short = letterCount <= 2 && consecutive === 1
  const punctKeyed = direction === 'en_on_ar'
    && supporting.some((item) => {
      const form = physicalForm(item.span)
      if (!AR_LETTER_PUNCT.test(form)) return false
      if (/^[A-Za-z]+[.?!,;:]+$/.test(form)) return false
      return true
    })
    && coverage >= 0.99
    && letterCount >= 4
  const shiftedLetterGlyph = direction === 'ar_on_en'
    && supporting.length === 1
    && /^[÷×]$/.test(physicalForm(supporting[0]!.span))
    && coverage >= 0.99
    && /^[A-Za-z]$/.test(supporting[0]!.mappedEn ?? '')
  const lexiconIsolated = direction === 'ar_on_en'
    && lexiconBonus >= 0.2
    && coverage >= 0.99
    && letterCount >= 3

  let heuristicScore = 0.2 * coverage + 0.35 * plausibility + sequenceBoost + neighbor + lexiconBonus - 0.2 * asIs
  heuristicScore = Math.max(0, Math.min(0.99, heuristicScore))

  let risk: HypothesisRisk = 'high'
  if (short && !shiftedLetterGlyph && !punctKeyed) {
    heuristicScore = Math.min(heuristicScore, 0.4)
    risk = 'high'
  } else if (consecutive >= 2 && coverage >= 0.75 && plausibility >= 0.28) {
    risk = 'low'
    heuristicScore = Math.max(heuristicScore, 0.85)
  } else if (
    consecutive === 1
    && letterCount >= 3
    && coverage >= 0.85
    && plausibility >= 0.4
    && (letterCount >= 4 || lexiconBonus >= 0.2)
  ) {
    const lexiconStrong = lexiconBonus >= 0.2 && letterCount > 2
    const comparative = asIs <= 0.45
      || plausibility >= asIs + 0.08
      || (coverage >= 0.95 && letterCount >= 6 && plausibility >= 0.5)
    const isolatedLatinWithoutLexicon = direction === 'en_on_ar' && lexiconBonus < 0.2
    if ((lexiconStrong || comparative) && !isolatedLatinWithoutLexicon) {
      risk = 'low'
      heuristicScore = Math.max(heuristicScore, 0.85)
    } else {
      risk = 'medium'
    }
  } else if (punctKeyed || shiftedLetterGlyph || lexiconIsolated) {
    risk = 'low'
    heuristicScore = Math.max(heuristicScore, 0.85)
  } else {
    risk = 'medium'
  }

  const sequenceConfident = consecutive >= 2 && coverage >= 0.75
  const longTokenConfident = consecutive === 1
    && letterCount >= 4
    && coverage >= 0.85
    && plausibility >= 0.4
    && (
      lexiconBonus >= 0.2
      || plausibility >= 0.68
      || letterCount >= 5 && (asIs <= 0.45 || plausibility >= asIs + 0.08 || (coverage >= 0.95 && letterCount >= 6 && plausibility >= 0.5))
    )
  // Neighbors in the other script are normal in bilingual fields. Only
  // isolate short/ambiguous tokens so "في" / "or" next to real prose stay safe.
  if (
    mixedContext
    && !sequenceConfident
    && !longTokenConfident
    && !punctKeyed
    && !shiftedLetterGlyph
    && !lexiconIsolated
  ) {
    risk = 'high'
    heuristicScore = Math.min(heuristicScore, 0.46)
  }

  return {
    direction,
    sourceLayout: direction === 'en_on_ar' ? EN : AR,
    targetLayout: direction === 'en_on_ar' ? AR : EN,
    consecutiveCount: consecutive,
    mappingCoverage: coverage,
    languagePlausibility: plausibility,
    lexiconBonus,
    neighborAgreement: neighbor,
    heuristicScore,
    risk,
    sourceIndexes: indexes,
  }
}

function directionOf(item: TokenEval): 'en_on_ar' | 'ar_on_en' | null {
  if (item.vote === 'en_on_ar' || item.vote === 'ar_on_en') return item.vote
  return null
}

function structuralMatch(item: TokenEval, direction: 'en_on_ar' | 'ar_on_en'): boolean {
  if (item.confirmedAsIs || item.vote === 'protected') return false
  return direction === 'en_on_ar' ? item.structuralToAr : item.structuralToEn
}

function mappedMean(evals: TokenEval[], indexes: number[], direction: 'en_on_ar' | 'ar_on_en'): number {
  const members = indexes.map((index) => evals[index]!)
  if (members.length === 0) return 0
  return members.reduce((sum, item) => (
    sum + (direction === 'en_on_ar' ? item.mappedArScore : item.mappedEnScore)
  ), 0) / members.length
}

function asIsMean(evals: TokenEval[], indexes: number[], direction: 'en_on_ar' | 'ar_on_en'): number {
  const members = indexes.map((index) => evals[index]!)
  if (members.length === 0) return 0
  return members.reduce((sum, item) => (
    sum + (direction === 'en_on_ar' ? item.asIsEn : item.asIsAr)
  ), 0) / members.length
}

function pushSpan(
  results: LayoutSpanInference[],
  text: string,
  evals: TokenEval[],
  supporting: number[],
  direction: 'en_on_ar' | 'ar_on_en',
  pending?: PendingLayoutRun | null,
): void {
  if (supporting.length === 0) return
  const scored = scoreSpan(evals, supporting, direction, pending)
  const built = buildSpanReplacement(text, evals, supporting, direction)
  if (!built) return
  const key = `${built.range.start}:${built.range.end}:${direction}:${built.replacement}`
  if (results.some((item) => `${item.range.start}:${item.range.end}:${item.direction}:${item.replacement}` === key)) {
    return
  }
  results.push({
    direction: scored.direction,
    range: built.range,
    replacement: built.replacement,
    sourceLayout: scored.sourceLayout,
    targetLayout: scored.targetLayout,
    consecutiveCount: scored.consecutiveCount,
    mappingCoverage: scored.mappingCoverage,
    languagePlausibility: scored.languagePlausibility,
    lexiconBonus: scored.lexiconBonus,
    neighborAgreement: scored.neighborAgreement,
    heuristicScore: scored.heuristicScore,
    risk: scored.risk,
    sourceChunkIds: supporting.map((index) => `c${index}`),
  })
}

export type LayoutInferOptions = {
  caret?: number
  commitOpenToken?: boolean
  pendingLayoutRun?: PendingLayoutRun | null
}

function rangesOverlap(left: TextRange, right: TextRange): boolean {
  return left.start < right.end && right.start < left.end
}

/**
 * Token the user is still producing. Snapshot callers omit caret → null.
 * Caret inside a word, or at the end of a word with no boundary after it,
 * is unfinished. A following space/Enter/punctuation completes it.
 */
export function openTokenRange(
  text: string,
  caret: number | undefined,
  tokens?: TokenSpan[],
  options?: { commitOpenToken?: boolean },
): TextRange | null {
  if (options?.commitOpenToken || caret === undefined || !Number.isFinite(caret)) return null
  const spans = tokens ?? tokenizeText(text).tokens
  for (const span of spans) {
    const range = physicalRange(span)
    if (caret < range.start || caret > range.end) continue
    if (caret < range.end) return range
    if (!isBoundaryChar(text[range.end])) return range
  }
  return null
}

function alreadyCovered(results: LayoutSpanInference[], index: number, evals: TokenEval[]): boolean {
  const range = physicalRange(evals[index]!.span)
  return results.some((item) => item.range.start <= range.start && item.range.end >= range.end)
}

export function applyLayoutSpansToText(
  text: string,
  spans: LayoutSpanInference[],
  options?: { includeMedium?: boolean },
): { text: string; applied: LayoutSpanInference[] } {
  const usable = [...spans]
    .filter((span) => span.risk === 'low' || (options?.includeMedium === true && span.risk === 'medium'))
    .sort((a, b) => a.range.start - b.range.start)
  const applied: LayoutSpanInference[] = []
  let out = ''
  let cursor = 0
  for (const span of usable) {
    if (span.range.start < cursor) continue
    out += text.slice(cursor, span.range.start)
    out += span.replacement
    cursor = span.range.end
    applied.push(span)
  }
  out += text.slice(cursor)
  return { text: out, applied }
}

export function repairKeyboardLayoutText(text: string): { text: string; applied: LayoutSpanInference[] } {
  return applyLayoutSpansToText(text, inferLayoutSpans(text))
}

export function inferLayoutSpans(
  text: string,
  tokens?: TokenSpan[],
  options?: LayoutInferOptions,
): LayoutSpanInference[] {
  const spans = tokens ?? tokenizeText(text).tokens
  if (spans.length === 0) return []
  const open = openTokenRange(text, options?.caret, spans, options)
  const pending = options?.pendingLayoutRun ?? null
  const evals = spans.map((span, index) => evaluateToken(span, index))
  for (let index = 0; index < evals.length; index += 1) {
    const item = evals[index]!
    const neighbors = [evals[index - 1], evals[index + 1]].filter(Boolean)
    const latinAsIs = neighbors.some((side) => side!.confirmedAsIs && side!.asIsEn >= 0.45)
    const arabicAsIs = neighbors.some((side) => side!.confirmedAsIs && side!.asIsAr >= 0.45)
    const mappedEn = item.mappedEn ?? ''
    if (
      item.vote === 'as_is'
      && !item.confirmedAsIs
      && latinAsIs
      && item.coverageEn >= 0.99
      && mappedEn.length >= 5
      && /^[A-Za-z]+$/.test(mappedEn)
    ) {
      item.vote = 'ar_on_en'
    }
    if (item.vote !== 'ar_on_en' && item.vote !== 'en_on_ar') continue
    if (
      item.vote === 'ar_on_en'
      && latinAsIs
      && [...physicalForm(item.span)].length <= 3
      && item.asIsAr >= 0.34
    ) {
      const mapped = item.mappedEn ?? ''
      const knownEnglishRun = mapped.length >= 3 && item.coverageEn >= 0.99 && isEnglishWord(mapped)
      if (!knownEnglishRun) item.vote = 'as_is'
    }
    if (item.vote === 'en_on_ar' && arabicAsIs && isEnglishWord(physicalForm(item.span))) {
      item.vote = 'as_is'
      item.confirmedAsIs = true
    }
  }
  const results: LayoutSpanInference[] = []

  let i = 0
  while (i < evals.length) {
    const seed = evals[i]!
    const direction = directionOf(seed)
    if (!direction) {
      i += 1
      continue
    }
    const indexes = [i]
    let j = i + 1
    while (j < evals.length) {
      const next = evals[j]!
      if (next.vote === 'neutral') {
        j += 1
        continue
      }
      if (next.vote === 'protected' || next.confirmedAsIs) break
      if (next.vote === direction || structuralMatch(next, direction)) {
        indexes.push(j)
        j += 1
        continue
      }
      break
    }
    const supporting = indexes.filter((index) => (
      (evals[index]!.vote === direction || structuralMatch(evals[index]!, direction))
      && !(open && rangesOverlap(physicalRange(evals[index]!.span), open))
    ))
    if (supporting.length === 0) {
      i += 1
      continue
    }
    pushSpan(results, text, evals, supporting, direction, pending)
    i = j
  }

  for (const direction of ['en_on_ar', 'ar_on_en'] as const) {
    let index = 0
    while (index < evals.length) {
      const seed = evals[index]!
      if (seed.vote === 'protected' || seed.confirmedAsIs || alreadyCovered(results, index, evals)) {
        index += 1
        continue
      }
      if (!structuralMatch(seed, direction) && seed.vote !== direction) {
        index += 1
        continue
      }
      const indexes = [index]
      let cursor = index + 1
      while (cursor < evals.length) {
        const next = evals[cursor]!
        if (next.vote === 'neutral') {
          cursor += 1
          continue
        }
        if (next.vote === 'protected' || next.confirmedAsIs) break
        if (structuralMatch(next, direction) || next.vote === direction) {
          indexes.push(cursor)
          cursor += 1
          continue
        }
        break
      }
      const supporting = indexes.filter((item) => (
        (structuralMatch(evals[item]!, direction) || evals[item]!.vote === direction)
        && !(open && rangesOverlap(physicalRange(evals[item]!.span), open))
      ))
      const comparative = mappedMean(evals, supporting, direction) > asIsMean(evals, supporting, direction) + 0.08
      if (supporting.length >= 2 && comparative) {
        pushSpan(results, text, evals, supporting, direction, pending)
      }
      index = cursor
    }
  }

  return results
}

export function tokenVotesForTests(text: string): TokenLayoutVote[] {
  return tokenizeText(text).tokens.map((span, index) => evaluateToken(span, index).vote)
}
