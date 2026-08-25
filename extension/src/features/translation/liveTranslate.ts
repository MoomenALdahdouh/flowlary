import { evaluateFieldSafety, isInsideMarkdownCode } from '../../core/safety/index.ts'
import { readCaret, readFieldText } from '../../core/dom/read.ts'
import { writeReplacement } from '../../core/dom/editor.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import type { TranslationEngine } from './engine.ts'
import { liveSegmentOnPause } from './segments.ts'
import { targetLooksProtected } from './selection.ts'
import { isStaleTicket } from './stale.ts'
import type { TranslationMetrics } from './metrics.ts'
import type { LanguageCode, TranslationTicket } from './types.ts'
import { MAX_TRANSLATION_CHARS } from './types.ts'
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, normalizeLanguage } from './languages.ts'
import { recordHistory } from '../../storage/history/record.ts'

export type FieldLiveState = {
  lastRequestedKey: string | null
  lastTranslatedKey: string | null
}

export function segmentRequestKey(
  fieldId: string,
  start: number,
  end: number,
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): string {
  return `${fieldId}:${start}:${end}:${text}:${sourceLanguage}:${targetLanguage}`
}

export type LiveTranslateResult =
  | 'committed'
  | 'stale'
  | 'blocked'
  | 'noop'
  | 'busy'
  | 'aborted'
  | 'error'
  | 'disabled'

export type LiveTranslateOptions = {
  engine: TranslationEngine
  metrics: TranslationMetrics
  fieldState: FieldLiveState
}

export async function runLiveTranslation(
  element: EditableElement,
  session: FieldSession,
  options: LiveTranslateOptions,
): Promise<LiveTranslateResult> {
  if (!stateManager.isActive() || !stateManager.translation.liveEnabled) {
    return 'disabled'
  }

  const sourceLanguage = normalizeLanguage(
    stateManager.translation.sourceLanguage,
    DEFAULT_SOURCE_LANGUAGE,
  )
  const targetLanguage = normalizeLanguage(
    stateManager.translation.targetLanguage,
    DEFAULT_TARGET_LANGUAGE,
  )

  if (sourceLanguage === targetLanguage) return 'noop'

  const hostname = typeof location !== 'undefined' ? location.hostname : undefined
  const text = readFieldText(element)
  const safety = evaluateFieldSafety(element, {
    hostname,
    excludedDomains: stateManager.settings.excludedDomains,
    text,
  })
  if (!safety.allowed) {
    options.metrics.translation_live_blocked += 1
    return 'blocked'
  }

  if (session.isComposing()) return 'blocked'
  if (text.length > MAX_TRANSLATION_CHARS) return 'blocked'

  const caret = readCaret(element) ?? text.length
  const segment = liveSegmentOnPause(text, caret)
  if (!segment || !segment.text.trim()) return 'noop'

  if (targetLooksProtected(segment.text)) {
    options.metrics.translation_live_blocked += 1
    return 'blocked'
  }
  if (isInsideMarkdownCode(text, segment.start)) {
    options.metrics.translation_live_blocked += 1
    return 'blocked'
  }

  const requestKey = segmentRequestKey(
    session.field.id,
    segment.start,
    segment.end,
    segment.text,
    sourceLanguage,
    targetLanguage,
  )

  if (requestKey === options.fieldState.lastTranslatedKey) return 'noop'
  if (requestKey === options.fieldState.lastRequestedKey) return 'noop'

  const acquired = session.tryAcquireWrite('TRANSLATE')
  if (!acquired.ok) {
    options.metrics.translation_live_blocked += 1
    return 'busy'
  }

  const { requestId, generation, signal } = acquired
  options.fieldState.lastRequestedKey = requestKey
  options.metrics.translation_live_requests += 1

  const ticket: TranslationTicket = {
    elementGeneration: generation,
    originalText: segment.text,
    start: segment.start,
    end: segment.end,
    sourceLanguage,
    targetLanguage,
    mode: 'live',
  }

  try {
    const outcome = await options.engine.translate(
      {
        text: segment.text,
        sourceLanguage,
        targetLanguage,
        mode: 'live',
      },
      signal,
    )

    if (signal.aborted) {
      options.metrics.translation_live_aborts += 1
      return 'aborted'
    }

    if (!element.isConnected) {
      options.metrics.translation_live_stale += 1
      return 'stale'
    }

    if (!outcome.ok) {
      options.metrics.translation_live_errors += 1
      return 'error'
    }

    if (outcome.translation === segment.text) return 'noop'

    const liveText = readFieldText(element)
    if (
      isStaleTicket(ticket, {
        generation: session.getGeneration(),
        text: liveText,
        start: segment.start,
        end: segment.end,
        sourceLanguage,
        targetLanguage,
      })
    ) {
      options.metrics.translation_live_stale += 1
      return 'stale'
    }

    const commit = session.canCommit(generation, requestId)
    if (!commit.ok) {
      if (commit.reason === 'aborted') options.metrics.translation_live_aborts += 1
      else options.metrics.translation_live_stale += 1
      return commit.reason === 'aborted' ? 'aborted' : 'stale'
    }

    const write = writeReplacement(element, segment.start, segment.end, outcome.translation, {
      origin: 'TRANSLATE',
      session,
      requestId,
      expectedGeneration: generation,
      placeCaretAfter: true,
      allowActiveEdit: true,
    })

    if (write.verdict !== 'written') {
      options.metrics.translation_live_stale += 1
      return 'stale'
    }

    options.fieldState.lastTranslatedKey = requestKey
    options.metrics.translation_live_commits += 1
    void recordHistory({
      operation: 'TRANSLATE',
      element,
      sourceText: segment.text,
      resultText: outcome.translation,
      mode: 'live',
      metadata: { sourceLanguage, targetLanguage },
    })
    return 'committed'
  } catch {
    options.metrics.translation_live_errors += 1
    return 'error'
  } finally {
    session.releaseWrite('TRANSLATE', requestId)
  }
}
