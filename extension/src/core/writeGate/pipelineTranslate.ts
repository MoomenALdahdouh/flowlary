import {
  executeTranslation,
  normalizeTranslationWriteSpacing,
} from '../../features/translation/executor.ts'
import type { TranslationOutcome } from '../../features/translation/types.ts'
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  normalizeLanguage,
} from '../../features/translation/languages.ts'
import { stateManager } from '../state/StateManager.ts'
import { readFieldText } from '../dom/read.ts'
import { resolveWritingPolicy } from '../policy/writingPolicy.ts'
import { recordWritingAnalytics } from '../observability/writingAnalytics.ts'
import type { EditableElement } from '../dom/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import type { TextRange } from '../engine/types.ts'
import { analyzeFieldText } from '../engine/chunks.ts'
import { requestTranslationRemote } from '../../features/translation/client.ts'
import { isSentenceCompleteSegment } from '../../features/translation/segments.ts'
import type { TranslationRequestContext } from '@flowlary/shared'
import { presentPipelineSuggestion } from './pipelineSuggest.ts'
import type { Operation } from '../runtime/types.ts'
import { isOperationCurrent } from '../runtime/validity.ts'
import { runWithPhysicalHttp } from '../runtime/physicalHttp.ts'
import { flushDeferredAutomaticCommits } from '../runtime/arbitration.ts'

export type PipelineTranslateFn = (
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  signal?: AbortSignal,
  context?: TranslationRequestContext,
) => Promise<TranslationOutcome>

let translateFn: PipelineTranslateFn = (text, source, target, signal, context) =>
  requestTranslationRemote(
    text,
    normalizeLanguage(source, DEFAULT_SOURCE_LANGUAGE),
    normalizeLanguage(target, DEFAULT_TARGET_LANGUAGE),
    signal,
    'live',
    context,
  )

export function setPipelineTranslateFnForTests(fn: PipelineTranslateFn | null): void {
  translateFn = fn
    ?? ((text, source, target, signal, context) =>
      requestTranslationRemote(
        text,
        normalizeLanguage(source, DEFAULT_SOURCE_LANGUAGE),
        normalizeLanguage(target, DEFAULT_TARGET_LANGUAGE),
        signal,
        'live',
        context,
      ))
}

export function translationRequestKey(
  fieldId: string,
  sessionId: string,
  generation: number,
  start: number,
  end: number,
  text: string,
): string {
  return `${fieldId}:${sessionId}:${generation}:${start}:${end}:${text}`
}

export async function fulfillTranslationDecision(
  element: EditableElement,
  session: FieldSession,
  range: TextRange,
  cycleGeneration: number,
  operation?: Operation,
): Promise<'applied' | 'noop' | 'stale' | 'blocked'> {
  const policy = resolveWritingPolicy()
  if (!policy.arabicToEnglishMode || session.isTranslationPaused()) {
    return 'noop'
  }

  const sessionId = session.getTranslationSessionId()
  if (!sessionId) return 'noop'

  const sourceLanguage = normalizeLanguage(
    stateManager.translation.sourceLanguage,
    DEFAULT_SOURCE_LANGUAGE,
  )
  const targetLanguage = normalizeLanguage(
    stateManager.translation.targetLanguage,
    DEFAULT_TARGET_LANGUAGE,
  )
  if (sourceLanguage === targetLanguage) return 'noop'

  const liveText = readFieldText(element)
  if (operation && !isOperationCurrent(operation, session.getRevision())) return 'stale'
  if (operation && operation.snapshotFullText !== liveText) return 'stale'
  const source = liveText.slice(range.start, range.end)
  if (!source.trim()) return 'noop'

  const requestKey = translationRequestKey(
    session.field.id,
    sessionId,
    cycleGeneration,
    range.start,
    range.end,
    source,
  )
  if (session.getLastPipelineTranslateKey() === requestKey) return 'noop'
  session.notePipelineTranslateKey(requestKey)

  const analysis = analyzeFieldText(liveText)
  const translationContext: TranslationRequestContext = {
    mode: 'live',
    segment_complete: isSentenceCompleteSegment(liveText, range.start, range.end),
    focus_out_completion: session.takeTranslationFocusOutCompletion(),
  }
  const translationAbort = operation?.abort.signal
  const physical = {
    fieldId: session.field.id,
    feature: 'translate' as const,
    isCurrent: () => {
      if (translationAbort?.aborted) return false
      return !operation || isOperationCurrent(operation, session.getRevision())
    },
  }
  const dispatchTranslate = async (
    text: string,
    source: string,
    target: string,
    signal?: AbortSignal,
  ) => {
    const gated = await runWithPhysicalHttp(physical, () =>
      translateFn(text, source, target, signal ?? translationAbort, translationContext),
    )
    if (!gated.dispatched) return { ok: false as const, code: 'aborted' as const }
    return gated.value
  }
  // Prefer explicit helpStyle; fall back to projected translation.mode for older sessions.
  const showBox = policy.helpStyle === 'suggestions' || stateManager.translation.mode === 'box'
  if (showBox) {
    if (operation && !isOperationCurrent(operation, session.getRevision())) {
      session.notePipelineTranslateKey(null)
      return 'stale'
    }
    const outcome = await dispatchTranslate(
      source,
      sourceLanguage,
      targetLanguage,
      translationAbort,
    )
    if (operation && !isOperationCurrent(operation, session.getRevision())) {
      session.notePipelineTranslateKey(null)
      return 'stale'
    }
    if (!outcome.ok) {
      session.notePipelineTranslateKey(null)
      recordTranslationFailure(outcome.code ?? 'translation_failed')
      return 'noop'
    }
    const suggestion = normalizeTranslationWriteSpacing(liveText, range.start, range.end, outcome.translation)
    if (!suggestion || suggestion === source) {
      session.notePipelineTranslateKey(null)
      return 'noop'
    }
    if (session.getGeneration() !== cycleGeneration || readFieldText(element) !== liveText) {
      session.notePipelineTranslateKey(null)
      return 'stale'
    }
    if (operation && !isOperationCurrent(operation, session.getRevision())) {
      session.notePipelineTranslateKey(null)
      return 'stale'
    }
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element,
      session,
      generation: cycleGeneration,
      range,
      sourceText: source,
      suggestion,
      action: 'translation',
      textOrigin: 'original_ar',
      operation,
    })
    flushDeferredAutomaticCommits(session)
    return 'noop'
  }
  const result = await executeTranslation({
    element,
    session,
    range,
    sourceText: source,
    sourceLanguage,
    targetLanguage,
    mode: 'live',
    trigger: 'auto',
    tokenStrategy: 'preserve',
    cycleGeneration,
    auto: true,
    acquireMutex: true,
    engineOriginated: true,
    recordHistoryEntry: false,
    chunks: analysis.chunks,
    operation,
    signal: translationAbort,
    translate: (text, src, tgt, signal) =>
      dispatchTranslate(text, src, tgt, signal ?? translationAbort),
  })

  if (result.status !== 'committed') {
    session.notePipelineTranslateKey(null)
    if (result.status === 'stale') return 'stale'
    if (result.status === 'blocked' || result.status === 'busy') return 'blocked'
    if (result.status === 'error') {
      recordTranslationFailure(result.reason ?? 'translation_failed')
    } else if (result.reason === 'preserve_lost') {
      recordTranslationFailure('preserve_lost')
    } else if (result.reason === 'empty_or_unchanged') {
      recordTranslationFailure('empty_or_unchanged')
    }
    return 'noop'
  }

  return 'applied'
}

function recordTranslationFailure(reason: string): void {
  recordWritingAnalytics({
    name: 'writing.decision',
    action: 'translation',
    trigger: 'auto',
    outcome: 'noop',
    textOrigin: 'original_ar',
    reasonCodes: [reason],
    shadowOnly: false,
  })
}
