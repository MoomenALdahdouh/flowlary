/**
 * Explicit user selection captured for a manual shortcut.
 * Ranges use the shared field-text UTF-16 coordinate system.
 * Never recover a stale selection via substring search.
 */
import type { Command } from '@flowlary/shared'
import type { TextRange } from './types.ts'

export type ShortcutSelectionTarget = {
  start: number
  end: number
  text: string
}

export function isExplicitShortcutSelection(command: Command): boolean {
  return (
    command.explicitSelection === true
    && typeof command.rangeStart === 'number'
    && typeof command.rangeEnd === 'number'
    && command.rangeEnd > command.rangeStart
  )
}

/**
 * Resolve the immutable selection snapshot from a command + live field text.
 * Returns null when the stamped range no longer matches the dispatch snapshot.
 * Never searches for the selected string elsewhere in the field.
 */
export function resolveExplicitSelectionTarget(
  fullText: string,
  command: Command,
): ShortcutSelectionTarget | null {
  if (!isExplicitShortcutSelection(command)) return null
  const start = command.rangeStart!
  const end = command.rangeEnd!
  if (start < 0 || end > fullText.length || end > command.text.length || start >= end) {
    return null
  }
  const stamped = command.text.slice(start, end)
  const live = fullText.slice(start, end)
  if (!stamped || live !== stamped) return null
  return { start, end, text: stamped }
}

export function selectionRangeOf(target: ShortcutSelectionTarget): TextRange {
  return { start: target.start, end: target.end }
}
