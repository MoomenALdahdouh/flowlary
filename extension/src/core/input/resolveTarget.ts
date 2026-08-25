import { createEditableAdapter, findEditableFromTarget, type EditableAdapter } from '../dom/adapter.ts'
import { looksLikeCodeEditor } from '../safety/codeEditor.ts'

export type CommandTarget = {
  element: Element
  adapter: EditableAdapter | null
}

/**
 * Canonical command-target resolution.
 * Reuses EditableAdapter / DOM layer — does not invent a second field detector.
 *
 * Falls back to raw form controls / contenteditable / code editors so the
 * Safety Gate can block them (password, OTP, Monaco, …) instead of returning no_target.
 */
export function resolveCommandTarget(
  from: EventTarget | null | undefined = typeof document !== 'undefined'
    ? document.activeElement
    : null,
): CommandTarget | null {
  const adapter = findEditableFromTarget(from ?? null)
  if (adapter) {
    return { element: adapter.element, adapter }
  }

  let node: Element | null = from instanceof Element ? from : null
  while (node) {
    if (node instanceof HTMLElement && looksLikeCodeEditor(node)) {
      return { element: node, adapter: null }
    }
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      return { element: node, adapter: createEditableAdapter(node) }
    }
    if (node instanceof HTMLElement && node.isContentEditable) {
      return { element: node, adapter: createEditableAdapter(node) }
    }
    node = node.parentElement
  }

  return null
}
