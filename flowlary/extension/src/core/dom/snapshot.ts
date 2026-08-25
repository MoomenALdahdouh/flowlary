import type { DiscardReason, EditableElement, FieldSnapshot, ReplacementSnapshot } from './types.ts'
import { fieldIdentity } from '../session/FieldSession.ts'
import {
  readCaret as readCaretOffset,
  readFieldText,
  readSelectionRange,
  resolveEditableKind,
} from './read.ts'
import { generationTracker } from './generation.ts'
import { verifyReplacement } from './verify.ts'
import { getGenerationMap } from './write.ts'

/** Canonical read API */
export function readText(element: EditableElement): string {
  return readFieldText(element)
}

export function readCaret(element: EditableElement): number | null {
  return readCaretOffset(element)
}

export function readSelection(element: EditableElement) {
  return readSelectionRange(element)
}

export function readSelectionDirection(
  element: EditableElement,
): 'forward' | 'backward' | 'none' | null {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const dir = element.selectionDirection
    if (dir === 'forward' || dir === 'backward' || dir === 'none') return dir
  }
  return null
}

/** Create a full-field snapshot bound to the current generation. */
export function createSnapshot(
  element: EditableElement,
  generation = generationTracker.getGeneration(element),
): FieldSnapshot {
  const kind = resolveEditableKind(element)
  if (!kind) throw new Error('Element is not editable')
  return {
    fieldId: fieldIdentity(element),
    element,
    kind,
    text: readFieldText(element),
    caret: readCaretOffset(element),
    selection: readSelectionRange(element),
    selectionDirection: readSelectionDirection(element),
    generation,
    timestamp: Date.now(),
  }
}

export type VerifySnapshotResult =
  | { valid: true }
  | { valid: false; reason: DiscardReason; stale: boolean }

/** Verify snapshot against live field state and expected generation. */
export function verifySnapshot(
  snapshot: FieldSnapshot,
  expectedGeneration?: number,
): VerifySnapshotResult {
  const generation = expectedGeneration ?? snapshot.generation

  if (!snapshot.element.isConnected) {
    return { valid: false, reason: 'disconnected', stale: true }
  }

  const liveGeneration = generationTracker.getGeneration(snapshot.element)
  if (liveGeneration !== generation) {
    return { valid: false, reason: 'stale-generation', stale: true }
  }

  const liveText = readFieldText(snapshot.element)
  if (liveText !== snapshot.text) {
    return { valid: false, reason: 'text-mismatch', stale: true }
  }

  return { valid: true }
}

export function captureRangeSnapshot(
  element: EditableElement,
  originalText: string,
  start: number,
  end: number,
  caret: number,
): ReplacementSnapshot {
  const kind = resolveEditableKind(element)
  if (!kind) throw new Error('Element is not editable')
  return {
    fieldId: fieldIdentity(element),
    element,
    kind,
    originalWord: originalText,
    wordStart: start,
    wordEnd: end,
    caret,
    timestamp: Date.now(),
    generation: generationTracker.getGeneration(element),
  }
}

export function verifyRangeSnapshot(
  snapshot: ReplacementSnapshot,
  replacement: string,
  options?: { allowActiveEdit?: boolean; expectedGeneration?: number },
): VerifySnapshotResult {
  const reason = verifyReplacement(
    snapshot,
    replacement,
    getGenerationMap(),
    snapshot.element,
    {
      allowActiveEdit: options?.allowActiveEdit,
      expectedGeneration: options?.expectedGeneration ?? snapshot.generation,
    },
  )
  if (reason) {
    return {
      valid: false,
      reason,
      stale:
        reason === 'stale-generation' ||
        reason === 'text-mismatch' ||
        reason === 'region-edited',
    }
  }
  return { valid: true }
}

export function restoreSelection(
  element: EditableElement,
  range: { start: number; end: number },
  direction?: 'forward' | 'backward' | 'none' | null,
): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.setSelectionRange(range.start, range.end, direction ?? undefined)
    return
  }

  const selection = window.getSelection()
  if (!selection) return
  const startPoint = mapOffsetToNodeForRestore(element, range.start)
  const endPoint = mapOffsetToNodeForRestore(element, range.end)
  if (!startPoint || !endPoint) return
  const domRange = document.createRange()
  domRange.setStart(startPoint.node, startPoint.offset)
  domRange.setEnd(endPoint.node, endPoint.offset)
  selection.removeAllRanges()
  selection.addRange(domRange)
}

function mapOffsetToNodeForRestore(
  element: HTMLElement,
  offset: number,
): { node: Text; offset: number } | null {
  let remaining = offset
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let current: Node | null
  while ((current = walker.nextNode())) {
    const text = current as Text
    if (remaining <= text.data.length) return { node: text, offset: remaining }
    remaining -= text.data.length
  }
  return null
}
