import type { CommandResult } from '@flowlary/shared'
import type { InputEngine } from '../input/InputEngine.ts'
import { resolveCommandTarget } from '../input/resolveTarget.ts'
import { analyzeFieldText } from '../engine/chunks.ts'
import { candidatesFromHypotheses } from '../engine/candidates.ts'
import { collectHypotheses } from '../engine/hypotheses.ts'
import { consultAdvisor, getAdvisorApplyMode, shouldConsultAdvisor } from '../engine/advisor.ts'
import { buildFieldContext } from '../engine/context.ts'
import { decideWriting } from '../engine/decide.ts'
import { recordWritingAnalytics } from '../observability/writingAnalytics.ts'
import { isEditableElement, readCaret, readFieldText, readSelectionRange } from '../dom/read.ts'
import { resolveWritingPolicy } from '../policy/writingPolicy.ts'
import { stateManager } from '../state/StateManager.ts'
import { commitWriteTransaction, writerForAction } from './writeGate.ts'
import { fulfillTranslationDecision } from './pipelineTranslate.ts'
import {
  hidePipelineSuggestion,
  invalidateStalePipelineSuggestion,
  presentPipelineSuggestion,
} from './pipelineSuggest.ts'
import type { EditableElement } from '../dom/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import type {
  AdvisorVote,
  CandidateAction,
  FieldContext,
  Hypothesis,
  LlmAdvisorResult,
  SharedAnalysis,
  WritingDecision,
} from '../engine/types.ts'
import { recordWritingFeedback } from '../engine/writingFeedback.ts'
import { hashWritingSample, parseWritingReviewContent } from '@flowlary/shared'
import { extractReviewIsland } from '../engine/reviewIsland.ts'
import { ingestReviewEdits } from '../engine/ingestReviewEdits.ts'
import {
  REVIEW_PAUSE_MS,
  buildReviewPacket,
  getWritingReview,
  reviewEligibleAfterPause,
  reviewFiresImmediately,
  shouldScheduleWritingReview,
} from '../engine/writingReview.ts'

let cycle = 0

export type CycleOutcome = 'applied' | 'noop' | 'suggestion' | 'stale' | 'blocked'

function recordShadowAdvisorCompare(options: {
  baseline: WritingDecision
  advised: WritingDecision
  advisorVote: AdvisorVote | null
  advisorResult: LlmAdvisorResult
  context: FieldContext
  hypotheses: Hypothesis[]
  durationMs: number
}): void {
  const { baseline, advised, advisorVote, advisorResult, context, hypotheses, durationMs } = options
  if (advisorResult === 'unused') return
  recordWritingAnalytics({
    name: 'writing.shadow_compare',
    action: baseline.action,
    trigger: 'auto',
    outcome: 'shadow_only',
    textOrigin: baseline.textOrigin,
    reasonCodes: [`baseline:${baseline.action}`, `advised:${advised.action}`, `llm:${advisorResult}`],
    shadowOnly: true,
    llmUsed: advisorResult === 'ranked',
    llmResult: advisorResult,
    selectedIntent: baseline.selectedIntent,
  })
  recordWritingAnalytics({
    name: 'writing.advisor_shadow',
    action: advised.action,
    trigger: 'auto',
    outcome: 'shadow_only',
    textOrigin: advised.textOrigin,
    reasonCodes: [
      `cycle:${context.cycleId}`,
      `hyps:${hypotheses.length}`,
      `ranked:${advisorVote?.rankedHypothesisIds.join(',') ?? ''}`,
      `baseline:${baseline.action}`,
      `advised:${advised.action}`,
      `llm:${advisorResult}`,
    ],
    shadowOnly: true,
    llmUsed: advisorResult === 'ranked',
    llmResult: advisorResult,
    selectedIntent: advised.selectedIntent,
    winnerHypothesisId: advised.winnerHypothesisId,
    durationMs,
  })
}

const ARABIC_LETTER = /[\u0600-\u06FF]/

export async function runWritingPipeline(
  engine: InputEngine,
  target?: Element | null,
): Promise<CommandResult> {
  const seed = target ?? engine.getActiveElement() ?? document.activeElement
  const resolved = resolveCommandTarget(seed)
  if (!resolved || !isEditableElement(resolved.element)) {
    return { ok: false, operation: 'PIPELINE', error: 'no_target' }
  }

  const session = engine.sessions.getOrCreate(resolved.element)
  const result = await runFieldCycle(resolved.element, session)
  return {
    ok: result === 'applied' || result === 'noop' || result === 'suggestion',
    operation: 'PIPELINE',
    data: result,
  }
}

export async function runFieldCycle(
  element: EditableElement,
  session: FieldSession,
): Promise<CycleOutcome> {
  const policy = resolveWritingPolicy()
  if (policy.arabicToEnglishMode && !session.isTranslationPaused()) {
    session.ensureTranslationSession()
  } else {
    session.endTranslationSession()
  }

  const generation = session.getGeneration()
  const context = buildFieldContext({
    element,
    session,
    cycleId: `en-${++cycle}`,
    composing: session.isComposing(),
    textLength: 0,
  })

  if (session.getGeneration() !== generation) return 'stale'

  const text = readFieldText(element)
  context.textLength = text.length
  session.pruneTranslatedTags(text)
  session.pruneCorrectedTags(text)
  session.detectUserOverride(text)
  session.pruneOverrideRanges(text)
  if (session.getInputSource() === 'paste' || session.getInputSource() === 'drop') {
    session.clearPendingLayoutRun()
  }
  if (session.getOverrideRanges().length > 0) {
    recordWritingFeedback({
      tokenHash: 'override',
      action: 'user_edit',
      outcome: 'override',
    })
  }
  context.selection = readSelectionRange(element)
  const caret = document.activeElement === element
    ? (readCaret(element) ?? text.length)
    : text.length
  const commitOpenToken = session.consumeCommitOpenToken()
  const started = typeof performance !== 'undefined' ? performance.now() : 0
  const analysis = analyzeFieldText(text, {
    overrideRanges: [...session.getOverrideRanges()],
    translatedRanges: [...session.getTranslatedRanges()],
    correctedRanges: [...session.getCorrectedRanges()],
    exceptions: [...stateManager.personalExceptions],
    vocabularyHashes: [...stateManager.vocabularyHashes],
    caret,
    commitOpenToken,
    pendingLayoutRun: session.getPendingLayoutRun(text, caret),
  })
  if (session.hasTranslatedOverlap(0, text.length)) {
    if (!ARABIC_LETTER.test(text)) analysis.dominantOrigin = 'translated_en'
  }

  const hypotheses = collectHypotheses(text, caret, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses, context).filter((item) => {
    if (item.capability !== 'translation') return true
    return !session.hasTranslatedOverlap(item.range.start, item.range.end)
  })
  const baseline = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
    advisorResult: 'unused',
  })
  const localDecisionMs = typeof performance !== 'undefined' ? Math.round(performance.now() - started) : 0
  const decision = baseline
  let localOutcome: CycleOutcome = 'noop'

  if (shouldConsultAdvisor(hypotheses, context, analysis)) {
    recordWritingAnalytics({
      name: 'writing.advisor_consult',
      action: baseline.action,
      trigger: 'auto',
      outcome: 'shadow_only',
      textOrigin: baseline.textOrigin,
      reasonCodes: [`cycle:${context.cycleId}`, `hyps:${hypotheses.length}`],
      shadowOnly: true,
      llmUsed: false,
      llmResult: 'unused',
      selectedIntent: baseline.selectedIntent,
    })
    const generationRequest = session.beginGenerationRequest(generation)
    const advisorPromise = consultAdvisor(context, hypotheses, {
      text,
      analysis,
      generation,
      signal: generationRequest.signal,
    }).finally(generationRequest.release)

    void advisorPromise.then((consulted) => {
      if (session.getGeneration() !== generation) return
      if (readFieldText(element) !== text) return
      let vote = consulted.vote
      let result = consulted.result
      if (session.getGeneration() !== generation) {
        vote = null
        result = 'stale'
      }
      const advised = decideWriting(context, analysis, candidates, {
        observeOnly: false,
        hypotheses,
        advisorVote: vote,
        advisorResult: result,
      })
      recordShadowAdvisorCompare({
        baseline,
        advised,
        advisorVote: vote,
        advisorResult: result,
        context,
        hypotheses,
        durationMs: typeof performance !== 'undefined' ? Math.round(performance.now() - started) : 0,
      })
      // Apply mode may surface a suggestion from ranked IDs. It must never
      // auto-write layout, translation, or English on a later tick.
      if (getAdvisorApplyMode() !== 'apply' || !vote) return
      if (session.getGeneration() !== generation) return
      if (readFieldText(element) !== text) return
      if (advised.action !== 'suggestion') return
      const winner = candidates.find((item) => item.id === advised.winnerCandidateId)
      const replacement = winner?.replacement
      const range = advised.range ?? winner?.range
      if (!replacement || !range) return
      presentPipelineSuggestion({
        fieldId: session.field.id,
        element,
        session,
        generation,
        range,
        sourceText: text.slice(range.start, range.end),
        suggestion: replacement,
        action: winner?.capability === 'layout_fix' ? 'layout_fix' : 'english_correction',
        textOrigin: advised.textOrigin,
      })
    })
  }

  const decisionMs = localDecisionMs

  recordWritingAnalytics({
    name: 'writing.decision',
    action: decision.action,
    trigger: decision.trigger,
    outcome:
      decision.action === 'noop'
        ? 'noop'
        : decision.action === 'suggestion'
          ? 'suggestion'
          : 'applied',
    textOrigin: decision.textOrigin,
    reasonCodes: decision.reasonCodes,
    shadowOnly: false,
    decisionId: decision.decisionId,
    selectedIntent: decision.selectedIntent,
    winnerHypothesisId: decision.winnerHypothesisId,
    risk: decision.risk,
    llmUsed: decision.llmUsed,
    llmResult: decision.llmResult,
    durationMs: decisionMs,
  })

  const fulfilled = fulfillWritingDecision({
    element,
    session,
    generation,
    text,
    analysis,
    candidates,
    decision,
    commitOpenToken,
  })
  localOutcome = fulfilled instanceof Promise ? await fulfilled : fulfilled
  scheduleFieldWritingReview({
    element,
    session,
    generation,
    text,
    caret,
    context,
    analysis,
    hypotheses,
    localAppliedLayout: localOutcome === 'applied' && decision.action === 'layout_fix',
  })
  return localOutcome
}

export function fulfillWritingDecision(options: {
  element: EditableElement
  session: FieldSession
  generation: number
  text: string
  analysis: SharedAnalysis
  candidates: CandidateAction[]
  decision: WritingDecision
  commitOpenToken: boolean
}): CycleOutcome | Promise<CycleOutcome> {
  const { element, session, generation, text, analysis, candidates, decision, commitOpenToken } = options
  if (session.getGeneration() !== generation) return 'stale'
  if (readFieldText(element) !== text) return 'stale'
  invalidateStalePipelineSuggestion(session, text)

  if (decision.action === 'noop') return 'noop'

  const winner = candidates.find((item) => item.id === decision.winnerCandidateId)
  const replacement = winner?.replacement
  const range = decision.range ?? winner?.range

  if (decision.action === 'suggestion') {
    if (replacement && range) {
      presentPipelineSuggestion({
        fieldId: session.field.id,
        element,
        session,
        generation,
        range,
        sourceText: text.slice(range.start, range.end),
        suggestion: replacement,
        action: winner?.capability === 'layout_fix' ? 'layout_fix' : 'english_correction',
        textOrigin: decision.textOrigin,
      })
      return 'suggestion'
    }
    if (winner?.capability === 'english_correction' && range) {
      return 'suggestion'
    }
    return 'suggestion'
  }

  if (decision.action === 'translation') {
    hidePipelineSuggestion(session.field.id)
    if (!range) return 'noop'
    return fulfillTranslationDecision(element, session, range, generation)
  }

  if (decision.action === 'english_correction' && !replacement && range) {
    return 'suggestion'
  }

  if (!replacement || !range) return 'noop'

  if (
    !commitOpenToken
    && analysis.openToken
    && range.start < analysis.openToken.end
    && analysis.openToken.start < range.end
  ) {
    return 'noop'
  }

  const writer = writerForAction(decision.action)
  const acquired = session.tryAcquireWrite(writer)
  if (!acquired.ok) return 'blocked'

  if (session.getGeneration() !== generation) {
    session.releaseWrite(writer, acquired.requestId)
    return 'stale'
  }

  hidePipelineSuggestion(session.field.id)

  const neighborGuard = {
    before: text.slice(Math.max(0, range.start - 12), range.start),
    after: text.slice(range.end, Math.min(text.length, range.end + 12)),
  }

  const write = commitWriteTransaction(element, range.start, range.end, replacement, {
    session,
    requestId: acquired.requestId,
    expectedGeneration: acquired.generation,
    cycleGeneration: generation,
    origin: writer,
    auto: true,
    engineOriginated: true,
    capability: decision.action === 'layout_fix' ? 'layout' : 'correction',
    trigger: 'auto',
    textOrigin: decision.textOrigin,
    action: decision.action,
    tagTranslated: false,
    allowActiveEdit: true,
    commitOpenToken,
    requireCompletedToken: true,
    neighborGuard,
  })

  if (write.verdict !== 'written') {
    session.releaseWrite(writer, acquired.requestId)
    return write.verdict === 'stale' ? 'stale' : 'blocked'
  }
  if (decision.action === 'layout_fix') {
    const applied = analysis.layoutSpans.find((span) => (
      span.range.start === range.start && span.replacement === replacement
    )) ?? analysis.layoutSpans.find((span) => span.replacement === replacement)
    if (applied) {
      session.noteLayoutRun(applied.direction, range.start + replacement.length, applied.sourceChunkIds.length)
    }
  } else {
    session.clearPendingLayoutRun()
  }
  return 'applied'
}

function scheduleFieldWritingReview(input: {
  element: EditableElement
  session: FieldSession
  generation: number
  text: string
  caret: number
  context: FieldContext
  analysis: SharedAnalysis
  hypotheses: Hypothesis[]
  localAppliedLayout: boolean
}): void {
  const { element, session, generation, text, caret, context, analysis, hypotheses, localAppliedLayout } = input
  const island = extractReviewIsland(text, caret, analysis)
  const hash = island ? hashWritingSample(island.snippet) : ''
  if (!shouldScheduleWritingReview({
    context,
    analysis,
    island,
    localAppliedLayout,
    cached: Boolean(hash && session.hasCachedReview(hash)),
    lastReviewAt: session.getLastReviewAt(),
  })) {
    return
  }
  const fire = () => {
    if (Date.now() - session.getLastInputAt() < REVIEW_PAUSE_MS / 2 && !reviewFiresImmediately(text)) return
    void runWritingReviewCycle({
      element,
      session,
      generation,
      text,
      context,
      analysis,
      hypotheses,
      island: island!,
      hash,
    })
  }
  if (reviewFiresImmediately(text)) fire()
  else if (reviewEligibleAfterPause(text)) session.schedulePausedReview(fire, REVIEW_PAUSE_MS)
}

async function runWritingReviewCycle(input: {
  element: EditableElement
  session: FieldSession
  generation: number
  text: string
  context: FieldContext
  analysis: SharedAnalysis
  hypotheses: Hypothesis[]
  island: NonNullable<ReturnType<typeof extractReviewIsland>>
  hash: string
}): Promise<void> {
  const { element, session, generation, text, context, analysis, hypotheses, island, hash } = input
  const reviewFn = getWritingReview()
  if (!reviewFn) return
  if (session.getGeneration() !== generation || readFieldText(element) !== text) return
  if (text.slice(island.range.start, island.range.end) !== island.snippet) return
    session.noteReviewAttempt()
    recordWritingAnalytics({
    name: 'writing.review_consult',
    action: 'noop',
    trigger: 'auto',
    outcome: 'shadow_only',
    textOrigin: analysis.dominantOrigin,
    reasonCodes: [`cycle:${context.cycleId}`],
    shadowOnly: true,
  })
  const generationRequest = session.beginGenerationRequest(generation)
  try {
    const raw = await reviewFn(buildReviewPacket(context, island), { signal: generationRequest.signal })
    const parsed = parseWritingReviewContent(JSON.stringify(raw), island.snippet)
    if (!parsed.ok) {
      recordWritingAnalytics({
        name: 'writing.review_result',
        action: 'noop',
        trigger: 'auto',
        outcome: 'failed',
        textOrigin: analysis.dominantOrigin,
        reasonCodes: ['review_invalid', parsed.reason],
        shadowOnly: true,
      })
      return
    }
    const review = parsed.value
    if (
      session.getGeneration() !== generation
      || readFieldText(element) !== text
      || text.slice(island.range.start, island.range.end) !== island.snippet
    ) {
      recordWritingAnalytics({
        name: 'writing.review_result',
        action: 'noop',
        trigger: 'auto',
        outcome: 'stale',
        textOrigin: analysis.dominantOrigin,
        reasonCodes: ['review_stale'],
        shadowOnly: true,
      })
      return
    }
    session.cacheReview(hash)
    recordWritingAnalytics({
      name: 'writing.review_result',
      action: 'noop',
      trigger: 'auto',
      outcome: review.verdict === 'edits' ? 'suggestion' : 'noop',
      textOrigin: analysis.dominantOrigin,
      reasonCodes: [review.verdict, review.reasonCode],
      shadowOnly: true,
      llmUsed: true,
      llmResult: review.verdict === 'edits' ? 'ranked' : 'abstain',
    })
    if (review.verdict !== 'edits' || review.edits.length === 0) return
    const extra = ingestReviewEdits(review.edits, island, analysis, context, hypotheses)
    if (extra.length === 0) return
    const merged = [...hypotheses, ...extra]
    const candidates = candidatesFromHypotheses(merged, context)
    const advised = decideWriting(context, analysis, candidates, {
      observeOnly: false,
      hypotheses: merged,
      advisorResult: 'unused',
    })
    if (advised.action === 'noop') return
    fulfillWritingDecision({
      element,
      session,
      generation,
      text,
      analysis,
      candidates,
      decision: {
        ...advised,
        reasonCodes: [...advised.reasonCodes, 'review_candidate'],
      },
      commitOpenToken: false,
    })
  } catch {
    recordWritingAnalytics({
      name: 'writing.review_result',
      action: 'noop',
      trigger: 'auto',
      outcome: 'failed',
      textOrigin: analysis.dominantOrigin,
      reasonCodes: ['review_dropped'],
      shadowOnly: true,
    })
  } finally {
    generationRequest.release()
  }
}
