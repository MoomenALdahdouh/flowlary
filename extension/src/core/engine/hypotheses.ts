/**
 * Span-level hypothesis generation. Local evidence only.
 * Replacements come only from mapLayout / approved spelling helpers.
 */
import { liveTranslateSegment } from '../../features/translation/segments.ts'
import { isInsideMarkdownCode } from '../safety/markdown.ts'
import { tokenizeText } from '../safety/tokenize.ts'
import { isEligibleForCorrection, shouldShowEnglishAssistant } from '../../features/correction/language.ts'
import { endsWithSentenceBoundary } from '../../features/correction/debounce.ts'
import { isEnglishWord } from '../../features/layout/layouts/lexicons/en-words.ts'
import { isPairedShortLatinToken, isTechnicalToken, looksLikeTitleCaseToken } from './technicalTokens.ts'
import { suggestSpelling } from './contextualSpell.ts'
import { layoutSpanUnsafeForAutoWrite } from './mixedLayoutSafety.ts'
import type {
  Evidence,
  FieldContext,
  Hypothesis,
  LayoutSpanInference,
  SharedAnalysis,
  SpanRole,
  WritingChunk,
} from './types.ts'

function overlaps(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start < right.end && right.start < left.end
}

function tokenOf(text: string, chunk: WritingChunk): string {
  return text.slice(chunk.range.start, chunk.range.end)
}

function previousToken(text: string, chunks: WritingChunk[], index: number): string {
  for (let i = index - 1; i >= 0; i -= 1) {
    const token = tokenOf(text, chunks[i]!)
    if (/\p{L}/u.test(token)) return token
  }
  return ''
}

function nextToken(text: string, chunks: WritingChunk[], index: number): string {
  for (let i = index + 1; i < chunks.length; i += 1) {
    const token = tokenOf(text, chunks[i]!)
    if (/\p{L}/u.test(token)) return token
  }
  return ''
}

let nextHyp = 1
function hyp(partial: Omit<Hypothesis, 'id' | 'conflicts'>): Hypothesis {
  return { ...partial, id: `h${nextHyp++}`, conflicts: [] }
}

export function resetHypothesisIdsForTests(): void {
  nextHyp = 1
}

function mergeEvidence(into: Hypothesis, from: Hypothesis): void {
  for (const entry of from.evidence) {
    if (!into.evidence.some((existing) => existing.kind === entry.kind && existing.weight === entry.weight)) {
      into.evidence.push(entry)
    }
  }
  if (from.localScore > into.localScore) into.localScore = from.localScore
  if (from.risk === 'low' && into.risk !== 'low') into.risk = from.risk
  if (!from.needsLLM) into.needsLLM = false
}

function dedupeHypotheses(items: Hypothesis[]): Hypothesis[] {
  const order: Hypothesis[] = []
  const byKey = new Map<string, Hypothesis>()
  for (const item of items) {
    const key = `${item.span.start}:${item.span.end}:${item.intent}:${item.candidateAction ?? ''}:${item.replacement ?? ''}`
    const existing = byKey.get(key)
    if (existing) {
      mergeEvidence(existing, item)
      continue
    }
    byKey.set(key, item)
    order.push(item)
  }
  return order
}

function linkConflicts(items: Hypothesis[]): Hypothesis[] {
  for (const left of items) {
    for (const right of items) {
      if (left.id === right.id) continue
      if (!overlaps(left.span, right.span)) continue
      if (left.intent === right.intent && left.candidateAction === right.candidateAction) continue
      if (
        (left.candidateAction && right.candidateAction && left.candidateAction !== right.candidateAction)
        || (left.intent !== right.intent && (left.candidateAction || right.candidateAction))
      ) {
        if (!left.conflicts.includes(right.id)) left.conflicts.push(right.id)
      }
    }
  }
  return items
}

function layoutHypothesisFromSpan(
  span: LayoutSpanInference,
  analysis: SharedAnalysis,
  text: string,
): Hypothesis {
  const source = text.slice(span.range.start, span.range.end)
  const shiftedLetterGlyph = /^[÷×]$/.test(source)
  const short = span.consecutiveCount === 1 && (span.range.end - span.range.start) <= 2 && !shiftedLetterGlyph
  const sourceIsLatin = /[A-Za-z]/.test(source) && !/[\u0600-\u06FF]/.test(source)
  const latinToArabicInEnglish = span.direction === 'ar_on_en'
    && sourceIsLatin
    && analysis.chunks.some((chunk) => chunk.role === 'english_prose' && !overlaps(chunk.range, span.range))
  const mixUnsafe = latinToArabicInEnglish || layoutSpanUnsafeForAutoWrite(span, analysis.chunks, text)
  const neighborAlreadyEnglish = analysis.chunks.some((chunk) =>
    chunk.role === 'english_prose' && !overlaps(chunk.range, span.range),
  )
  const mappedEnglish = Boolean(span.replacement && isEnglishWord(span.replacement))
  const leftoverKnownEnglish = !mixUnsafe && !short && neighborAlreadyEnglish && mappedEnglish && span.mappingCoverage >= 0.7
  const strong = (span.risk === 'low' || leftoverKnownEnglish) && !short && !mixUnsafe
  return hyp({
    span: span.range,
    intent: 'fix_layout',
    candidateAction: 'layout_fix',
    replacementSource: 'map_layout',
    replacement: span.replacement,
    localScore: mixUnsafe
      ? Math.min(span.heuristicScore, 0.45)
      : leftoverKnownEnglish
        ? Math.max(span.heuristicScore, 0.72)
        : span.heuristicScore,
    evidence: [
      { kind: 'physical_key_map', weight: span.mappingCoverage },
      { kind: 'language_plausibility', weight: span.languagePlausibility },
      { kind: 'sequence_agreement', weight: span.consecutiveCount },
      { kind: 'mapping_coverage', weight: span.mappingCoverage },
      { kind: 'neighbor_context', weight: span.neighborAgreement },
      ...(span.lexiconBonus > 0 ? [{ kind: 'lexicon_ar' as const, weight: span.lexiconBonus }] : []),
      ...(short ? [{ kind: 'short_token' as const }] : []),
      ...(mixUnsafe ? [{ kind: 'script_mix' as const }] : []),
    ],
    risk: mixUnsafe || short ? 'high' : leftoverKnownEnglish ? 'low' : span.risk,
    needsLLM: !strong,
    sourceChunkIds: span.sourceChunkIds,
  })
}

function spellingHypothesis(
  token: string,
  chunk: WritingChunk,
  previous: string,
  next = '',
  openToken: { start: number; end: number } | null = null,
): Hypothesis | null {
  if (chunk.protectedKind) return null
  if (chunk.role === 'arabizi' || chunk.role === 'arabic_prose') return null
  if (chunk.role === 'technical_token' || chunk.role === 'intentional_foreign_token') return null
  if (chunk.scripts.latin === 0) return null
  const suggestion = suggestSpelling(token, previous)
  if (!suggestion) return null
  if (
    (chunk.role === 'possible_layout_error' || chunk.layoutSuspicion !== 'none')
    && suggestion.source !== 'instant_spell'
    && suggestion.distance > 1
  ) {
    return null
  }
  if (chunk.letterCount <= 3 && !/[A-Za-z]{2,}/.test(previous) && !/[A-Za-z]{2,}/.test(next)) {
    return null
  }
  const known = suggestion.source === 'instant_spell'
  const open = Boolean(openToken && overlaps(chunk.range, openToken))
  return hyp({
    span: chunk.range,
    intent: 'fix_english',
    candidateAction: 'english_correction',
    replacementSource: suggestion.source,
    replacement: suggestion.replacement,
    localScore: known ? 0.8 : 0.55,
    evidence: [
      { kind: known ? 'lexicon_en' : 'edit_distance' },
      ...(!known ? [{ kind: 'neighbor_context' as const }] : []),
    ],
    risk: open ? 'high' : known ? 'low' : 'medium',
    needsLLM: open || !known,
    sourceChunkIds: [chunk.id],
  })
}

function preserveHypothesis(chunk: WritingChunk, intent: Hypothesis['intent'], evidence: Evidence[]): Hypothesis {
  return hyp({
    span: chunk.range,
    intent,
    candidateAction: null,
    replacementSource: 'none',
    localScore: 0.9,
    evidence,
    risk: 'low',
    needsLLM: false,
    sourceChunkIds: [chunk.id],
  })
}

function writeAsIs(chunk: WritingChunk, score = 0.6): Hypothesis {
  return hyp({
    span: chunk.range,
    intent: chunk.role === 'unknown' ? 'unknown' : 'write_as_is',
    candidateAction: null,
    replacementSource: 'none',
    localScore: score,
    evidence: [{ kind: 'script_mix' }],
    risk: 'low',
    needsLLM: chunk.role === 'unknown',
    sourceChunkIds: [chunk.id],
  })
}

function incompleteTokenRange(text: string, caret: number): { start: number; end: number } | null {
  if (caret <= 0 || caret > text.length) return null
  if (/\s/.test(text[caret - 1] ?? '')) return null
  const { tokens } = tokenizeText(text)
  const active = tokens.find((span) => span.rawStart <= caret && caret <= span.rawEnd)
  if (!active) return null
  const closed = Boolean(active.delimiter?.trim()) || /\s/.test(text[active.rawEnd] ?? '')
  if (closed && caret >= active.rawEnd) return null
  return { start: active.rawStart, end: active.rawEnd }
}

function mergeStrongLayoutHypotheses(text: string, items: Hypothesis[]): Hypothesis | null {
  const layout = items
    .filter((item) =>
      item.intent === 'fix_layout'
      && Boolean(item.replacement)
      && item.risk === 'low'
      && !item.needsLLM,
    )
    .sort((a, b) => a.span.start - b.span.start)
  if (layout.length < 2) return null
  const picked: Hypothesis[] = []
  for (const item of layout) {
    if (picked.some((prev) => overlaps(prev.span, item.span))) continue
    picked.push(item)
  }
  if (picked.length < 2) return null
  const start = picked[0]!.span.start
  const end = picked[picked.length - 1]!.span.end
  let cursor = start
  let replacement = ''
  for (const item of picked) {
    replacement += text.slice(cursor, item.span.start) + item.replacement
    cursor = item.span.end
  }
  replacement += text.slice(cursor, end)
  if (!replacement || replacement === text.slice(start, end)) return null
  return hyp({
    span: { start, end },
    intent: 'fix_layout',
    candidateAction: 'layout_fix',
    replacementSource: 'map_layout',
    replacement,
    localScore: Math.min(0.95, Math.max(...picked.map((item) => item.localScore)) + 0.03),
    evidence: [
      { kind: 'sequence_agreement', weight: picked.length },
      { kind: 'physical_key_map', weight: 1 },
      { kind: 'mapping_coverage', weight: 1 },
    ],
    risk: 'low',
    needsLLM: false,
    sourceChunkIds: [...new Set(picked.flatMap((item) => item.sourceChunkIds))],
  })
}

export function collectHypotheses(
  text: string,
  caret: number,
  context: FieldContext,
  analysis: SharedAnalysis,
): Hypothesis[] {
  const items: Hypothesis[] = []
  const mixed = analysis.chunks.some((chunk) => chunk.scripts.arabic > 0)
    && analysis.chunks.some((chunk) => chunk.scripts.latin > 0)

  if (context.layoutAuto) {
    const unfinished = incompleteTokenRange(text, caret)
    for (const span of analysis.layoutSpans) {
      if (unfinished && overlaps(span.range, unfinished)) continue
      const covered = analysis.chunks.filter((chunk) => overlaps(chunk.range, span.range) || span.sourceChunkIds.includes(chunk.id))
      if (covered.some((chunk) => chunk.role === 'user_override' || chunk.protectedKind || chunk.inExceptionList)) {
        continue
      }
      if (
        covered.length > 0
        && covered.every((chunk) => (
          (chunk.role === 'arabic_prose' || chunk.role === 'english_prose')
          && chunk.layoutSuspicion === 'none'
          && span.mappingCoverage < 0.7
        ))
      ) {
        continue
      }
      items.push(layoutHypothesisFromSpan(span, analysis, text))
    }
    const merged = mergeStrongLayoutHypotheses(text, items)
    if (merged) items.push(merged)
  }

  analysis.chunks.forEach((chunk, index) => {
    const token = tokenOf(text, chunk)
    if (!token) return

    if (chunk.role === 'user_override') {
      items.push(preserveHypothesis(chunk, 'user_override', [{ kind: 'user_override' }]))
      return
    }
    if (chunk.role === 'translated_output') {
      if (context.polishAfterTranslate && context.correctionEnabled) {
        const spelling = spellingHypothesis(
          token,
          chunk,
          previousToken(text, analysis.chunks, index),
          nextToken(text, analysis.chunks, index),
          analysis.openToken,
        )
        if (spelling) items.push(spelling)
      }
      items.push(preserveHypothesis(chunk, 'preserve', [{ kind: 'protected_span' }]))
      return
    }
    if (
      chunk.protectedKind
      || chunk.role === 'protected'
      || chunk.role === 'url'
      || chunk.role === 'email'
      || chunk.role === 'code'
      || chunk.role === 'identifier'
      || chunk.role === 'number'
    ) {
      items.push(preserveHypothesis(chunk, 'preserve', [{ kind: 'protected_span' }]))
      return
    }
    if (
      chunk.role === 'technical_token'
      || chunk.role === 'intentional_foreign_token'
      || isTechnicalToken(token)
      || looksLikeTitleCaseToken(token)
      || isPairedShortLatinToken(token, [
        previousToken(text, analysis.chunks, index),
        tokenOf(text, analysis.chunks[index + 1] ?? chunk),
      ].filter((item) => item && item !== token))
    ) {
      items.push(preserveHypothesis(chunk, 'preserve', [{ kind: 'technical_shape' }]))
    }
    if (chunk.role === 'arabizi') {
      items.push(preserveHypothesis(chunk, 'write_as_is', [{ kind: 'uncertainty' }]))
    }

    if (context.correctionEnabled && chunk.role !== 'arabizi') {
      const spelling = spellingHypothesis(
        token,
        chunk,
        previousToken(text, analysis.chunks, index),
        nextToken(text, analysis.chunks, index),
        analysis.openToken,
      )
      if (spelling) items.push(spelling)
    }

    if (chunk.role === 'arabic_prose' || chunk.role === 'english_prose' || chunk.role === 'unknown' || chunk.role === 'punctuation') {
      items.push(writeAsIs(chunk, chunk.role === 'unknown' ? 0.4 : 0.7))
    } else if (
      !items.some((item) => item.sourceChunkIds.includes(chunk.id) && item.intent === 'preserve')
    ) {
      items.push(writeAsIs(chunk))
    }
  })

  if (context.arabicToEnglishMode && context.translationPauseReady) {
    const sentence = liveTranslateSegment(text, caret, context.translatedRanges)
    if (
      sentence
      && /[\u0600-\u06FF]/.test(sentence.text)
      && !isInsideMarkdownCode(text, sentence.start)
    ) {
      const covered = analysis.chunks.filter((chunk) => overlaps(chunk.range, sentence))
      const unknownLatin = covered.some((chunk) =>
        chunk.scripts.latin > 0
        && chunk.scripts.arabic === 0
        && chunk.role !== 'technical_token'
        && chunk.role !== 'intentional_foreign_token'
        && chunk.role !== 'protected'
        && chunk.role !== 'url'
        && chunk.role !== 'email'
        && chunk.role !== 'identifier'
        && chunk.role !== 'code'
        && chunk.role !== 'punctuation'
        && chunk.role !== 'number'
        && chunk.role !== 'possible_layout_error',
      )
      const sessionReady = Boolean(context.translationSessionId)
      items.push(hyp({
        span: { start: sentence.start, end: sentence.end },
        intent: 'translate',
        candidateAction: 'translation',
        replacementSource: 'none',
        localScore: sessionReady ? (unknownLatin ? 0.45 : 0.8) : 0.4,
        evidence: [
          { kind: 'sentence_stable' },
          ...((unknownLatin || mixed) ? [{ kind: 'uncertainty' as const }] : []),
        ],
        risk: unknownLatin ? 'high' : 'low',
        needsLLM: unknownLatin,
        sourceChunkIds: covered.map((chunk) => chunk.id),
      }))
    }
  }

  if (context.inputSource === 'paste' || context.inputSource === 'drop') {
    items.push(hyp({
      span: { start: 0, end: text.length },
      localScore: 0.95,
      intent: 'preserve',
      candidateAction: null,
      replacementSource: 'none',
      evidence: [{ kind: 'paste' }],
      risk: 'low',
      needsLLM: false,
      sourceChunkIds: analysis.chunks.map((chunk) => chunk.id),
    }))
  }

  const hasLocalEnglish = items.some((item) => item.intent === 'fix_english' && item.replacement)
  if (
    context.correctionEnabled
    && !hasLocalEnglish
    && !analysis.hasLayoutSuspicion
    && !analysis.hasArabizi
    && !analysis.hasAmbiguousMixed
    && analysis.dominantOrigin !== 'translated_en'
    && endsWithSentenceBoundary(text)
    && shouldShowEnglishAssistant(text)
    && isEligibleForCorrection(text)
  ) {
    items.push(hyp({
      span: { start: 0, end: text.length },
      intent: 'fix_english',
      candidateAction: 'english_correction',
      replacementSource: 'none',
      localScore: 0.4,
      evidence: [{ kind: 'sentence_stable' }, { kind: 'uncertainty' }],
      risk: 'medium',
      needsLLM: true,
      sourceChunkIds: analysis.chunks.map((chunk) => chunk.id),
    }))
  }

  if (context.selection && context.selection.end > context.selection.start) {
    items.push(hyp({
      span: context.selection,
      intent: 'unknown',
      candidateAction: null,
      replacementSource: 'none',
      localScore: 0.5,
      evidence: [{ kind: 'selection' }],
      risk: 'low',
      needsLLM: false,
      sourceChunkIds: analysis.chunks
        .filter((chunk) => overlaps(chunk.range, context.selection!))
        .map((chunk) => chunk.id),
    }))
  }

  return linkConflicts(dedupeHypotheses(items))
}

export function roleSummary(chunks: WritingChunk[]): SpanRole[] {
  return chunks.map((chunk) => chunk.role)
}
