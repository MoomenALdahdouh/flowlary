/**
 * Explicit English assist. Automatic language review lives in scheduleFieldWritingReview.
 * Never auto-writes LLM output and never falls back to whole-field correction.
 */
import { applyInstantSpellingIfSafe } from '../../features/correction/instantSpell.ts'
import { evaluateFieldSafety } from '../safety/index.ts'
import { readFieldText } from '../dom/read.ts'
import { resolveWritingPolicy } from '../policy/writingPolicy.ts'
import { stateManager } from '../state/StateManager.ts'
import type { TextOrigin, TextRange } from '../engine/types.ts'
import type { EditableElement } from '../dom/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import { commitWriteTransaction } from './writeGate.ts'
import { analyzeFieldText } from '../engine/chunks.ts'
import { collectHypotheses } from '../engine/hypotheses.ts'
import { buildFieldContext } from '../engine/context.ts'
import { extractReviewIsland } from '../engine/reviewIsland.ts'
import { ingestReviewEdits } from '../engine/ingestReviewEdits.ts'
import { buildReviewPacket, getWritingReview } from '../engine/writingReview.ts'

export type PipelineCorrectFn = (
  requestId: string,
  text: string,
  fieldType?: string,
  previousText?: string,
  signal?: AbortSignal,
) => Promise<unknown>

/** @deprecated Whole-field LLM correction is retired. Kept so tests do not resurrect it. */
export function setPipelineCorrectFnForTests(_fn: PipelineCorrectFn | null): void {}

export function setPipelineEnglishDebounceMsForTests(_ms: number | null): void {}

export function resetPipelineEnglishForTests(): void {
  setPipelineCorrectFnForTests(null)
}

/**
 * Absorbed by the enforce pipeline's scheduleFieldWritingReview.
 */
export function scheduleRemoteEnglishAssist(
  _element: EditableElement,
  _session: FieldSession,
  _range: TextRange,
  _generation: number,
  _textOrigin: TextOrigin,
): void {
  return
}

export async function runExplicitEnglishAssist(
  element: EditableElement,
  session: FieldSession,
): Promise<'applied' | 'noop' | 'stale' | 'blocked'> {
  const policy = resolveWritingPolicy()
  if (!policy.improveEnglish) return 'noop'

  const generation = session.getGeneration()
  const text = readFieldText(element)
  const hostname = typeof location !== 'undefined' ? location.hostname : ''
  const safety = evaluateFieldSafety(element, {
    hostname,
    excludedDomains: stateManager.settings.excludedDomains,
    text,
  })
  if (!safety.allowed) return 'blocked'

  const instant = applyInstantSpellingIfSafe(text)
  if (instant !== text) {
    return writeExplicitEnglishSpan(element, session, generation, 0, text.length, instant, 'original_en')
  }

  const reviewFn = getWritingReview()
  if (reviewFn) {
    const context = buildFieldContext({
      element,
      session,
      cycleId: `ex-review-${generation}`,
      composing: false,
      textLength: text.length,
    })
    const analysis = analyzeFieldText(text, { caret: text.length, commitOpenToken: true })
    const island = extractReviewIsland(text, text.length, analysis)
    if (island) {
      try {
        const review = await reviewFn(buildReviewPacket(context, island))
        if (session.getGeneration() !== generation || readFieldText(element) !== text) return 'stale'
        if (review.verdict === 'edits') {
          const hypotheses = collectHypotheses(text, text.length, context, analysis)
          const extra = ingestReviewEdits(review.edits, island, analysis, context, hypotheses)
          const picked = extra[0]
          if (!picked?.replacement) return 'noop'
          return writeExplicitEnglishSpan(
            element,
            session,
            generation,
            picked.span.start,
            picked.span.end,
            picked.replacement,
            'original_en',
          )
        }
        if (review.verdict === 'no_change' || review.verdict === 'preserve_all' || review.verdict === 'uncertain') {
          return 'noop'
        }
      } catch {
        return 'noop'
      }
    }
  }

  return 'noop'
}

function writeExplicitEnglishSpan(
  element: EditableElement,
  session: FieldSession,
  generation: number,
  start: number,
  end: number,
  replacement: string,
  textOrigin: TextOrigin,
): 'applied' | 'stale' | 'blocked' {
  const acquired = session.tryAcquireWrite('CORRECT')
  if (!acquired.ok) return 'blocked'
  if (session.getGeneration() !== generation) {
    session.releaseWrite('CORRECT', acquired.requestId)
    return 'stale'
  }
  const write = commitWriteTransaction(element, start, end, replacement, {
    session,
    requestId: acquired.requestId,
    expectedGeneration: acquired.generation,
    cycleGeneration: generation,
    origin: 'CORRECT',
    auto: false,
    engineOriginated: false,
    capability: 'correction',
    trigger: 'shortcut',
    textOrigin,
    action: 'english_correction',
    tagTranslated: false,
    allowActiveEdit: true,
  })
  session.releaseWrite('CORRECT', acquired.requestId)
  return write.verdict === 'written' ? 'applied' : write.verdict === 'stale' ? 'stale' : 'blocked'
}
