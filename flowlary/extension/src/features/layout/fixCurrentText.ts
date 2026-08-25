import type { EditableElement } from '../../core/dom/types.ts'
import { readCaret, readFieldText, readSelectionRange } from '../../core/dom/read.ts'
import { writeReplacement } from '../../core/dom/editor.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import {
  canCommitMismatch,
  localClassificationHint,
  planFieldFixes,
  type FieldFix,
  type UserLayoutProfile,
} from './layouts/index.ts'
import { isExceptedToken } from './profile/exceptions.ts'
import { isInsideMarkdownCode, isSafeToken, tokenizeText } from '../../core/safety/index.ts'
import type { LayoutClassifier } from './classifier/LayoutClassifier.ts'
import type { LayoutMetrics } from './metrics.ts'

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
  options: { placeCaretAfter?: boolean } = {},
): boolean {
  const result = writeReplacement(element, fix.start, fix.end, fix.corrected, {
    origin: 'FIX_LAYOUT',
    session,
    requestId,
    expectedGeneration: generation,
    placeCaretAfter: options.placeCaretAfter,
  })
  return result.verdict === 'written'
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
  } = options

  const text = readFieldText(element)
  const selection = readSelectionRange(element)
  if (!selection) return { applied: false }

  const target = resolveFixTarget(text, selection.start, selection.end)
  if (!target) return { applied: false }

  const shortcutSession = captureShortcutSession(element, profile, selection, generation)
  const local = planShortcutFixes(text, profile, target, personalExceptions)
  let applied = false

  for (const fix of [...local].sort((a, b) => b.start - a.start)) {
    if (signal.aborted) return { applied, aborted: true }
    if (!session.canCommit(generation, requestId).ok) {
      metrics.layout_stale_results += 1
      return { applied, stale: true }
    }
    if (!canCommitMismatch(profile, fix.word, fix.targetLayout, fix.corrected, text)) {
      continue
    }
    if (applyLayoutFix(element, session, fix, generation, requestId, { placeCaretAfter: true })) {
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

    const result = await classifier.classify(span.token, profile, text, signal)
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

    if (applyLayoutFix(element, session, fix, generation, requestId, { placeCaretAfter: true })) {
      applied = true
    }
  }

  return { applied }
}
