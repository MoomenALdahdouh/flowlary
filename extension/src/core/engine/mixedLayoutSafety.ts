/**
 * Span-level layout auto-write safety.
 * Distinguishes a coherent keyboard-layout run from intentional mixed language.
 * No word lists. No network.
 */
import { isEnglishWord } from '../../features/layout/layouts/lexicons/en-words.ts'
import { mapLayout } from '../../features/layout/layouts/registry.ts'
import type { LayoutSpanInference, TextRange, WritingChunk } from './types.ts'

const KEEP_LATIN_ROLES = new Set([
  'english_prose',
  'technical_token',
  'intentional_foreign_token',
  'identifier',
  'url',
  'email',
  'code',
  'protected',
])

const SURFACE_MARK = /[^\p{L}\p{N}\s]/u

function isStableAcrossLayouts(char: string): boolean {
  if (!SURFACE_MARK.test(char)) return false
  const toArabic = mapLayout(char, 'en-US-qwerty', 'ar-101')
  const toEnglish = mapLayout(char, 'ar-101', 'en-US-qwerty')
  const arabicStable = toArabic == null || toArabic === char
  const englishStable = toEnglish == null || toEnglish === char
  return arabicStable && englishStable
}

function overlaps(left: TextRange, right: TextRange): boolean {
  return left.start < right.end && right.start < left.end
}

export function isAsIsArabicChunk(chunk: WritingChunk): boolean {
  if (chunk.role === 'possible_layout_error') return false
  if (chunk.scripts.arabic === 0) return false
  if (chunk.role === 'arabic_prose') return true
  return chunk.layoutSuspicion === 'none'
}

export function isAsIsLatinKeepChunk(chunk: WritingChunk): boolean {
  if (chunk.role === 'possible_layout_error') return false
  if (chunk.role === 'punctuation' || chunk.role === 'number') return false
  if (KEEP_LATIN_ROLES.has(chunk.role)) return true
  return chunk.scripts.latin > 0 && chunk.scripts.arabic === 0 && chunk.layoutSuspicion === 'none'
}

export function coveredChunks(span: TextRange, chunks: readonly WritingChunk[]): WritingChunk[] {
  return chunks.filter((chunk) => overlaps(chunk.range, span))
}

/**
 * True when a layout candidate span consumes both genuine Arabic and
 * as-is Latin/technical/protected material — i.e. mixed intent, not one keyboard run.
 */
export function layoutSpanConflictsWithMixedIntent(
  span: TextRange,
  chunks: readonly WritingChunk[],
): boolean {
  const covered = coveredChunks(span, chunks)
  if (covered.length === 0) return false
  if (covered.some((chunk) => chunk.role === 'user_override')) return true
  if (
    covered.some((chunk) =>
      chunk.protectedKind != null
      || chunk.role === 'url'
      || chunk.role === 'email'
      || chunk.role === 'identifier'
      || chunk.role === 'code'
      || chunk.role === 'protected',
    )
  ) {
    return true
  }
  const arabic = covered.some(isAsIsArabicChunk)
  const latinKeep = covered.some(isAsIsLatinKeepChunk)
  return arabic && latinKeep
}

/** True when replacement omitted shared-surface punctuation that was in the source span. */
export function layoutReplacementDropsSharedPunct(source: string, replacement: string): boolean {
  const marks = [...source].filter((char) => isStableAcrossLayouts(char))
  if (marks.length === 0) return false
  let rest = replacement
  for (const mark of marks) {
    const index = rest.indexOf(mark)
    if (index === -1) return true
    rest = rest.slice(0, index) + rest.slice(index + 1)
  }
  return false
}

export function layoutSpanUnsafeForAutoWrite(
  span: LayoutSpanInference,
  chunks: readonly WritingChunk[],
  sourceText: string,
): boolean {
  if (layoutSpanConflictsWithMixedIntent(span.range, chunks)) return true
  const source = sourceText.slice(span.range.start, span.range.end)
  if (layoutReplacementDropsSharedPunct(source, span.replacement)) return true
  if (!layoutReplacementIsCredible(span.replacement)) return true
  return false
}

/**
 * Arabic→English layout must land on real English words (hello), never junk (ofvkd).
 * English→Arabic layout may be Arabic script.
 */
export function layoutReplacementIsCredible(replacement: string): boolean {
  const text = replacement.trim()
  if (!text) return false
  const hasArabic = /[\u0600-\u06FF]/.test(text)
  const latinWords = text.split(/[^\p{L}']+/u).filter((word) => /[A-Za-z]/.test(word))
  if (hasArabic && latinWords.length === 0) return true
  if (latinWords.length === 0) return false
  let hits = 0
  for (const word of latinWords) {
    const lower = word.toLocaleLowerCase()
    if (isEnglishWord(lower) || isEnglishWord(lower.replace(/'/g, ''))) hits += 1
  }
  return hits >= 1 && hits / latinWords.length >= 0.6
}
