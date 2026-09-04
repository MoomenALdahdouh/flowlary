import { evaluateFieldSafety, isInsideMarkdownCode } from '../../core/safety/index.ts'
import { readCaret, readFieldText } from '../../core/dom/read.ts'
import { resolveWritingPolicy } from '../../core/policy/writingPolicy.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import type { TranslationEngine } from './engine.ts'
import { liveTranslateSegment } from './segments.ts'
import { targetLooksProtected } from './selection.ts'
import type { TranslationMetrics } from './metrics.ts'
import type { LanguageCode } from './types.ts'
import { MAX_TRANSLATION_CHARS } from './types.ts'
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, normalizeLanguage } from './languages.ts'
import { allowsAutomaticFieldWrite } from '../../core/safety/autoWrite.ts'
import { allowAutomaticNetworkAssist } from '../../core/policy/writingPolicy.ts'
import {
  fieldKindFromElement,
  recordWriteTelemetry,
} from '../../core/observability/writeTelemetry.ts'
import { executeTranslation } from './executor.ts'

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
  const policy = resolveWritingPolicy()
  if (!stateManager.isActive() || !policy.arabicToEnglishMode) {
    return 'disabled'
  }
  if (session.isTranslationPaused()) {
    return 'disabled'
  }
  session.ensureTranslationSession()
  if (!allowAutomaticNetworkAssist()) {
    recordWriteTelemetry({
      capability: 'translation',
      trigger: 'auto',
      outcome: 'noop',
      reasonCodes: ['shortcuts_only'],
      fieldKind: fieldKindFromElement(element),
    })
    return 'disabled'
  }
  if (!allowsAutomaticFieldWrite(element)) {
    recordWriteTelemetry({
      capability: 'translation',
      trigger: 'auto',
      outcome: 'blocked',
      reasonCodes: ['unsupported_editor_auto_write'],
      fieldKind: fieldKindFromElement(element),
    })
    options.metrics.translation_live_blocked += 1
    return 'blocked'
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
  const segment = liveTranslateSegment(text, caret, session.getTranslatedRanges())
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

  options.fieldState.lastRequestedKey = requestKey
  options.metrics.translation_live_requests += 1

  const result = await executeTranslation({
    element,
    session,
    range: { start: segment.start, end: segment.end },
    sourceText: segment.text,
    sourceLanguage,
    targetLanguage,
    mode: 'live',
    trigger: 'auto',
    tokenStrategy: 'block',
    auto: true,
    acquireMutex: true,
    recordHistoryEntry: true,
    translate: (slice, src, tgt, signal) =>
      options.engine.translate(
        { text: slice, sourceLanguage: src, targetLanguage: tgt, mode: 'live' },
        signal,
      ),
  })

  if (result.status === 'committed') {
    options.fieldState.lastTranslatedKey = requestKey
    options.metrics.translation_live_commits += 1
    return 'committed'
  }
  if (result.status === 'aborted') {
    options.metrics.translation_live_aborts += 1
    return 'aborted'
  }
  if (result.status === 'stale') {
    options.metrics.translation_live_stale += 1
    return 'stale'
  }
  if (result.status === 'busy' || result.status === 'blocked') {
    options.metrics.translation_live_blocked += 1
    return result.status === 'busy' ? 'busy' : 'blocked'
  }
  if (result.status === 'error') {
    options.metrics.translation_live_errors += 1
    return 'error'
  }
  return 'noop'
}
