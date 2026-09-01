/**
 * Editor-host capability, not a site blocklist.
 * Value fields and simple contenteditable can auto-write.
 * Nested/rich composers stay on suggestion + shortcut until an adapter exists.
 */
import { looksLikeCodeEditor } from '../safety/codeEditor.ts'
import { isValueEditable } from './read.ts'

const STRUCTURED_HOST =
  '.ProseMirror, [data-lexical-editor], .ql-editor, .DraftEditor-root, [data-slate-editor], .cm-content, .monaco-editor, .ace_editor, .CodeMirror'

function isTextOrBreak(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE
    || (node instanceof HTMLElement && node.tagName === 'BR')
}

/**
 * Plain typing surface: only text and line breaks, optionally one wrapping
 * DIV/P/SPAN. Nested spans/widgets are treated as structured editors.
 */
export function isSimpleContentEditable(element: HTMLElement): boolean {
  if (!element.isContentEditable) return false
  const kids = [...element.childNodes]
  if (kids.length === 0) return true
  if (kids.every(isTextOrBreak)) return true
  if (
    kids.length === 1
    && kids[0] instanceof HTMLElement
    && ['DIV', 'P', 'SPAN'].includes(kids[0].tagName)
  ) {
    return [...kids[0].childNodes].every(isTextOrBreak)
  }
  return false
}

export function looksLikeStructuredEditor(element: HTMLElement): boolean {
  if (looksLikeCodeEditor(element)) return true
  if (element.closest(STRUCTURED_HOST) !== null) return true
  if (element.querySelector(STRUCTURED_HOST) !== null) return true
  return !isSimpleContentEditable(element)
}

export function allowsAutomaticEditorMutation(element: Element): boolean {
  if (element instanceof HTMLElement && looksLikeCodeEditor(element)) return false
  if (isValueEditable(element)) return true
  if (element instanceof HTMLElement && element.isContentEditable) {
    return !looksLikeStructuredEditor(element)
  }
  return false
}
