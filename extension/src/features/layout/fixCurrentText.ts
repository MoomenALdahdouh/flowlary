import type { EditableElement } from '../../core/dom/types.ts'
import { readCaret, readFieldText, readSelectionRange } from '../../core/dom/read.ts'
import { commitWriteTransaction } from '../../core/writeGate/writeGate.ts'
import { issueImmediateWriteAuthorization } from '../../core/runtime/writeAuthorization.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import {
  canCommitMismatch,
  localClassificationHint,
  planFieldFixes,
  type FieldFix,
  type UserLayoutProfile,
} from './layouts/index.ts'
import { applyLayoutSpansToText, inferLayoutSpans } from '../../core/engine/layoutSequence.ts'
import { isExceptedToken } from './profile/exceptions.ts'
import { isSupportedLayout } from './layouts/registry.ts'
import type { LayoutId } from './layouts/types.ts'
import { isInsideMarkdownCode, isSafeToken, tokenizeText } from '../../core/safety/index.ts'
import type { LayoutClassifier } from './classifier/LayoutClassifier.ts'
import type { LayoutMetrics } from './metrics.ts'
import type { HistoryMode } from '../../storage/history/types.ts'
import { recordHistory } from '../../storage/history/record.ts'
import { allowsAutomaticFieldWrite } from '../../core/safety/autoWrite.ts'
import {
  fieldKindFromElement,
  recordWriteTelemetry,
} from '../../core/observability/writeTelemetry.ts'
import {
  buildLayoutLearningBatchId,
  recordLayoutLearningAccepted,
} from '../learning/recordLayoutLearning.ts'

export type FixTarget = {
  start: number
  end: number
  text: string
  mode: 'selection' | 'token' | 'field'
}

export function resolveFixTarget(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): FixTarget | null {
  const from = Math.min(selectionStart, selectionEnd)
  const to = Math.max(selectionStart, selectionEnd)
  if (from !== to) {
    const slice = text.slice(from, to)
    if (!slice.trim()) return null
    return { start: from, end: to, text: slice, mode: 'selection' }
  }
  if (!text.trim()) return null
  return { start: 0, end: text.length, text, mode: 'field' }
}

export function planShortcutFixes(
  text: string,
  profile: UserLayoutProfile,
  target: FixTarget,
  personalExceptions: readonly string[] = [],
): FieldFix[] {
  const inferred = inferLayoutSpans(text, undefined, { commitOpenToken: true })
  const { applied } = applyLayoutSpansToText(text, inferred, { includeMedium: true })
  const fromEngine: FieldFix[] = applied
    .filter((span) => span.range.start >= target.start && span.range.end <= target.end)
    .filter((span): span is typeof span & { sourceLayout: LayoutId; targetLayout: LayoutId } =>
      isSupportedLayout(span.sourceLayout) && isSupportedLayout(span.targetLayout),
    )
    .map((span) => ({
      start: span.range.start,
      end: span.range.end,
      word: text.slice(span.range.start, span.range.end),
      corrected: span.replacement,
      sourceLayout: span.sourceLayout,
      targetLayout: span.targetLayout,
    }))
    .filter((fix) => !isExceptedToken(fix.word, personalExceptions))
  if (fromEngine.length > 0) return fromEngine
  return planFieldFixes(text, profile, {
    finalizeAll: true,
    personalExceptions,
  }).filter((fix) => fix.start >= target.start && fix.end <= target.end)
}

export function tokensNeedingClassifier(
  text: string,
  profile: UserLayoutProfile,
  target: FixTarget,
  personalExceptions: readonly string[] = [],
  planned: readonly FieldFix[] = [],
) {
  const plannedStarts = new Set(planned.map((fix) => fix.start))
  return tokenizeText(text).tokens.filter((span) => {
    if (span.start < target.start || span.end > target.end) return false
    if (plannedStarts.has(span.start)) return false
    if (!span.token) return false
    if (isExceptedToken(span.token, personalExceptions)) return false
    if (!isSafeToken(span.token, span.context, span.raw)) return false
    if (isInsideMarkdownCode(text, span.start)) return false
    return localClassificationHint(span.token, profile, text) === null
  })
}

export type ShortcutSession = {
  element: EditableElement
  text: string
  start: number
  end: number
  generation: number
  sourceLayout: string
  enabledLayouts: readonly string[]
}

export function captureShortcutSession(
  element: EditableElement,
  profile: UserLayoutProfile,
  selection: { start: number; end: number },
  generation: number,
): ShortcutSession {
  return {
    element,
    text: readFieldText(element),
    start: selection.start,
    end: selection.end,
    generation,
    sourceLayout: profile.sourceLayout,
    enabledLayouts: [...profile.enabledLayouts],
  }
}

export function shortcutSessionStillValid(
  session: ShortcutSession,
  profile: UserLayoutProfile,
  focused: EditableElement | null,
): boolean {
  if (!session.element.isConnected) return false
  if (focused !== session.element) return false
  if (readFieldText(session.element) !== session.text) return false
  if (profile.sourceLayout !== session.sourceLayout) return false
  if (profile.enabledLayouts.join('\0') !== session.enabledLayouts.join('\0')) return false
  const range = readSelectionRange(session.element)
  if (!range) return false
  return range.start === session.start && range.end === session.end
}

export function applyLayoutFix(
  element: EditableElement,
  session: FieldSession,
  fix: FieldFix,
  generation: number,
  requestId?: number,
  options: {
    placeCaretAfter?: boolean
    historyMode?: HistoryMode
    sampleText?: string
    learningBatchId?: string
  } = {},
): boolean {
  const automatic = options.historyMode === 'automatic'
  let lockId = requestId
  let lockGeneration = generation
  let acquiredLocal = false

  if (lockId === undefined) {
    const acquired = session.tryAcquireWrite('FIX_LAYOUT')
    if (!acquired.ok) {
      recordWriteTelemetry({
        capability: 'layout',
        trigger: automatic ? 'auto' : 'shortcut',
        outcome: 'blocked',
        reasonCodes: [acquired.reason === 'composing' ? 'composing' : 'mutex_busy'],
        fieldKind: fieldKindFromElement(element),
        composing: session.isComposing(),
        rangeLength: fix.end - fix.start,
      })
      return false
    }
    lockId = acquired.requestId
    lockGeneration = acquired.generation
    acquiredLocal = true
  }

  try {
    const snapshot = readFieldText(element)
    const authorization = issueImmediateWriteAuthorization({
      session,
      action: 'layout_fix',
      range: { start: fix.start, end: fix.end },
      replacement: fix.corrected,
      snapshotFullText: snapshot,
      purpose: automatic ? 'auto-analysis' : 'shortcut',
      trigger: automatic ? 'auto' : 'shortcut',
    })

    const result = commitWriteTransaction(element, fix.start, fix.end, fix.corrected, {
      origin: 'FIX_LAYOUT',
      session,
      requestId: lockId,
      expectedGeneration: lockGeneration,
      cycleGeneration: lockGeneration,
      placeCaretAfter: options.placeCaretAfter,
      // Manual selection shortcuts keep the range selected; allow the write.
      allowActiveEdit: true,
      auto: automatic,
      capability: 'layout',
      trigger: automatic ? 'auto' : 'shortcut',
      textOrigin: 'layout_mismatch_suspected',
      action: 'layout_fix',
      authorization,
    })

    recordWriteTelemetry({
      capability: 'layout',
      trigger: automatic ? 'auto' : 'shortcut',
      outcome:
        result.verdict === 'written'
          ? 'applied'
          : result.verdict === 'stale'
            ? 'stale'
            : 'blocked',
      reasonCodes:
        result.verdict === 'written'
          ? ['written']
          : [
              result.reason === 'unsupported_editor'
                ? 'unsupported_editor_auto_write'
                : result.reason === 'mutex'
                  ? 'mutex_busy'
                  : result.reason === 'stale-generation'
                    ? 'stale_generation'
                    : result.reason === 'stale-request'
                      ? 'stale_request'
                      : result.reason === 'composing'
                        ? 'composing'
                        : result.reason === 'shortcuts_only'
                          ? 'shortcuts_only'
                          : result.reason === 'aborted'
                            ? 'aborted'
                            : 'text_mismatch',
            ],
      fieldKind: fieldKindFromElement(element),
      composing: session.isComposing(),
      rangeLength: fix.end - fix.start,
    })

    if (automatic && !allowsAutomaticFieldWrite(element) && result.verdict !== 'written') {
      return false
    }

    if (result.verdict === 'written' && options.historyMode) {
      void recordHistory({
        operation: 'FIX_LAYOUT',
        element,
        sourceText: fix.word,
        resultText: fix.corrected,
        mode: options.historyMode,
        metadata: {
          sourceLayout: fix.sourceLayout,
          targetLayout: fix.targetLayout,
        },
      })
      if (
        options.historyMode === 'manual' &&
        options.sampleText &&
        options.learningBatchId
      ) {
        recordLayoutLearningAccepted(
          options.learningBatchId,
          options.sampleText,
          fix.word,
          fix.corrected,
        )
      }
    }
    return result.verdict === 'written'
  } finally {
    if (acquiredLocal) {
      session.releaseWrite('FIX_LAYOUT', lockId)
    }
  }
}

export type FixCurrentTextOptions = {
  element: EditableElement
  session: FieldSession
  profile: UserLayoutProfile
  personalExceptions: readonly string[]
  generation: number
  requestId: number
  signal: AbortSignal
  classifier: LayoutClassifier
  metrics: LayoutMetrics
  rangeStart?: number
  rangeEnd?: number
}

export async function fixCurrentText(
  options: FixCurrentTextOptions,
): Promise<{ applied: boolean; stale?: boolean; aborted?: boolean }> {
  const {
    element,
    session,
    profile,
    personalExceptions,
    generation,
    requestId,
    signal,
    classifier,
    metrics,
    rangeStart,
    rangeEnd,
  } = options

  const text = readFieldText(element)
  const selection =
    rangeStart != null && rangeEnd != null
      ? { start: rangeStart, end: rangeEnd }
      : readSelectionRange(element)
  if (!selection) return { applied: false }

  const target = resolveFixTarget(text, selection.start, selection.end)
  if (!target) return { applied: false }

  const shortcutSession = captureShortcutSession(element, profile, selection, generation)
  const local = planShortcutFixes(text, profile, target, personalExceptions)
  const learningBatchId = buildLayoutLearningBatchId(requestId)
  let applied = false

  for (const fix of [...local].sort((a, b) => b.start - a.start)) {
    if (signal.aborted) return { applied, aborted: true }
    if (!session.canCommit(generation, requestId).ok) {
      metrics.layout_stale_results += 1
      return { applied, stale: true }
    }
    if (
      !/\s/.test(fix.word)
      && !canCommitMismatch(profile, fix.word, fix.targetLayout, fix.corrected, text)
    ) {
      continue
    }
    if (
      applyLayoutFix(element, session, fix, generation, requestId, {
        placeCaretAfter: true,
        historyMode: 'manual',
        sampleText: text,
        learningBatchId,
      })
    ) {
      applied = true
    }
  }

  if (applied) return { applied: true }

  const remaining = tokensNeedingClassifier(
    text,
    profile,
    target,
    personalExceptions,
    local,
  )
  if (remaining.length === 0) return { applied: false }

  for (const span of remaining) {
    if (signal.aborted) return { applied, aborted: true }
    if (!shortcutSessionStillValid(shortcutSession, profile, element)) {
      metrics.layout_stale_results += 1
      return { applied, stale: true }
    }
    if (!session.canCommit(generation, requestId).ok) {
      metrics.layout_stale_results += 1
      return { applied, stale: true }
    }

    const result = await classifier.classify(span.token, profile, text, signal, {
      fieldId: session.field.id,
      isCurrent: () =>
        !signal.aborted
        && session.getGeneration() === generation
        && shortcutSessionStillValid(shortcutSession, profile, element),
    })
    if (!result.ok) continue
    if (result.verdict.kind !== 'LAYOUT_MISMATCH' || !result.verdict.targetLayout) continue

    const corrected =
      result.verdict.corrected ??
      planFieldFixes(text, profile, { finalizeAll: true, personalExceptions }).find(
        (fix) => fix.start === span.start,
      )?.corrected

    if (
      !corrected ||
      !classifier.canApply(
        profile,
        span.token,
        result.verdict.targetLayout,
        corrected,
        text,
      )
    ) {
      continue
    }

    const fix: FieldFix = {
      start: span.start,
      end: span.end,
      word: span.token,
      corrected,
      sourceLayout: result.verdict.sourceLayout,
      targetLayout: result.verdict.targetLayout,
    }

    if (
      applyLayoutFix(element, session, fix, generation, requestId, {
        placeCaretAfter: true,
        historyMode: 'manual',
        sampleText: text,
        learningBatchId,
      })
    ) {
      applied = true
    }
  }

  return { applied }
}
