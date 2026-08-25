import type { WriteOrigin } from '@flowlary/shared'
import type { FieldSession } from '../session/FieldSession.ts'
import {
  createFieldSnapshot,
  readCaret,
  readFieldText,
  readSelectionRange,
  mapOffsetToNode,
  isValueEditable,
} from './read.ts'
import { captureReplacementSnapshot, commitReplacement, type CommitOptions } from './write.ts'
import { verifyFieldSnapshot } from './verify.ts'
import type {
  DiscardReason,
  EditableElement,
  FieldSnapshot,
  SelectionRange,
  WriteVerdict,
} from './types.ts'

export type WriteResult = {
  verdict: WriteVerdict | 'stale' | 'rejected'
  reason?: DiscardReason | 'stale-generation' | 'stale-request' | 'composing' | 'aborted' | 'mutex'
}

export type WriteReplacementOptions = CommitOptions & {
  origin?: WriteOrigin
  session?: FieldSession
  requestId?: number
  expectedGeneration?: number
  mappingStillValid?: boolean
  /** When set, current field text must still match this snapshot before write. */
  baselineSnapshot?: FieldSnapshot
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
    ...commitOptions
  } = options

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

  if (session && requestId !== undefined) {
    const gen = expectedGeneration ?? session.getGeneration()
    if (session.isStale(gen, requestId)) {
      return {
        verdict: 'stale',
        reason: gen !== session.getGeneration() ? 'stale-generation' : 'stale-request',
      }
    }
    const active = session.getActiveRequest()
    if (active && active.requestId !== requestId) {
      return { verdict: 'rejected', reason: 'mutex' }
    }
    if (active?.signal.aborted) {
      return { verdict: 'rejected', reason: 'aborted' }
    }
  }

  const originalWord = readFieldText(element).slice(start, end)
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
