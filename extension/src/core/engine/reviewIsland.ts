import {
  WRITING_REVIEW_MAX_CONTEXT,
  WRITING_REVIEW_MAX_SNIPPET,
} from '@flowlary/shared'
import { lastCompletedSegment } from '../../features/translation/segments.ts'
import type { SharedAnalysis, TextRange } from './types.ts'

const ARABIC = /[\u0600-\u06FF]/
const LATIN = /[A-Za-z]/

export const REVIEW_SENSITIVE_SKIP = new Set([
  'jwt',
  'api-key',
  'access-token',
  'private-key',
  'auth-header',
  'password',
  'env-secret',
  'credit-card',
  'hash',
  'url',
  'email',
  'uuid',
])

export type ReviewIsland = {
  range: TextRange
  snippet: string
  contextBefore: string
  contextAfter: string
  monolingualEnglish: boolean
}

function latinRunAt(text: string, from: number, to: number, caret: number): TextRange | null {
  const runs: TextRange[] = []
  let start: number | null = null
  for (let i = from; i < to; i += 1) {
    const char = text[i]!
    const latin = LATIN.test(char) || (start !== null && /[\s.,!?'"()\-:;]/.test(char) && !ARABIC.test(char))
    if (LATIN.test(char)) {
      if (start === null) start = i
    } else if (ARABIC.test(char)) {
      if (start !== null) {
        runs.push({ start, end: i })
        start = null
      }
    } else if (!latin && start !== null && /\s/.test(char)) {
      continue
    } else if (start !== null && !LATIN.test(char) && !/[\s.,!?'"()\-:;]/.test(char)) {
      runs.push({ start, end: i })
      start = null
    }
  }
  if (start !== null) runs.push({ start, end: to })
  const letterRuns = runs.filter((run) => LATIN.test(text.slice(run.start, run.end)))
  if (letterRuns.length === 0) return null
  const containing = letterRuns.find((run) => run.start <= caret && caret <= run.end)
  return containing ?? letterRuns[letterRuns.length - 1]!
}

export function fieldHasSensitiveTokens(analysis: SharedAnalysis): boolean {
  return analysis.chunks.some((chunk) => (
    (chunk.protectedKind != null && REVIEW_SENSITIVE_SKIP.has(chunk.protectedKind))
    || chunk.role === 'url'
    || chunk.role === 'email'
    || chunk.role === 'code'
  ))
}

export function extractReviewIsland(
  text: string,
  caret: number,
  analysis: SharedAnalysis,
): ReviewIsland | null {
  if (!text.trim() || fieldHasSensitiveTokens(analysis)) return null
  const segment = lastCompletedSegment(text, caret, { requireBoundary: false })
  const from = segment?.start ?? Math.max(0, caret - WRITING_REVIEW_MAX_SNIPPET)
  const to = segment?.end ?? Math.min(text.length, caret)
  if (to - from < 3) return null
  const windowText = text.slice(from, to)
  if (ARABIC.test(windowText) && LATIN.test(windowText)) {
    const run = latinRunAt(text, from, to, caret)
    if (!run) return null
    return clipIsland(text, run)
  }
  if (!LATIN.test(windowText)) return null
  return clipIsland(text, { start: from, end: to })
}

function clipIsland(text: string, range: TextRange): ReviewIsland | null {
  let { start, end } = range
  if (end - start > WRITING_REVIEW_MAX_SNIPPET) {
    start = Math.max(start, end - WRITING_REVIEW_MAX_SNIPPET)
  }
  const snippet = text.slice(start, end)
  if ((snippet.match(/[A-Za-z]/g) ?? []).length < 3) return null
  return {
    range: { start, end },
    snippet,
    contextBefore: text.slice(Math.max(0, start - WRITING_REVIEW_MAX_CONTEXT), start),
    contextAfter: text.slice(end, Math.min(text.length, end + WRITING_REVIEW_MAX_CONTEXT)),
    monolingualEnglish: LATIN.test(snippet) && !ARABIC.test(snippet),
  }
}
