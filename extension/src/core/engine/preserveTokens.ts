/**
 * Keep intentional Latin tokens intact across an existing translation call.
 * Placeholders are restored after the provider returns; no new translation stack.
 */
import type { WritingChunk } from './types.ts'
import { isTechnicalToken } from './technicalTokens.ts'

const PRESERVE_ROLES = new Set([
  'technical_token',
  'intentional_foreign_token',
  'identifier',
  'code',
  'url',
  'email',
])

export type PreservePlan = {
  payload: string
  restore: (translated: string) => { ok: true; text: string } | { ok: false; reason: 'preserve_lost' }
  kept: readonly string[]
}

function overlaps(start: number, end: number, range: { start: number; end: number }): boolean {
  return range.start < end && start < range.end
}

export function shouldPreserveChunk(chunk: WritingChunk, token: string): boolean {
  if (PRESERVE_ROLES.has(chunk.role)) return true
  if (chunk.protectedKind) return true
  return isTechnicalToken(token)
}

export function planPreservedTranslation(
  fullText: string,
  rangeStart: number,
  rangeEnd: number,
  chunks: readonly WritingChunk[],
): PreservePlan {
  const source = fullText.slice(rangeStart, rangeEnd)
  const kept: { placeholder: string; token: string }[] = []
  let payload = source
  let offset = 0

  const ordered = chunks
    .filter((chunk) => overlaps(rangeStart, rangeEnd, chunk.range))
    .sort((a, b) => a.range.start - b.range.start)

  for (const chunk of ordered) {
    const token = fullText.slice(chunk.range.start, chunk.range.end)
    if (!token || !shouldPreserveChunk(chunk, token)) continue
    const localStart = chunk.range.start - rangeStart + offset
    const localEnd = localStart + token.length
    if (payload.slice(localStart, localEnd) !== token) continue
    const placeholder = `⟦p${kept.length}⟧`
    payload = payload.slice(0, localStart) + placeholder + payload.slice(localEnd)
    offset += placeholder.length - token.length
    kept.push({ placeholder, token })
  }

  return {
    payload,
    kept: kept.map((item) => item.token),
    restore(translated: string) {
      let text = translated
      for (const item of kept) {
        if (text.includes(item.placeholder)) {
          text = text.split(item.placeholder).join(item.token)
          continue
        }
        if (!text.includes(item.token)) {
          return { ok: false, reason: 'preserve_lost' }
        }
      }
      return { ok: true, text }
    },
  }
}
