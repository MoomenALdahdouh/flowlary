import { adjustCaret } from './caret.ts'
import { isSimpleContentEditable } from './editorHost.ts'
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
  let nextCaret = options?.placeCaretAfter
    ? snapshot.wordStart + replacementLength
    : adjustCaret(
        element.selectionStart ?? snapshot.caret,
        snapshot.wordStart,
        snapshot.wordEnd,
        replacementLength,
      )
  if (!options?.placeCaretAfter && snapshot.caret >= snapshot.wordEnd) {
    let index = snapshot.wordStart + replacementLength
    while (index < element.value.length && /\s/.test(element.value[index]!)) index += 1
    if (index > snapshot.wordStart + replacementLength) nextCaret = index
  }
  const clamped = Math.max(0, Math.min(nextLength, nextCaret))
  element.setSelectionRange(clamped, clamped)
}

function restoreContentCaret(
  element: HTMLElement,
  snapshot: ReplacementSnapshot,
  replacementLength: number,
  options?: CommitOptions,
): void {
  let nextCaret = options?.placeCaretAfter
    ? snapshot.wordStart + replacementLength
    : adjustCaret(
        readCaret(element) ?? snapshot.caret,
        snapshot.wordStart,
        snapshot.wordEnd,
        replacementLength,
      )
  if (!options?.placeCaretAfter && snapshot.caret >= snapshot.wordEnd) {
    const text = readFieldText(element)
    let index = snapshot.wordStart + replacementLength
    while (index < text.length && /\s/.test(text[index]!)) index += 1
    if (index > snapshot.wordStart + replacementLength) nextCaret = index
  }
  const clamped = Math.max(0, Math.min(readFieldText(element).length, nextCaret))
  const point = mapOffsetToNode(element, clamped)
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
    const field = snapshot.element
    field.focus()
    try {
      field.setSelectionRange(snapshot.wordStart, snapshot.wordEnd)
    } catch {
      /* some input types reject ranges */
    }
    const inserted =
      typeof document !== 'undefined'
      && typeof document.execCommand === 'function'
      && document.execCommand('insertText', false, replacement)
    if (!inserted || field.value !== next) {
      if (typeof field.setRangeText === 'function') {
        field.setRangeText(replacement, snapshot.wordStart, snapshot.wordEnd, 'end')
      }
      if (field.value !== next) {
        setNativeValue(field, next)
      }
    }
    field.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertReplacementText',
        data: replacement,
      }),
    )
    restoreValueCaret(
      field,
      snapshot,
      field.value.length,
      replacement.length,
      options,
    )
  } finally {
    writing = false
  }
  return 'written'
}

function expectedReplacedText(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end)
}

function selectLogicalRange(element: HTMLElement, start: number, end: number): boolean {
  const startPoint = mapOffsetToNode(element, start)
  const endPoint = mapOffsetToNode(element, end)
  if (!startPoint || !endPoint) return false
  const range = document.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  return true
}

function spliceContentEditableRange(
  element: HTMLElement,
  start: number,
  end: number,
  replacement: string,
): boolean {
  const startPoint = mapOffsetToNode(element, start)
  const endPoint = mapOffsetToNode(element, end)
  if (!startPoint || !endPoint) return false
  if (startPoint.node === endPoint.node) {
    const node = startPoint.node
    node.data = node.data.slice(0, startPoint.offset) + replacement + node.data.slice(endPoint.offset)
    return true
  }
  const range = document.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  range.deleteContents()
  range.insertNode(document.createTextNode(replacement))
  element.normalize()
  return true
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

  const current = readFieldText(element)
  const next = expectedReplacedText(current, snapshot.wordStart, snapshot.wordEnd, replacement)
  if (
    !isSimpleContentEditable(element)
    && (
      !mapOffsetToNode(element, snapshot.wordStart)
      || !mapOffsetToNode(element, snapshot.wordEnd)
    )
  ) {
    return 'discarded'
  }

  writing = true
  try {
    element.focus()
    let wrote = false
    if (
      selectLogicalRange(element, snapshot.wordStart, snapshot.wordEnd)
      && typeof document.execCommand === 'function'
    ) {
      wrote = document.execCommand('insertText', false, replacement)
    }
    if (!wrote || readFieldText(element) !== next) {
      spliceContentEditableRange(element, snapshot.wordStart, snapshot.wordEnd, replacement)
    }
    if (readFieldText(element) !== next && isSimpleContentEditable(element)) {
      element.textContent = next
    }
    if (readFieldText(element) !== next) {
      if (isSimpleContentEditable(element)) element.textContent = current
      return 'discarded'
    }
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertReplacementText',
        data: replacement,
      }),
    )
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
