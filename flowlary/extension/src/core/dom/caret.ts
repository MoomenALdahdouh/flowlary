export function adjustCaret(
  caret: number,
  start: number,
  end: number,
  replacementLength: number,
): number {
  if (caret <= start) return caret
  if (caret >= end) return caret + (replacementLength - (end - start))
  return start + replacementLength
}
