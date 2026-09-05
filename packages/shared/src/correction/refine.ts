import type { ChangeType, CorrectionChange, CorrectionResponse } from './index.ts'

const TOKEN_RE = /(\s+|[A-Za-z0-9]+(?:'[A-Za-z]+)?|[^\sA-Za-z0-9])/g
const FUNCTION_WORDS = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or'])

export function tokenizeCorrection(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

function lcsTable(a: string[], b: string[]): number[][] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i]![j] = dp[i + 1]![j + 1]! + 1
      else dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  return dp
}

function isWordToken(token: string): boolean {
  return /[A-Za-z]/.test(token)
}

const HOMOPHONE_PAIRS = new Set([
  'now|know',
  'know|now',
  'no|know',
  'know|no',
  "your|you're",
  "you're|your",
  'then|than',
  'than|then',
  'loose|lose',
  'lose|loose',
])

export function classifyCorrectionPair(original: string, corrected: string): ChangeType {
  const o = original.trim()
  const c = corrected.trim()
  if (!o || !c) return 'grammar'
  if (o.toLowerCase() === c.toLowerCase()) return 'grammar'
  const oWords = o.split(/\s+/).filter(Boolean)
  const cWords = c.split(/\s+/).filter(Boolean)
  if (/^[^\sA-Za-z0-9]+$/.test(o) || /^[^\sA-Za-z0-9]+$/.test(c)) return 'grammar'
  if (HOMOPHONE_PAIRS.has(`${o.toLowerCase()}|${c.toLowerCase()}`)) return 'wording'
  if (oWords.length === 1 && cWords.length === 1 && /^[A-Za-z']+$/.test(o) && /^[A-Za-z']+$/.test(c)) {
    const maxLen = Math.max(o.length, c.length)
    const minLen = Math.min(o.length, c.length)
    if (maxLen <= 16 && minLen >= maxLen - 4) return 'spelling'
    return 'wording'
  }
  if (cWords.some((word) => FUNCTION_WORDS.has(word.toLowerCase())) && oWords.length < cWords.length) {
    return 'grammar'
  }
  if (oWords.length !== cWords.length) return 'grammar'
  return 'wording'
}

/** Strip unchanged prefix/suffix tokens so a sentence-level pair becomes the real word fix. */
export function tightenCorrectionPair(
  original: string,
  corrected: string,
): { original: string; corrected: string } {
  if (original === corrected) return { original, corrected }
  const a = tokenizeCorrection(original)
  const b = tokenizeCorrection(corrected)
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1
  let endA = a.length - 1
  let endB = b.length - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA -= 1
    endB -= 1
  }
  const tightOriginal = a.slice(start, endA + 1).join('').trim()
  const tightCorrected = b.slice(start, endB + 1).join('').trim()
  if (!tightOriginal && !tightCorrected) return { original, corrected }
  return {
    original: tightOriginal || original.trim(),
    corrected: tightCorrected || corrected.trim(),
  }
}

type DiffOp =
  | { kind: 'equal'; token: string }
  | { kind: 'delete'; token: string }
  | { kind: 'insert'; token: string }

function diffOps(original: string, corrected: string): DiffOp[] {
  const a = tokenizeCorrection(original)
  const b = tokenizeCorrection(corrected)
  const dp = lcsTable(a, b)
  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'equal', token: a[i]! })
      i += 1
      j += 1
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: 'delete', token: a[i]! })
      i += 1
    } else {
      ops.push({ kind: 'insert', token: b[j]! })
      j += 1
    }
  }
  while (i < a.length) {
    ops.push({ kind: 'delete', token: a[i++]! })
  }
  while (j < b.length) {
    ops.push({ kind: 'insert', token: b[j++]! })
  }
  return ops
}

/**
 * One change per real edit (word or small phrase), never the whole sentence.
 */
function splitPunctuationChange(change: CorrectionChange): CorrectionChange[] {
  const match = change.corrected.match(/^([\s\S]*?)([.!?,;:]+)(\s*)$/)
  if (!match || !match[1] || match[1] === change.original) return [change]
  const word = match[1]
  const marks = match[2]!
  return [
    {
      ...change,
      corrected: word,
      type: classifyCorrectionPair(change.original, word),
    },
    {
      type: 'grammar',
      original: '',
      corrected: marks,
      start: change.end,
      end: change.end,
    },
  ]
}

export function deriveCorrectionChanges(originalText: string, correctedText: string): CorrectionChange[] {
  if (originalText === correctedText) return []
  const ops = diffOps(originalText, correctedText)
  const changes: CorrectionChange[] = []
  let originalCursor = 0
  let index = 0

  while (index < ops.length) {
    const op = ops[index]!
    if (op.kind === 'equal') {
      originalCursor += op.token.length
      index += 1
      continue
    }

    let deleted = ''
    let inserted = ''
    const start = originalCursor
    while (index < ops.length && ops[index]!.kind !== 'equal') {
      const current = ops[index]!
      if (current.kind === 'delete') {
        deleted += current.token
        originalCursor += current.token.length
      } else {
        inserted += current.token
      }
      index += 1
    }

    const nextEqual = ops[index]
    if (!deleted.trim() && inserted.trim() && nextEqual?.kind === 'equal' && isWordToken(nextEqual.token)) {
      const word = nextEqual.token
      const original = word
      const corrected = `${inserted.trim()} ${word}`.replace(/\s+/g, ' ')
      changes.push({
        type: classifyCorrectionPair(original, corrected),
        original,
        corrected,
        start: originalCursor,
        end: originalCursor + word.length,
      })
      originalCursor += word.length
      index += 1
      continue
    }

    const original = deleted
    const corrected = inserted
    if (original === corrected) continue
    if (!original.trim() && !corrected.trim()) continue
    changes.push({
      type: classifyCorrectionPair(original, corrected),
      original,
      corrected,
      start,
      end: start + original.length,
    })
  }

  return changes.flatMap(splitPunctuationChange).filter((change) => change.original !== change.corrected)
}

export function finalizeCorrectionResponse(
  sourceText: string,
  response: Pick<CorrectionResponse, 'correctedText' | 'changes'>,
  repairCorrected: (text: string) => string = (text) => text,
): CorrectionResponse {
  const correctedText = repairCorrected(response.correctedText)
  const derived = deriveCorrectionChanges(sourceText, correctedText)
  const fromModel = response.changes
    .map((change) => {
      const tight = tightenCorrectionPair(change.original, change.corrected)
      if (tight.original === tight.corrected) return null
      const start = sourceText.indexOf(tight.original)
      return {
        type: change.type,
        original: tight.original,
        corrected: tight.corrected,
        start: start >= 0 ? start : change.start,
        end: start >= 0 ? start + tight.original.length : change.end,
      } satisfies CorrectionChange
    })
    .filter((change): change is CorrectionChange => Boolean(change))

  const changes =
    derived.length > 0 ? preserveAuthoritativeLayoutTypes(derived, fromModel) : fromModel
  return {
    originalText: sourceText,
    correctedText,
    changes,
  }
}

/**
 * Derived diffs own the replacement text and offsets. Model `layout` remains
 * the type source of truth for those same edits so explanations are not
 * reclassified as spelling when capitalization or tokenization differs.
 */
function preserveAuthoritativeLayoutTypes(
  derived: CorrectionChange[],
  fromModel: CorrectionChange[],
): CorrectionChange[] {
  const layoutModels = fromModel.filter((change) => change.type === 'layout')
  if (layoutModels.length === 0) return derived
  return derived.map((change) => {
    if (change.type === 'layout') return change
    const layout = layoutModels.some((model) => isSameCorrectionEdit(change, model))
    return layout ? { ...change, type: 'layout' as const } : change
  })
}

function isSameCorrectionEdit(left: CorrectionChange, right: CorrectionChange): boolean {
  const leftOriginal = left.original.trim().toLowerCase()
  const rightOriginal = right.original.trim().toLowerCase()
  const leftCorrected = left.corrected.trim().toLowerCase()
  const rightCorrected = right.corrected.trim().toLowerCase()
  if (leftOriginal && leftOriginal === rightOriginal) return true
  if (
    leftOriginal &&
    rightOriginal &&
    (leftOriginal.includes(rightOriginal) || rightOriginal.includes(leftOriginal)) &&
    (leftCorrected === rightCorrected ||
      leftCorrected.includes(rightCorrected) ||
      rightCorrected.includes(leftCorrected))
  ) {
    return true
  }
  return left.start < right.end && right.start < left.end && leftOriginal === rightOriginal
}
