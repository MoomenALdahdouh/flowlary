import { readFieldText } from '../../core/dom/read.ts'
import { commitWriteTransaction } from '../../core/writeGate/writeGate.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import { analyzeFieldText } from '../../core/engine/chunks.ts'
import { planPreservedTranslation } from '../../core/engine/preserveTokens.ts'
import type { WritingChunk } from '../../core/engine/types.ts'
import { recordHistory } from '../../storage/history/record.ts'
import { targetLooksProtected } from './selection.ts'
import { isStaleTicket } from './stale.ts'
import type { LanguageCode, TranslationOutcome, TranslationTicket } from './types.ts'

export type TranslationTokenStrategy = 'block' | 'preserve'

export type ExecuteTranslationInput = {
  element: EditableElement
  session: FieldSession
  range: { start: number; end: number }
  sourceText: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  mode: 'shortcut' | 'live'
  trigger: 'shortcut' | 'auto' | 'suggestion_accept'
  tokenStrategy: TranslationTokenStrategy
  cycleGeneration?: number
  requestId?: number
  expectedGeneration?: number
  signal?: AbortSignal
  auto?: boolean
  acquireMutex?: boolean
  engineOriginated?: boolean
  recordHistoryEntry?: boolean
  chunks?: readonly WritingChunk[]
  translate: (
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    signal?: AbortSignal,
  ) => Promise<TranslationOutcome>
}

export type ExecuteTranslationResult =
  | { status: 'committed'; translation: string }
  | {
      status: 'stale' | 'blocked' | 'noop' | 'aborted' | 'protected' | 'error' | 'busy'
      reason?: string
    }

/** Keep a word boundary when a new translation abuts existing field text. */
export function normalizeTranslationWriteSpacing(
  fieldText: string,
  start: number,
  end: number,
  translation: string,
): string {
  let text = translation.trim()
  if (!text) return text
  const prev = start > 0 ? fieldText[start - 1]! : ''
  const next = end < fieldText.length ? fieldText[end]! : ''
  const wordChar = /[\p{L}\p{N}]/u
  if (
    prev
    && wordChar.test(prev)
    && wordChar.test(text[0]!)
    && !/\s/u.test(prev)
    && !/^\s/u.test(text)
    && !/^[,;.!?…؟]/u.test(text)
  ) {
    text = ` ${text}`
  }
  if (
    prev
    && /[.!?…؟]/u.test(prev)
    && wordChar.test(text[0]!)
    && !/^\s/u.test(text)
  ) {
    text = ` ${text}`
  }
  if (
    next
    && wordChar.test(next)
    && wordChar.test(text.at(-1)!)
    && !/\s/u.test(next)
    && !/\s$/u.test(text)
    && !/[,;.!?…؟]$/.u.test(text)
  ) {
    text = `${text} `
  }
  return text
}

export async function executeTranslation(
  input: ExecuteTranslationInput,
): Promise<ExecuteTranslationResult> {
  const {
    element,
    session,
    range,
    sourceText,
    sourceLanguage,
    targetLanguage,
    mode,
    trigger,
    tokenStrategy,
    signal,
    auto = false,
    acquireMutex = false,
    engineOriginated = false,
    recordHistoryEntry = true,
    translate,
  } = input

  const trimmed = sourceText.trim()
  if (!trimmed) return { status: 'noop', reason: 'empty_text' }
  if (sourceLanguage === targetLanguage) return { status: 'noop', reason: 'same-language' }

  if (tokenStrategy === 'block' && targetLooksProtected(sourceText)) {
    return { status: 'protected', reason: 'protected' }
  }

  let outbound = sourceText
  let restore: ((translated: string) => { ok: true; text: string } | { ok: false; reason: 'preserve_lost' }) | null = null
  if (tokenStrategy === 'preserve') {
    const liveText = readFieldText(element)
    const chunks = input.chunks ?? analyzeFieldText(liveText).chunks
    const preserve = planPreservedTranslation(liveText, range.start, range.end, chunks)
    outbound = preserve.payload
    restore = preserve.restore
  }

  let requestId = input.requestId
  let expectedGeneration = input.expectedGeneration ?? input.cycleGeneration ?? session.getGeneration()
  let ticketGeneration = expectedGeneration
  let releaseRequestId: number | undefined

  if (acquireMutex) {
    const acquired = session.tryAcquireWrite('TRANSLATE')
    if (!acquired.ok) return { status: 'busy', reason: 'mutex_held' }
    requestId = acquired.requestId
    expectedGeneration = acquired.generation
    ticketGeneration = acquired.generation
    releaseRequestId = acquired.requestId
  }

  const ticket: TranslationTicket = {
    elementGeneration: ticketGeneration,
    originalText: sourceText,
    start: range.start,
    end: range.end,
    sourceLanguage,
    targetLanguage,
    mode,
  }

  try {
    if (signal?.aborted) return { status: 'aborted', reason: 'aborted' }

    const outcome = await translate(outbound, sourceLanguage, targetLanguage, signal)

    if (signal?.aborted) return { status: 'aborted', reason: 'aborted' }
    if (!element.isConnected) return { status: 'stale', reason: 'detached' }
    if (!outcome.ok) return { status: 'error', reason: outcome.code }

    let translated = outcome.translation.trim()
    if (restore) {
      const restored = restore(translated)
      if (!restored.ok) return { status: 'noop', reason: 'preserve_lost' }
      translated = restored.text.trim()
    }

    if (!translated || translated === sourceText) {
      return { status: 'noop', reason: 'empty_or_unchanged' }
    }

    const liveText = readFieldText(element)
    const liveGeneration = input.cycleGeneration ?? session.getGeneration()
    if (
      isStaleTicket(ticket, {
        generation: liveGeneration,
        text: liveText,
        start: range.start,
        end: range.end,
        sourceLanguage,
        targetLanguage,
      })
    ) {
      return { status: 'stale', reason: 'stale_ticket' }
    }

    if (requestId != null && expectedGeneration != null) {
      const commit = session.canCommit(expectedGeneration, requestId)
      if (!commit.ok) {
        if (commit.reason === 'aborted') return { status: 'aborted', reason: commit.reason }
        return { status: 'stale', reason: commit.reason }
      }
    }

    if (acquireMutex && input.cycleGeneration != null && session.getGeneration() !== input.cycleGeneration) {
      return { status: 'stale', reason: 'cycle_generation' }
    }

    translated = normalizeTranslationWriteSpacing(liveText, range.start, range.end, translated)

    const write = commitWriteTransaction(element, range.start, range.end, translated, {
      origin: 'TRANSLATE',
      session,
      requestId,
      expectedGeneration,
      cycleGeneration: input.cycleGeneration ?? expectedGeneration,
      placeCaretAfter: true,
      allowActiveEdit: true,
      auto,
      engineOriginated,
      capability: 'translation',
      trigger,
      tagTranslated: true,
      textOrigin: 'translated_en',
      action: 'translation',
    })

    if (write.verdict !== 'written') {
      return {
        status: write.verdict === 'stale' ? 'stale' : 'blocked',
        reason: write.reason ?? write.verdict,
      }
    }

    if (recordHistoryEntry) {
      void recordHistory({
        operation: 'TRANSLATE',
        element,
        sourceText,
        resultText: translated,
        mode: mode === 'live' ? 'live' : 'manual',
        metadata: { sourceLanguage, targetLanguage },
      })
    }

    return { status: 'committed', translation: translated }
  } finally {
    if (releaseRequestId != null) {
      session.releaseWrite('TRANSLATE', releaseRequestId)
    }
  }
}
