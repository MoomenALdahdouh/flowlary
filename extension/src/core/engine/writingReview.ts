import { WRITING_REVIEW_MAX_SNIPPET, type WritingReviewPacket, type WritingReviewResponse } from '@flowlary/shared'
import { endsWithSentenceBoundary, endsWithWordBoundary } from '../../features/correction/debounce.ts'
import type { FieldContext, SharedAnalysis } from './types.ts'
import { fieldHasSensitiveTokens, type ReviewIsland } from './reviewIsland.ts'

export const REVIEW_PAUSE_MS = 900
export const REVIEW_MIN_INTERVAL_MS = 2500

export type WritingReviewFn = (
  packet: WritingReviewPacket,
  options?: { signal?: AbortSignal },
) => Promise<WritingReviewResponse>

let reviewImpl: WritingReviewFn | null = null

export function setWritingReview(fn: WritingReviewFn | null): void {
  reviewImpl = fn
}

export function getWritingReview(): WritingReviewFn | null {
  return reviewImpl
}

export function resetWritingReviewForTests(): void {
  reviewImpl = null
}

export function shouldScheduleWritingReview(options: {
  context: FieldContext
  analysis: SharedAnalysis
  island: ReviewIsland | null
  localAppliedLayout: boolean
  cached: boolean
  lastReviewAt: number
  now?: number
}): boolean {
  const { context, analysis, island, localAppliedLayout, cached } = options
  const now = options.now ?? Date.now()
  if (!context.assistantEnabled || context.helpStyle === 'shortcuts_only') return false
  if (!context.correctionEnabled || context.aiWritingReviewEnabled === false) return false
  if (!context.safetyAllowed || context.composing || context.mutexHeld) return false
  if (context.editorTier > 2) return false
  if (context.inputSource === 'paste' || context.inputSource === 'drop') return false
  if (context.selection && context.selection.end > context.selection.start) return false
  if (localAppliedLayout) return false
  if (fieldHasSensitiveTokens(analysis)) return false
  if (!island) return false
  if (analysis.openToken && island.range.start < analysis.openToken.end && analysis.openToken.start < island.range.end) {
    return false
  }
  if (cached) return false
  if (now - options.lastReviewAt < REVIEW_MIN_INTERVAL_MS) return false
  return true
}

export function reviewFiresImmediately(text: string): boolean {
  return endsWithSentenceBoundary(text)
}

export function reviewEligibleAfterPause(text: string): boolean {
  return endsWithWordBoundary(text) || endsWithSentenceBoundary(text)
}

export function buildReviewPacket(
  context: FieldContext,
  island: ReviewIsland,
): WritingReviewPacket {
  return {
    cycleId: context.cycleId,
    snippet: island.snippet.slice(0, WRITING_REVIEW_MAX_SNIPPET),
    contextBefore: island.contextBefore,
    contextAfter: island.contextAfter,
    allowedKinds: ['spelling', 'grammar', 'punctuation', 'layout_suspect'],
  }
}
