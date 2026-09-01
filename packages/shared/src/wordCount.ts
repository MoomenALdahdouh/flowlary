/**
 * Deterministic English word counter for Progress metrics.
 * Punctuation attached to words counts as part of the word token.
 * Empty and whitespace-only input returns 0.
 */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  let count = 0
  for (const token of tokens) {
    if (/[A-Za-z0-9]/.test(token)) count += 1
  }
  return count
}
