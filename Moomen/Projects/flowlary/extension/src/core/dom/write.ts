import { adjustCaret } from './caret.ts'
import {
  isValueEditable,
  mapOffsetToNode,
  readCaret,
  readFieldText,
  resolveEditableKind,
} from './read.ts'
import type { EditableElement, ReplacementSnapshot, WriteVerdict } from './types.ts'
import { verifyReplacement } from './verify.ts'
import { isControlledWriteActive, isProgrammaticInputType, withWriteOrigin } from './writeOrigin.ts'
import type { WriteOrigin } from '@flowlary/shared'

const generations = new WeakMap<Element, number>()
let writing = false

export function getGenerationMap(): WeakMap<Element, number> {
  return generations
}

export function bumpGeneration(element: Element, inputType?: string): void {
  if (writing || isControlledWriteActive() || isProgrammaticInputType(inputType)) return
  generations.set(element, (generations.get(element) ?? 0) + 1)
}

export function setDomGeneration(element: Element, generation: number): void {
  generations.set(element, generation)
}

export function snapshotGeneration(element: Element): number {
  return generations.get(element) ?? 0
}

export function captureReplacementSnapshot(
  element: EditableElement,
  originalWord: string,
  wordStart: number,
  wordEnd: number,
  caret: number,
): ReplacementSnapshot {
  const kind = resolveEditableKind(element)
  if (!kind) throw new Error('Element is not editable')
  return {
    element,
    kind,
    originalWord,
    wordStart,
    wordEnd,
    caret,
    timestamp: Date.now(),
    generation: snapshotGeneration(element),
  }
}

export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) {
    setter.call(element, value)
    return
  }
  element.value = value
}

export type CommitOptions = {
  allowActiveEdit?: boolean
  placeCaretAfter?: boolean
}

function restoreValueCaret(
  element: HTMLInputElement | HTMLTextAreaElement,
  snapshot: ReplacementSnapshot,
  nextLength: number,
  replacementLength: number,
  options?: CommitOptions,
): void {
  const nextCaret = options?.placeCaretAfter
    ? snapshot.wordStart + replacementLength
    : adjustCaret(
        element.selectionStart ?? snapshot.caret,
        snapshot.wordStart,
        snapshot.wordEnd,
        replacementLength,
      )
  const clamped = Math.max(0, Math.min(nextLength, nextCaret))
  element.setSelectionRange(clamped, clamped)
}

function restoreContentCaret(
  element: HTMLElement,
  snapshot: ReplacementSnapshot,
  replacementLength: number,
  options?: CommitOptions,
): void {
  const nextCaret = options?.placeCaretAfter
    ? snapshot.wordStart + replacementLength
    : adjustCaret(
        readCaret(element) ?? snapshot.caret,
        snapshot.wordStart,
        snapshot.wordEnd,
        replacementLength,
      )
  const point = mapOffsetToNode(element, nextCaret)
  if (!point) return
  const range = document.createRange()
  range.setStart(point.node, point.offset)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function writeValue(
  snapshot: ReplacementSnapshot,
  replacement: string,
  options?: CommitOptions,
): WriteVerdict {
  if (!isValueEditable(snapshot.element)) return 'discarded'
  const current = snapshot.element.value
  const next =
    current.slice(0, snapshot.wordStart) +
    replacement +
    current.slice(snapshot.wordEnd)

  writing = true
  try {
    setNativeValue(snapshot.element, next)
    snapshot.element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertReplacementText',
        data: replacement,
      }),
    )
    restoreValueCaret(
      snapshot.element,
      snapshot,
      next.length,
      replacement.length,
      options,
    )
  } finally {
    writing = false
  }
  return 'written'
}

function writeContentEditable(
  snapshot: ReplacementSnapshot,
  replacement: string,
  options?: CommitOptions,
): WriteVerdict {
  const element = snapshot.element
  if (!(element instanceof HTMLElement) || !element.isContentEditable) {
    return 'discarded'
  }

  const start = mapOffsetToNode(element, snapshot.wordStart)
  const end = mapOffsetToNode(element, snapshot.wordEnd)
  if (!start || !end) return 'discarded'

  writing = true
  try {
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    range.deleteContents()
    range.insertNode(document.createTextNode(replacement))
    element.normalize()
    restoreContentCaret(element, snapshot, replacement.length, options)
  } finally {
    writing = false
  }
  return 'written'
}

export function commitReplacement(
  snapshot: ReplacementSnapshot,
  replacement: string,
  mappingStillValid = true,
  expectedElement?: EditableElement,
  options?: CommitOptions,
  origin: WriteOrigin = 'SYSTEM',
): WriteVerdict {
  if (!mappingStillValid) return 'discarded'
  if (
    verifyReplacement(snapshot, replacement, generations, expectedElement, options)
  ) {
    return 'discarded'
  }

  const latest = readFieldText(snapshot.element)
  if (latest.slice(snapshot.wordStart, snapshot.wordEnd) !== snapshot.originalWord) {
    return 'discarded'
  }

  let verdict: WriteVerdict = 'discarded'
  withWriteOrigin(origin, () => {
    verdict =
      snapshot.kind === 'value'
        ? writeValue(snapshot, replacement, options)
        : writeContentEditable(snapshot, replacement, options)
  })
  return verdict
}

export function isWriting(): boolean {
  return writing
}
