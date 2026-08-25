import { CORRECTION_DEFAULTS } from '@flowlary/shared'

const SHORT_CONTEXT_CHARS = 280
const PARAGRAPH_SOFT_MAX = 480

export function extractWritingContext(text: string): string {
  const paragraphs = text.split(/\n{2,}/)
  let chunk = paragraphs.length > 1 ? (paragraphs[paragraphs.length - 1] ?? text) : text

  if (chunk.length <= SHORT_CONTEXT_CHARS && paragraphs.length === 1) return text

  if (chunk.length > PARAGRAPH_SOFT_MAX) {
    const sentences = chunk.match(/[^\n.!?]+(?:[.!?]["')\]]*)?/g)
    if (sentences && sentences.length > 1) {
      chunk = sentences.slice(-2).join('').trimStart()
    } else {
      chunk = chunk.slice(-PARAGRAPH_SOFT_MAX).trimStart()
    }
  }

  if (chunk.length <= CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS) return chunk

  const slice = chunk.slice(-CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS)
  const idx = slice.search(/[.!?]\s/)
  if (idx > 0 && idx < slice.length / 2) return slice.slice(idx + 1).trimStart()
  return slice
}
