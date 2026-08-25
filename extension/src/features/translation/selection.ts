import { isSafeToken, skipReasonForToken } from '../../core/safety/tokenKind.ts'
import { MAX_TRANSLATION_CHARS, type TranslateTarget } from './types.ts'
import { currentParagraph } from './segments.ts'

/**
 * Selection wins. Without a selection, use the current paragraph.
 * Never the entire page.
 */
export function resolveTranslateTarget(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): TranslateTarget | null {
  const from = Math.min(selectionStart, selectionEnd)
  const to = Math.max(selectionStart, selectionEnd)
  if (from !== to) {
    const slice = text.slice(from, to)
    if (!slice.trim()) return null
    if (slice.length > MAX_TRANSLATION_CHARS) return null
    return { start: from, end: to, text: slice, mode: 'selection' }
  }

  const paragraph = currentParagraph(text, from)
  if (!paragraph) return null
  if (paragraph.text.length > MAX_TRANSLATION_CHARS) return null
  return {
    start: paragraph.start,
    end: paragraph.end,
    text: paragraph.text,
    mode: 'context',
  }
}

export function targetLooksProtected(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (!/\s/.test(trimmed) && !isSafeToken(trimmed, '', trimmed)) return true
  const reason = skipReasonForToken(trimmed, '', trimmed)
  return (
    reason === 'jwt' ||
    reason === 'api-key' ||
    reason === 'access-token' ||
    reason === 'private-key' ||
    reason === 'credit-card' ||
    reason === 'password' ||
    reason === 'env-secret'
  )
}
