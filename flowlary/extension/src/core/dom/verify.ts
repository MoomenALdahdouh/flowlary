import { readCaret, readFieldText, selectionOverlaps } from './read.ts'
import type { DiscardReason, EditableElement, FieldSnapshot, ReplacementSnapshot } from './types.ts'

export function currentGeneration(
  generations: WeakMap<Element, number>,
  element: Element,
): number {
  return generations.get(element) ?? 0
}

export type VerifyOptions = {
  allowActiveEdit?: boolean
  expectedGeneration?: number
}

export function verifyFieldSnapshot(
  snapshot: FieldSnapshot,
  expectedGeneration: number,
): DiscardReason | 'stale-generation' | null {
  if (!snapshot.element.isConnected) return 'disconnected'

  const currentText = readFieldText(snapshot.element)
  if (currentText !== snapshot.text) return 'text-mismatch'

  if (expectedGeneration !== snapshot.generation) return 'stale-generation'

  return null
}

export function verifyReplacement(
  snapshot: ReplacementSnapshot,
  replacement: string,
  generations: WeakMap<Element, number>,
  expectedElement?: EditableElement,
  options?: VerifyOptions,
): DiscardReason | null {
  if (!replacement || replacement === snapshot.originalWord) return 'invalid-replacement'
  if (!snapshot.element.isConnected) return 'disconnected'
  if (expectedElement && snapshot.element !== expectedElement) return 'wrong-node'

  const liveGeneration = currentGeneration(generations, snapshot.element)
  if (
    options?.expectedGeneration !== undefined &&
    liveGeneration !== options.expectedGeneration
  ) {
    return 'stale-generation'
  }
  if (liveGeneration !== snapshot.generation) {
    return 'stale-generation'
  }

  const text = readFieldText(snapshot.element)
  if (
    snapshot.wordStart < 0 ||
    snapshot.wordEnd < snapshot.wordStart ||
    snapshot.wordEnd > text.length
  ) {
    return 'missing-range'
  }

  const slice = text.slice(snapshot.wordStart, snapshot.wordEnd)
  if (slice !== snapshot.originalWord) return 'text-mismatch'

  if (!options?.allowActiveEdit) {
    const caret = readCaret(snapshot.element)
    if (caret !== null && caret > snapshot.wordStart && caret < snapshot.wordEnd) {
      return 'caret-inside-word'
    }

    if (selectionOverlaps(snapshot.element, snapshot.wordStart, snapshot.wordEnd)) {
      return 'selection-overlap'
    }
  }

  return null
}

export function verifySnapshotText(
  snapshotText: string,
  currentText: string,
  generation: number,
  expectedGeneration: number,
): DiscardReason | null {
  if (generation !== expectedGeneration) return 'stale-generation'
  if (snapshotText !== currentText) return 'text-mismatch'
  return null
}
