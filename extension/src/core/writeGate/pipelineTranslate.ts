import { requestTranslationRemote } from '../../features/translation/client.ts'
import { isStaleTicket } from '../../features/translation/stale.ts'
import type { TranslationOutcome, TranslationTicket } from '../../features/translation/types.ts'
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  normalizeLanguage,
} from '../../features/translation/languages.ts'
import { stateManager } from '../state/StateManager.ts'
import { readFieldText } from '../dom/read.ts'
import { resolveWritingPolicy } from '../policy/writingPolicy.ts'
import { recordWritingAnalytics } from '../observability/writingAnalytics.ts'
import { commitWriteTransaction } from './writeGate.ts'
import type { EditableElement } from '../dom/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import type { TextRange } from '../engine/types.ts'
import { analyzeFieldText } from '../engine/chunks.ts'
import { planPreservedTranslation } from '../engine/preserveTokens.ts'

export type PipelineTranslateFn = (
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  signal?: AbortSignal,
) => Promise<TranslationOutcome>

let translateFn: PipelineTranslateFn = (text, source, target, signal) =>
  requestTranslationRemote(
    text,
    normalizeLanguage(source, DEFAULT_SOURCE_LANGUAGE),
    normalizeLanguage(target, DEFAULT_TARGET_LANGUAGE),
    signal,
    'live',
  )

export function setPipelineTranslateFnForTests(fn: PipelineTranslateFn | null): void {
  translateFn = fn
    ?? ((text, source, target, signal) =>
      requestTranslationRemote(
        text,
        normalizeLanguage(source, DEFAULT_SOURCE_LANGUAGE),
        normalizeLanguage(target, DEFAULT_TARGET_LANGUAGE),
        signal,
        'live',
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
  const preserve = planPreservedTranslation(
    liveText,
    range.start,
    range.end,
    analyzeFieldText(liveText).chunks,
  )
  const outbound = preserve.payload

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

  const ticket: TranslationTicket = {
    elementGeneration: cycleGeneration,
    originalText: source,
    start: range.start,
    end: range.end,
    sourceLanguage,
    targetLanguage,
    mode: 'live',
  }

  const controller = new AbortController()
  let outcome: TranslationOutcome
  try {
    outcome = await translateFn(outbound, sourceLanguage, targetLanguage, controller.signal)
  } catch {
    session.notePipelineTranslateKey(null)
    recordTranslationFailure('translation_failed')
    return 'noop'
  }

  if (controller.signal.aborted) {
    session.notePipelineTranslateKey(null)
    return 'stale'
  }

  if (!outcome.ok) {
    session.notePipelineTranslateKey(null)
    recordTranslationFailure(outcome.code)
    return 'noop'
  }

  const restored = preserve.restore(outcome.translation.trim())
  if (!restored.ok) {
    session.notePipelineTranslateKey(null)
    recordTranslationFailure('preserve_lost')
    return 'noop'
  }
  const translated = restored.text.trim()
  if (!translated || translated === source) {
    session.notePipelineTranslateKey(null)
    recordTranslationFailure('empty_or_unchanged')
    return 'noop'
  }

  if (!policy.arabicToEnglishMode || session.isTranslationPaused() || !session.getTranslationSessionId()) {
    session.notePipelineTranslateKey(null)
    return 'noop'
  }

  const current = readFieldText(element)
  if (
    isStaleTicket(ticket, {
      generation: session.getGeneration(),
      text: current,
      start: range.start,
      end: range.end,
      sourceLanguage,
      targetLanguage,
    })
  ) {
    session.notePipelineTranslateKey(null)
    return 'stale'
  }

  const acquired = session.tryAcquireWrite('TRANSLATE')
  if (!acquired.ok) {
    session.notePipelineTranslateKey(null)
    return 'blocked'
  }

  if (session.getGeneration() !== cycleGeneration) {
    session.releaseWrite('TRANSLATE', acquired.requestId)
    session.notePipelineTranslateKey(null)
    return 'stale'
  }

  const write = commitWriteTransaction(element, range.start, range.end, translated, {
    session,
    requestId: acquired.requestId,
    expectedGeneration: acquired.generation,
    cycleGeneration,
    origin: 'TRANSLATE',
    auto: true,
    engineOriginated: true,
    capability: 'translation',
    trigger: 'auto',
    textOrigin: 'translated_en',
    action: 'translation',
    tagTranslated: true,
    allowActiveEdit: true,
    placeCaretAfter: true,
  })
  session.releaseWrite('TRANSLATE', acquired.requestId)

  if (write.verdict !== 'written') {
    session.notePipelineTranslateKey(null)
    return write.verdict === 'stale' ? 'stale' : 'blocked'
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
