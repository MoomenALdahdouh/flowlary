import type { EditableElement, FieldSnapshot, SelectionRange } from './types.ts'
import {
  isEditableElement,
  isValueEditable,
  readFieldText,
  readCaret,
  readSelectionRange,
  resolveEditableKind,
} from './read.ts'
import { createFieldSnapshot } from './read.ts'
import { looksLikeCodeEditor } from '../safety/codeEditor.ts'

export type EditableKind = 'textarea' | 'text' | 'contenteditable'

export interface EditableAdapter {
  readonly element: EditableElement
  readonly kind: EditableKind
  getText(): string
  getCaret(): number | null
  getSelection(): SelectionRange | null
  createSnapshot(generation: number): FieldSnapshot
  isDisabled(): boolean
}

class ValueAdapter implements EditableAdapter {
  readonly kind: EditableKind
  constructor(
    readonly element: HTMLInputElement | HTMLTextAreaElement,
    kind: 'textarea' | 'text',
  ) {
    this.kind = kind
  }

  getText(): string {
    return readFieldText(this.element)
  }

  getCaret(): number | null {
    return readCaret(this.element)
  }

  getSelection(): SelectionRange | null {
    return readSelectionRange(this.element)
  }

  createSnapshot(generation: number): FieldSnapshot {
    return createFieldSnapshot(this.element, generation)
  }

  isDisabled(): boolean {
    return this.element.disabled || this.element.readOnly
  }
}

class ContentEditableAdapter implements EditableAdapter {
  readonly kind = 'contenteditable' as const
  constructor(readonly element: HTMLElement) {}

  getText(): string {
    return readFieldText(this.element)
  }

  getCaret(): number | null {
    return readCaret(this.element)
  }

  getSelection(): SelectionRange | null {
    return readSelectionRange(this.element)
  }

  createSnapshot(generation: number): FieldSnapshot {
    return createFieldSnapshot(this.element, generation)
  }

  isDisabled(): boolean {
    return !this.element.isContentEditable
  }
}

const IGNORED_INPUT_TYPES = new Set([
  'password',
  'email',
  'number',
  'tel',
  'url',
  'search',
  'hidden',
  'file',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'image',
  'color',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
  'range',
])

export function createEditableAdapter(el: Element): EditableAdapter | null {
  if (!(el instanceof HTMLElement)) return null
  if (looksLikeCodeEditor(el)) return null

  if (el instanceof HTMLTextAreaElement) {
    if (el.disabled || el.readOnly) return null
    return new ValueAdapter(el, 'textarea')
  }

  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (IGNORED_INPUT_TYPES.has(type)) return null
    if (type !== 'text' && type !== '') return null
    if (el.disabled || el.readOnly) return null
    return new ValueAdapter(el, 'text')
  }

  const editableAttr = el.getAttribute('contenteditable')
  if (el.isContentEditable || editableAttr === 'true' || editableAttr === '') {
    const host = el.closest(
      '[contenteditable="true"], [contenteditable=""], [contenteditable]',
    ) as HTMLElement | null
    const target = host && host.isContentEditable !== false ? host : el
    if (looksLikeCodeEditor(target)) return null
    return new ContentEditableAdapter(target)
  }

  return null
}

export function findEditableFromTarget(target: EventTarget | null): EditableAdapter | null {
  if (!(target instanceof Element)) return null
  let node: Element | null = target
  while (node) {
    const adapter = createEditableAdapter(node)
    if (adapter) return adapter
    if (
      node.parentElement?.isContentEditable ||
      node.parentElement?.getAttribute('contenteditable') === 'true'
    ) {
      const parentAdapter = createEditableAdapter(node.parentElement)
      if (parentAdapter) return parentAdapter
    }
    node = node.parentElement
  }
  return null
}

export function isSupportedEditable(el: Element): boolean {
  return createEditableAdapter(el) !== null
}

export { isEditableElement, resolveEditableKind, looksLikeCodeEditor }
