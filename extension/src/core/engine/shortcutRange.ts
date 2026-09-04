/**
 * Shared analysis for explicit shortcuts. User named the capability;
 * this only chooses the span. Does not chain capabilities.
 */
import { stateManager } from '../state/StateManager.ts'
import { analyzeFieldText } from './chunks.ts'
import type { OperationType } from '@flowlary/shared'
import type { TextRange } from './types.ts'

function overlaps(left: TextRange, right: TextRange): boolean {
  return left.start < right.end && right.start < left.end
}

export function shortcutRangeForOperation(
  text: string,
  operation: OperationType,
  selection: TextRange | null,
  caret = text.length,
): TextRange | null {
  if (operation === 'PIPELINE') return selection
  if (selection && selection.end > selection.start) return selection

  const analysis = analyzeFieldText(text, {
    caret,
    commitOpenToken: true,
    exceptions: [...stateManager.personalExceptions],
    vocabularyHashes: [...stateManager.vocabularyHashes],
  })

  if (operation === 'FIX_LAYOUT') {
    const spans = analysis.layoutSpans.filter((span) => span.replacement)
    if (spans.length === 0) return text.trim() ? { start: 0, end: text.length } : null
    const focused =
      selection && selection.end > selection.start
        ? spans.filter((span) => overlaps(span.range, selection))
        : spans
    const use = (focused.length > 0 ? focused : spans)
    return {
      start: Math.min(...use.map((span) => span.range.start)),
      end: Math.max(...use.map((span) => span.range.end)),
    }
  }

  if (operation === 'TRANSLATE') {
    const arabic = analysis.chunks.filter((chunk) => chunk.scripts.arabic > 0 && chunk.role !== 'protected')
    if (arabic.length === 0) return text.trim() ? { start: 0, end: text.length } : null
    return { start: arabic[0]!.range.start, end: arabic[arabic.length - 1]!.range.end }
  }

  const english = analysis.chunks.filter((chunk) => (
    chunk.role === 'english_prose' || chunk.role === 'possible_spelling_error'
  ))
  if (english.length === 0) return text.trim() ? { start: 0, end: text.length } : null
  return { start: english[0]!.range.start, end: english[english.length - 1]!.range.end }
}
