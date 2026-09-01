/**
 * Editor auto-write capability.
 * Value fields and simple contenteditable auto-write through the Write Gate.
 * Structured/rich composers stay on suggestion + shortcut (not a site blacklist).
 * Code editors stay blocked (safety).
 */

import { allowsAutomaticEditorMutation } from '../dom/editorHost.ts'

export const AUTO_WRITE_BLOCKED_REASON = 'unsupported_editor_auto_write' as const

export function allowsAutomaticFieldWrite(element: Element): boolean {
  return allowsAutomaticEditorMutation(element)
}
