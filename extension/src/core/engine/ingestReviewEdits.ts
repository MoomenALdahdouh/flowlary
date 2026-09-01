import { mapLayout } from '../../features/layout/layouts/registry.ts'
import type { WritingReviewEdit } from '@flowlary/shared'
import { layoutSpanConflictsWithMixedIntent } from './mixedLayoutSafety.ts'
import type { FieldContext, Hypothesis, SharedAnalysis, TextRange } from './types.ts'
import type { ReviewIsland } from './reviewIsland.ts'

const KIND_RANK: Record<string, number> = {
  spelling: 0,
  grammar: 1,
  punctuation: 2,
}

const REVIEW_KINDS = new Set(['spelling', 'grammar', 'punctuation', 'layout_suspect'])

function overlaps(left: TextRange, right: TextRange): boolean {
  return left.start < right.end && right.start < left.end
}

function layoutRemapMatches(original: string, proposed: string): boolean {
  return (
    mapLayout(original, 'ar-101', 'en-US-qwerty') === proposed
    || mapLayout(original, 'en-US-qwerty', 'ar-101') === proposed
  )
}

export function pickReviewEdit(edits: WritingReviewEdit[]): WritingReviewEdit | null {
  const usable = edits.filter((edit) => REVIEW_KINDS.has(edit.kind))
  if (usable.length === 0) return null
  return [...usable].sort((a, b) => {
    const kind = (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9)
    if (kind !== 0) return kind
    if (a.confidence !== b.confidence) {
      return a.confidence === 'high' ? -1 : b.confidence === 'high' ? 1 : 0
    }
    return (a.end - a.start) - (b.end - b.start)
  })[0] ?? null
}

export function ingestReviewEdits(
  edits: WritingReviewEdit[],
  island: ReviewIsland,
  analysis: SharedAnalysis,
  context: FieldContext,
  existing: Hypothesis[],
): Hypothesis[] {
  const picked = pickReviewEdit(edits)
  if (!picked) return []
  const span = {
    start: island.range.start + picked.start,
    end: island.range.start + picked.end,
  }
  if (analysis.openToken && overlaps(span, analysis.openToken)) return []
  if (analysis.chunks.some((chunk) => (
    overlaps(chunk.range, span)
    && (
      chunk.role === 'user_override'
      || chunk.protectedKind
      || chunk.role === 'url'
      || chunk.role === 'email'
      || chunk.role === 'code'
      || chunk.role === 'identifier'
      || chunk.role === 'technical_token'
    )
  ))) {
    return []
  }
  if (layoutSpanConflictsWithMixedIntent(span, analysis.chunks)) return []
  if (existing.some((item) =>
    item.intent === 'user_override' && overlaps(item.span, span)
  )) {
    return []
  }
  if (existing.some((item) =>
    item.intent === 'fix_layout'
    && item.risk === 'low'
    && !item.needsLLM
    && overlaps(item.span, span)
  )) {
    return []
  }
  if (picked.kind === 'layout_suspect' && !layoutRemapMatches(picked.original, picked.proposed)) {
    return []
  }
  const autoEligible =
    context.helpStyle === 'auto'
    && island.monolingualEnglish
    && picked.confidence === 'high'
    && (picked.kind === 'spelling' || picked.kind === 'grammar' || picked.kind === 'punctuation')
    && context.capabilities.autoWrite
  return [{
    id: `review-${span.start}-${span.end}`,
    span,
    intent: picked.kind === 'layout_suspect' ? 'fix_layout' : 'fix_english',
    candidateAction: picked.kind === 'layout_suspect' ? 'layout_fix' : 'english_correction',
    replacementSource: picked.kind === 'layout_suspect' ? 'map_layout' : 'none',
    replacement: picked.proposed,
    localScore: autoEligible ? 0.85 : 0.55,
    evidence: [{ kind: 'sentence_stable' }, { kind: 'edit_distance' }],
    conflicts: [],
    risk: autoEligible ? 'low' : 'medium',
    needsLLM: false,
    sourceChunkIds: analysis.chunks.filter((chunk) => overlaps(chunk.range, span)).map((chunk) => chunk.id),
    reviewKind: picked.kind,
    reviewConfidence: picked.confidence,
  }]
}
