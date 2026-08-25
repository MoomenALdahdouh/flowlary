/** Tokenizer — ported from Lingo for layout/translation boundary detection (Phase 4+). */

export type TokenSpan = {
  token: string
  start: number
  end: number
}

const WHITESPACE = /\s/u

export function tokenizeText(text: string): TokenSpan[] {
  const tokens: TokenSpan[] = []
  let index = 0
  while (index < text.length) {
    if (WHITESPACE.test(text[index]!)) {
      index += 1
      continue
    }
    let end = index + 1
    while (end < text.length && !WHITESPACE.test(text[end]!)) {
      end += 1
    }
    tokens.push({ token: text.slice(index, end), start: index, end })
    index = end
  }
  return tokens
}

export function lastCompletedToken(
  text: string,
  caret: number,
  requireBoundary: boolean,
): TokenSpan | null {
  const before = text.slice(0, caret)
  const tokens = tokenizeText(before)
  const last = tokens.at(-1)
  if (!last) return null
  if (requireBoundary && !WHITESPACE.test(text[last.end] ?? '')) {
    return null
  }
  return last
}
