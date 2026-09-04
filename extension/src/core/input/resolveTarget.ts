import { createEditableAdapter, findEditableFromTarget, type EditableAdapter } from '../dom/adapter.ts'
import { looksLikeCodeEditor } from '../safety/codeEditor.ts'

export type CommandTarget = {
  element: Element
  adapter: EditableAdapter | null
}

/** Walk open shadow roots (and same-origin iframes) to the real focused control. */
export function deepActiveElement(
  root: Document | ShadowRoot | null | undefined = typeof document !== 'undefined' ? document : null,
): Element | null {
  if (!root) return null
  let el: Element | null = root.activeElement
  const seen = new Set<Element>()
  while (el && !seen.has(el)) {
    seen.add(el)
    if (el instanceof HTMLIFrameElement) {
      try {
        const inner = el.contentDocument
        if (inner) {
          const nested = deepActiveElement(inner)
          if (nested && nested !== inner.body && nested !== inner.documentElement) {
            el = nested
            continue
          }
        }
      } catch {
        break
      }
      break
    }
    const shadow = el instanceof HTMLElement ? el.shadowRoot : null
    if (shadow?.activeElement) {
      el = shadow.activeElement
      continue
    }
    break
  }
  return el
}

export function eventTargetForCommand(event: Event): EventTarget | null {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  const hit = path[0]
  return hit instanceof EventTarget ? hit : event.target
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
    ? deepActiveElement(document)
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
    const root = node.getRootNode()
    node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null)
  }

  return null
}
