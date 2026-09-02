/**
 * Read-only translation pipeline probe for tests and targeted diagnostics.
 * Mirrors runFieldCycle decision inputs without writing or messaging.
 */
import { analyzeFieldText } from '../engine/chunks.ts'
import { candidatesFromHypotheses } from '../engine/candidates.ts'
import { collectHypotheses } from '../engine/hypotheses.ts'
import { buildFieldContext } from '../engine/context.ts'
import { decideWriting } from '../engine/decide.ts'
import { resolveWritingPolicy } from '../policy/writingPolicy.ts'
import { readCaret, readFieldText } from '../dom/read.ts'
import { stateManager } from '../state/StateManager.ts'
import type { EditableElement } from '../dom/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import type { Hypothesis, WritingDecision } from '../engine/types.ts'

export type TranslationPipelineProbe = {
  policy: ReturnType<typeof resolveWritingPolicy>
  translationLiveEnabled: boolean
  context: {
    arabicToEnglishMode: boolean
    translationSessionId: string | null
    translationPaused: boolean
    assistantEnabled: boolean
    helpStyle: string
    layoutAuto: boolean
    liveTranslation: boolean
  }
  hypotheses: Array<{
    intent: string
    localScore: number
    risk: string
    needsLLM: boolean
    range: { start: number; end: number } | null
  }>
  decision: Pick<WritingDecision, 'action' | 'reasonCodes' | 'winnerCandidateId' | 'range'>
}

export function probeTranslationPipeline(
  element: EditableElement,
  session: FieldSession,
  options: { ensureSession?: boolean } = {},
): TranslationPipelineProbe {
  const policy = resolveWritingPolicy()
  if (options.ensureSession !== false) {
    if (policy.arabicToEnglishMode && !session.isTranslationPaused()) {
      session.ensureTranslationSession()
    } else {
      session.endTranslationSession()
    }
  }

  const text = readFieldText(element)
  const caret =
    document.activeElement === element ? (readCaret(element) ?? text.length) : text.length
  const context = buildFieldContext({
    element,
    session,
    cycleId: 'probe',
    composing: session.isComposing(),
    textLength: text.length,
  })
  context.selection = null

  const analysis = analyzeFieldText(text, {
    overrideRanges: [...session.getOverrideRanges()],
    translatedRanges: [...session.getTranslatedRanges()],
    correctedRanges: [...session.getCorrectedRanges()],
    exceptions: [...stateManager.personalExceptions],
    vocabularyHashes: [...stateManager.vocabularyHashes],
    caret,
    commitOpenToken: false,
    pendingLayoutRun: session.getPendingLayoutRun(text, caret),
  })

  const hypotheses = collectHypotheses(text, caret, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses, context).filter((item) => {
    if (item.capability !== 'translation') return true
    return !session.hasTranslatedOverlap(item.range.start, item.range.end)
  })
  const decision = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
  })

  return {
    policy,
    translationLiveEnabled: stateManager.translation.liveEnabled,
    context: {
      arabicToEnglishMode: context.arabicToEnglishMode,
      translationSessionId: context.translationSessionId,
      translationPaused: session.isTranslationPaused(),
      assistantEnabled: context.assistantEnabled,
      helpStyle: context.helpStyle,
      layoutAuto: context.layoutAuto,
      liveTranslation: context.liveTranslation,
    },
    hypotheses: hypotheses.map(mapHypothesis),
    decision: {
      action: decision.action,
      reasonCodes: decision.reasonCodes,
      winnerCandidateId: decision.winnerCandidateId,
      range: decision.range,
    },
  }
}

function mapHypothesis(item: Hypothesis): TranslationPipelineProbe['hypotheses'][number] {
  return {
    intent: item.intent,
    localScore: item.localScore,
    risk: item.risk,
    needsLLM: item.needsLLM,
    range: item.span ? { start: item.span.start, end: item.span.end } : null,
  }
}
