import type { WriteOrigin } from '@flowlary/shared'
import type { FieldSession } from '../session/FieldSession.ts'
import {
  createFieldSnapshot,
  readCaret,
  readFieldText,
  readSelectionRange,
  mapOffsetToNode,
  isValueEditable,
  resolveEditableKind,
} from './read.ts'
import { captureReplacementSnapshot, commitReplacement, type CommitOptions } from './write.ts'
import { verifyFieldSnapshot } from './verify.ts'
import { allowsAutomaticFieldWrite } from '../safety/autoWrite.ts'
import { openTokenRange } from '../engine/layoutSequence.ts'
import { isShortcutsOnly } from '../policy/writingPolicy.ts'
import type {
  DiscardReason,
  EditableElement,
  FieldSnapshot,
  SelectionRange,
  WriteVerdict,
} from './types.ts'

export type WriteResult = {
  verdict: WriteVerdict | 'stale' | 'rejected'
  reason?:
    | DiscardReason
    | 'stale-generation'
    | 'stale-request'
    | 'composing'
    | 'aborted'
    | 'mutex'
    | 'unsupported_editor'
    | 'shortcuts_only'
    | 'cooldown'
    | 'shadow_only'
    | 'unfinished-token'
    | 'neighbor-mismatch'
    | 'unauthorized'
    | 'stale_revision'
    | 'superseded'
    | 'aborted'
    | 'failed'
    | 'missing'
    | 'field_mismatch'
    | 'operation_mismatch'
    | 'action_mismatch'
    | 'replacement_mismatch'
    | 'snapshot_mismatch'
    | 'range_mismatch'
    | 'range_text_mismatch'
    | 'disconnected'
}

export type WriteReplacementOptions = CommitOptions & {
  origin?: WriteOrigin
  session?: FieldSession
  requestId?: number
  expectedGeneration?: number
  mappingStillValid?: boolean
  /** When set, current field text must still match this snapshot before write. */
  baselineSnapshot?: FieldSnapshot
  /**
   * Automatic writers MUST set this. Requires a session lock (requestId).
   * Simple contenteditable is allowed; structured/rich hosts are not.
   */
  auto?: boolean
  /** Blur/commit: allow writing the token still under the caret. */
  commitOpenToken?: boolean
  /** Auto pipeline writes must not mutate the token still being typed. */
  requireCompletedToken?: boolean
  /** Surrounding text captured when the decision was made. */
  neighborGuard?: { before: string; after: string }
}

/** Canonical read API */
export const readText = readFieldText
export const readSelection = readSelectionRange
export { readCaret }

/** Canonical snapshot API */
export function createSnapshot(element: EditableElement, generation: number): FieldSnapshot {
  return createFieldSnapshot(element, generation)
}

/** Verify field snapshot + generation before write */
export function verifySnapshot(
  snapshot: FieldSnapshot,
  expectedGeneration?: number,
): DiscardReason | 'stale-generation' | null {
  return verifyFieldSnapshot(snapshot, expectedGeneration ?? snapshot.generation)
}

/** Restore selection/caret on a field */
export function restoreSelection(element: EditableElement, range: SelectionRange): void {
  if (isValueEditable(element)) {
    element.setSelectionRange(range.start, range.end)
    return
  }

  const start = mapOffsetToNode(element, range.start)
  const end = mapOffsetToNode(element, range.end)
  if (!start || !end) return

  const selRange = document.createRange()
  selRange.setStart(start.node, start.offset)
  selRange.setEnd(end.node, end.offset)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(selRange)
}

/**
 * Write replacement into [start, end), with session stale/mutex/abort gates.
 */
export function writeReplacement(
  element: EditableElement,
  start: number,
  end: number,
  replacement: string,
  options: WriteReplacementOptions = {},
): WriteResult {
  const {
    session,
    requestId,
    expectedGeneration,
    mappingStillValid = true,
    origin = 'SYSTEM',
    baselineSnapshot,
    auto = false,
    commitOpenToken = false,
    requireCompletedToken = false,
    neighborGuard,
    ...commitOptions
  } = options

  if (auto) {
    if (isShortcutsOnly()) {
      return { verdict: 'rejected', reason: 'shortcuts_only' }
    }
    if (!allowsAutomaticFieldWrite(element)) {
      const richTranslation =
        origin === 'TRANSLATE'
        && resolveEditableKind(element) === 'contenteditable'
        && element instanceof HTMLElement
        && mapOffsetToNode(element, start) !== null
        && mapOffsetToNode(element, end) !== null
      if (!richTranslation) {
        return { verdict: 'rejected', reason: 'unsupported_editor' }
      }
    }
    if (!session || requestId === undefined) {
      return { verdict: 'rejected', reason: 'mutex' }
    }
  }

  if (baselineSnapshot) {
    const baselineReason = verifyFieldSnapshot(
      baselineSnapshot,
      baselineSnapshot.generation,
    )
    if (baselineReason) {
      return { verdict: 'stale', reason: baselineReason }
    }
  }

  if (session?.isComposing()) {
    return { verdict: 'rejected', reason: 'composing' }
  }

  if (session) {
    const active = session.getActiveRequest()
    if (active && (requestId === undefined || active.requestId !== requestId)) {
      return { verdict: 'rejected', reason: 'mutex' }
    }
    if (active?.signal.aborted) {
      return { verdict: 'rejected', reason: 'aborted' }
    }
  }

  if (session && requestId !== undefined) {
    const gen = expectedGeneration ?? session.getGeneration()
    if (session.isStale(gen, requestId)) {
      return {
        verdict: 'stale',
        reason: gen !== session.getGeneration() ? 'stale-generation' : 'stale-request',
      }
    }
  }

  const liveText = readFieldText(element)
  if (neighborGuard) {
    const beforeStart = start - neighborGuard.before.length
    if (
      beforeStart < 0
      || liveText.slice(beforeStart, start) !== neighborGuard.before
      || liveText.slice(end, end + neighborGuard.after.length) !== neighborGuard.after
    ) {
      return { verdict: 'stale', reason: 'neighbor-mismatch' }
    }
  }
  if (auto && requireCompletedToken && !commitOpenToken) {
    const liveCaret = readCaret(element)
    const open = openTokenRange(liveText, liveCaret ?? undefined)
    if (open && start >= open.start && end <= open.end) {
      return { verdict: 'rejected', reason: 'unfinished-token' }
    }
  }
  const originalWord = liveText.slice(start, end)
  const caret = readCaret(element) ?? end
  const replacementSnapshot = captureReplacementSnapshot(
    element,
    originalWord,
    start,
    end,
    caret,
  )

  if (expectedGeneration !== undefined && replacementSnapshot.generation !== expectedGeneration) {
    return { verdict: 'stale', reason: 'stale-generation' }
  }

  const fieldSnapshot = createFieldSnapshot(element, replacementSnapshot.generation)
  const snapshotReason = verifyFieldSnapshot(fieldSnapshot, replacementSnapshot.generation)
  if (snapshotReason) {
    return { verdict: 'stale', reason: snapshotReason }
  }

  let verdict: WriteVerdict = 'discarded'
  verdict = commitReplacement(
    replacementSnapshot,
    replacement,
    mappingStillValid,
    element,
    commitOptions,
    origin,
  )

  if (verdict === 'written' && session && requestId !== undefined) {
    session.noteWrite(origin === 'SYSTEM' ? 'SYSTEM' : origin, requestId, fieldSnapshot)
  }

  if (verdict === 'discarded') {
    return { verdict: 'stale', reason: 'text-mismatch' }
  }

  return { verdict }
}
