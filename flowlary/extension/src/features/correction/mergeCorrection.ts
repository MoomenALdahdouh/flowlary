import { extractWritingContext } from './segment.ts'

export function mergeCorrectionIntoField(
  current: string,
  source: string,
  corrected: string,
): string | null {
  if (!source) return null
  if (current === source) return corrected

  if (current.startsWith(source)) {
    return corrected + current.slice(source.length)
  }

  if (current.length > source.length && current.endsWith(source)) {
    return current.slice(0, current.length - source.length) + corrected
  }

  const idx = current.indexOf(source)
  if (idx >= 0 && current.indexOf(source, idx + 1) === -1) {
    return current.slice(0, idx) + corrected + current.slice(idx + source.length)
  }

  return null
}

export function canMergeCorrection(current: string, source: string): boolean {
  return mergeCorrectionIntoField(current, source, source) !== null
}

export function isResultStillRelevant(
  current: string,
  requestedText: string,
  segment: string,
  mode: 'box' | 'direct',
): boolean {
  if (mode === 'direct') {
    return canMergeCorrection(current, segment)
  }
  return (
    current === requestedText ||
    current.startsWith(requestedText) ||
    current.startsWith(segment) ||
    extractWritingContext(current) === segment
  )
}
