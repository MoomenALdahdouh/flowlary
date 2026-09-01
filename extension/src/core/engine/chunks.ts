/**
 * Local-only shared analysis. No API. Uncertainty is explicit.
 * Lexicon / script hits are evidence, not user intent.
 */
import { hashWritingSample } from '@flowlary/shared'
import { tokenizeText } from '../safety/tokenize.ts'
import { skipReasonForToken } from '../safety/tokenKind.ts'
import { scriptCounts } from '../../features/correction/language.ts'
import { isEnglishWord } from '../../features/layout/layouts/lexicons/en-words.ts'
import { isArabicWord } from '../../features/layout/layouts/lexicons/ar-words.ts'
import { looksLikeArabizi } from './arabizi.ts'
import { inferLayoutSpans, layoutMappingCoverage, openTokenRange } from './layoutSequence.ts'
import {
  isPairedShortLatinToken,
  isStructuralTechnicalToken,
  isTechnicalToken,
  looksLikeIntentionalLatinInArabic,
  looksLikeTitleCaseToken,
} from './technicalTokens.ts'
import type { AnalyzeOptions, SharedAnalysis, SpanRole, TextOrigin, WritingChunk } from './types.ts'

const SHIFT_GLYPH = /[÷×—–]/
const KNOWN_ENGLISH_TYPOS = new Set([
  'dont', 'doesnt', 'cant', 'wont', 'teh', 'adn', 'taht', 'becuase',
])

function latinIslandTokenCount(tokens: { token: string }[], index: number): number {
  const isLatin = (token: string) => /[A-Za-z]/.test(token) && !/[\u0600-\u06FF]/.test(token)
  if (!isLatin(tokens[index]?.token ?? '')) return 0
  let count = 1
  for (let i = index - 1; i >= 0; i -= 1) {
    const token = tokens[i]!.token
    if (!token.trim() || /^[.,!?'"()]+$/.test(token)) continue
    if (isLatin(token)) count += 1
    else break
  }
  for (let i = index + 1; i < tokens.length; i += 1) {
    const token = tokens[i]!.token
    if (!token.trim() || /^[.,!?'"()]+$/.test(token)) continue
    if (isLatin(token)) count += 1
    else break
  }
  return count
}

function overlaps(range: { start: number; end: number }, start: number, end: number): boolean {
  return range.start < end && start < range.end
}

function roleFromSkip(reason: string | null): SpanRole | null {
  if (!reason) return null
  if (reason === 'email') return 'email'
  if (reason === 'url') return 'url'
  if (reason === 'digits') return 'number'
  if (reason === 'file-path' || reason === 'shell' || reason === 'code-identifier') return 'identifier'
  return 'protected'
}

function tokenOrigin(
  scripts: { arabic: number; latin: number; other: number },
  layoutSuspicion: WritingChunk['layoutSuspicion'],
  role: SpanRole,
): TextOrigin {
  if (role === 'user_override') return 'unknown'
  if (role === 'translated_output') return 'translated_en'
  if (layoutSuspicion !== 'none') return 'layout_mismatch_suspected'
  if (role === 'arabizi') return 'arabizi_suspected'
  if (scripts.arabic > 0 && scripts.latin > 0) return 'original_mixed'
  if (scripts.arabic > 0 && scripts.latin === 0) return 'original_ar'
  if (role === 'english_prose' || role === 'technical_token' || role === 'intentional_foreign_token') {
    return 'original_en'
  }
  if (scripts.latin > 0 && scripts.arabic === 0) return 'unknown'
  return 'unknown'
}

export function analyzeFieldText(text: string, options: AnalyzeOptions = {}): SharedAnalysis {
  const tokens = tokenizeText(text).tokens
  const exceptions = options.exceptions ?? []
  const vocab = new Set(options.vocabularyHashes ?? [])
  const openToken = openTokenRange(text, options.caret, tokens, options)
  const layoutSpans = inferLayoutSpans(text, tokens, {
    caret: options.caret,
    commitOpenToken: options.commitOpenToken,
    pendingLayoutRun: options.pendingLayoutRun,
  })

  const chunks: WritingChunk[] = tokens.map((span, index) => {
    const scripts = scriptCounts(span.token)
    const protectedKind = skipReasonForToken(span.token, span.context, span.raw)
    const covering = options.correctedRanges?.some((range) => overlaps(range, span.start, span.end))
      ? undefined
      : layoutSpans.find((item) => (
        item.risk === 'low'
        && (overlaps(item.range, span.start, span.end) || overlaps(item.range, span.rawStart, span.rawEnd))
      ))
    let layoutSuspicion: WritingChunk['layoutSuspicion'] = 'none'
    if (covering?.direction === 'en_on_ar') layoutSuspicion = 'ar_on_en'
    else if (covering?.direction === 'ar_on_en') layoutSuspicion = 'en_on_ar'
    else if (SHIFT_GLYPH.test(span.raw)) layoutSuspicion = 'shift_symbol_break'

    const inExceptionList = exceptions.includes(span.token)
    const inPersonalVocabulary = vocab.has(hashWritingSample(span.token.toLocaleLowerCase()))
    const override = options.overrideRanges?.some((range) => overlaps(range, span.start, span.end))
    const translated = options.translatedRanges?.some((range) => overlaps(range, span.start, span.end))
    // Engine-written English correction span still present in the field.
    const corrected = options.correctedRanges?.some((range) => overlaps(range, span.start, span.end))
    const arabizi = looksLikeArabizi(span.token) && scripts.latin > 0 && scripts.arabic === 0
    const hasArabicNeighbor = tokens.some((other, otherIndex) => {
      if (otherIndex === index) return false
      return Math.abs(otherIndex - index) <= 3 && /[\u0600-\u06FF]/.test(other.token)
    })
    const inEnglishIsland = latinIslandTokenCount(tokens, index) >= 3
    const mappedAr = layoutMappingCoverage(span.token, 'en-US-qwerty', 'ar-101')
    const mappedEn = layoutMappingCoverage(span.token, 'ar-101', 'en-US-qwerty')
    const layoutArabicScore = mappedAr.mapped
      ? [...mappedAr.mapped].filter((char) => /[\u0600-\u06FF]/.test(char)).length / Math.max(1, [...mappedAr.mapped].length)
      : 0
    const tokenMapsToEnglish = Boolean(
      mappedEn.mapped
      && mappedEn.coverage >= 0.7
      && (isEnglishWord(mappedEn.mapped) || isTechnicalToken(mappedEn.mapped)),
    )

    let role: SpanRole = 'unknown'
    if (override) role = 'user_override'
    else if (translated && scripts.arabic === 0) role = 'translated_output'
    else if (arabizi) role = 'arabizi'
    else if (roleFromSkip(protectedKind)) role = roleFromSkip(protectedKind)!
    else if (inExceptionList || inPersonalVocabulary) role = 'intentional_foreign_token'
    else if (isTechnicalToken(span.token) || isStructuralTechnicalToken(span.raw)) {
      role = roleFromSkip(skipReasonForToken(span.token, span.context, span.raw)) ?? 'technical_token'
    }
    else if (
      scripts.arabic > 0
      && scripts.latin === 0
      && (isArabicWord(span.token) || ([...span.token].length <= 3 && !tokenMapsToEnglish))
    ) {
      role = 'arabic_prose'
    }
    else if (
      layoutSuspicion !== 'none'
      && covering
      && !(scripts.arabic > 0 && isArabicWord(span.token) && !tokenMapsToEnglish)
      && !(scripts.latin > 0 && isEnglishWord(span.token))
    ) {
      role = 'possible_layout_error'
    }
    else if (
      isPairedShortLatinToken(span.token, [tokens[index - 1]?.token ?? '', tokens[index + 1]?.token ?? ''])
    ) {
      role = 'technical_token'
    }
    else if (looksLikeTitleCaseToken(span.token)) {
      role = 'intentional_foreign_token'
    } else if (
      looksLikeIntentionalLatinInArabic(span.token, hasArabicNeighbor, layoutArabicScore)
      && layoutSuspicion === 'none'
      && !inEnglishIsland
    ) {
      role = 'intentional_foreign_token'
    } else if (scripts.arabic > 0 && scripts.latin === 0) {
      role = isArabicWord(span.token) || scripts.arabic >= 1 ? 'arabic_prose' : 'arabic_prose'
    } else if (scripts.latin > 0 && scripts.arabic === 0 && isEnglishWord(span.token)) {
      role = 'english_prose'
    } else if (scripts.latin > 0 && scripts.arabic === 0 && /[A-Za-z]/.test(span.token)) {
      if (KNOWN_ENGLISH_TYPOS.has(span.token.toLowerCase()) && layoutSuspicion === 'none') {
        role = 'english_prose'
      }
      else role = hasArabicNeighbor && !inEnglishIsland ? 'intentional_foreign_token' : 'unknown'
    } else if (!/\p{L}/u.test(span.token) && /^\d/.test(span.token)) {
      role = 'number'
    } else if (!/\p{L}/u.test(span.token)) {
      role = 'punctuation'
    }

    const origin = corrected && scripts.latin > 0 && !translated
      ? 'corrected_en'
      : tokenOrigin(scripts, layoutSuspicion, role)
    return {
      id: `c${index}`,
      range: { start: span.start, end: span.end },
      textHash: hashWritingSample(span.token),
      scripts: {
        arabic: scripts.arabic,
        latin: scripts.latin,
        other: scripts.cjk + scripts.cyrillic,
      },
      origin,
      protectedKind,
      layoutSuspicion,
      letterCount: [...span.token].length,
      inExceptionList,
      role,
      inPersonalVocabulary,
    }
  })

  const totals = chunks.reduce(
    (acc, chunk) => ({
      arabic: acc.arabic + chunk.scripts.arabic,
      latin: acc.latin + chunk.scripts.latin,
      other: acc.other + chunk.scripts.other,
    }),
    { arabic: 0, latin: 0, other: 0 },
  )

  const hasLayoutSuspicion = layoutSpans.some((span) => span.risk === 'low')
    || chunks.some((chunk) => chunk.layoutSuspicion !== 'none' && chunk.role === 'possible_layout_error')
  const hasArabizi = chunks.some((chunk) => chunk.role === 'arabizi')
  const hasProtected = chunks.some((chunk) => chunk.protectedKind != null)
  const realArabic = chunks.some((chunk) => (
    chunk.scripts.arabic > 0 && chunk.role !== 'possible_layout_error'
  ))
  const unexplainedLatin = chunks.some((chunk) => (
    chunk.scripts.latin > 0
    && chunk.layoutSuspicion === 'none'
    && chunk.role !== 'possible_layout_error'
    && chunk.role !== 'punctuation'
    && chunk.role !== 'number'
  ))
  const hasAmbiguousMixed = realArabic && unexplainedLatin

  let dominantOrigin: TextOrigin = 'unknown'
  if (hasLayoutSuspicion && !realArabic && !unexplainedLatin) dominantOrigin = 'layout_mismatch_suspected'
  else if (hasLayoutSuspicion && !unexplainedLatin) dominantOrigin = 'layout_mismatch_suspected'
  else if (hasArabizi && !realArabic && !hasAmbiguousMixed) dominantOrigin = 'arabizi_suspected'
  else if (hasAmbiguousMixed) dominantOrigin = 'original_mixed'
  else if (hasLayoutSuspicion) dominantOrigin = 'layout_mismatch_suspected'
  else if (totals.arabic > 0 && totals.latin === 0) dominantOrigin = 'original_ar'
  else if (totals.latin > 0 && totals.arabic === 0) {
    dominantOrigin = chunks.some((chunk) => chunk.origin === 'original_en')
      ? 'original_en'
      : 'unknown'
  }

  return {
    chunks,
    dominantOrigin,
    hasProtected,
    hasArabizi,
    hasLayoutSuspicion,
    hasAmbiguousMixed,
    scriptMix: totals,
    layoutSpans,
    openToken,
  }
}
