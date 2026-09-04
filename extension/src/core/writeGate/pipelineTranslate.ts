import { executeTranslation } from '../../features/translation/executor.ts'
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
  // #region agent log
  fetch('http://127.0.0.1:7879/ingest/9d16d7be-6afb-4b03-8147-7577c1b418b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0ba0e0'},body:JSON.stringify({sessionId:'0ba0e0',runId:'pre-fix',hypothesisId:'E',location:'pipelineTranslate.ts:fulfill',message:'live translate context',data:{sourceLen:source.length,segment_complete:translationContext.segment_complete===true,focus_out_completion:translationContext.focus_out_completion===true,hasBs:/بس/.test(source),hasListenCue:/اسمع/.test(source)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
    translate: (text, src, tgt, signal) =>
      translateFn(text, src, tgt, signal, translationContext),
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
