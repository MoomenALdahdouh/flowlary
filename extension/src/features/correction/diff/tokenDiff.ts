import type { ChangeType, CorrectionChange } from '@flowlary/shared'

export type DiffToken = {
  value: string
  type: 'equal' | 'insert' | 'delete' | 'replace'
  changeType?: ChangeType
  originalValue?: string
}

const TOKEN_RE = /(\s+|[A-Za-z0-9]+(?:'[A-Za-z]+)?|[^\sA-Za-z0-9])/g

export function tokenize(text: string): string[] {
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

function collapseDeleteInsert(tokens: DiffToken[]): DiffToken[] {
  const collapsed: DiffToken[] = []
  for (let k = 0; k < tokens.length; k++) {
    const cur = tokens[k]!
    const next = tokens[k + 1]
    if (cur.type === 'delete' && next?.type === 'insert') {
      collapsed.push({
        value: next.value,
        originalValue: cur.value,
        type: 'replace',
        changeType: next.changeType ?? 'wording',
      })
      k++
    } else if (cur.type === 'delete') {
      continue
    } else {
      collapsed.push(cur)
    }
  }
  return collapsed
}

function mergeAdjacent(tokens: DiffToken[]): DiffToken[] {
  const out: DiffToken[] = []
  for (const token of tokens) {
    const last = out[out.length - 1]
    if (
      last &&
      last.type === token.type &&
      last.changeType === token.changeType &&
      last.type !== 'replace'
    ) {
      last.value += token.value
      continue
    }
    out.push({ ...token })
  }
  return out
}

export function diffTokens(original: string, corrected: string): DiffToken[] {
  const a = tokenize(original)
  const b = tokenize(corrected)
  const n = a.length
  const m = b.length
  const dp = lcsTable(a, b)

  const tokens: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ value: b[j]!, type: 'equal' })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      tokens.push({ value: a[i]!, type: 'delete' })
      i++
    } else {
      tokens.push({ value: b[j]!, type: 'insert', changeType: 'wording' })
      j++
    }
  }
  while (i < n) {
    tokens.push({ value: a[i++]!, type: 'delete' })
  }
  while (j < m) {
    tokens.push({ value: b[j++]!, type: 'insert', changeType: 'wording' })
  }

  return collapseDeleteInsert(tokens)
}

export function diffCharacters(
  original: string,
  corrected: string,
  changeType: ChangeType,
): DiffToken[] {
  const a = Array.from(original)
  const b = Array.from(corrected)
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []
  if (n === 0) {
    return [{ value: corrected, type: 'insert', changeType }]
  }
  if (m === 0) return []

  const dp = lcsTable(a, b)
  const raw: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ value: b[j]!, type: 'equal' })
      i++
      j++
    } else if (dp[i]![j + 1]! >= dp[i + 1]![j]!) {
      raw.push({ value: b[j]!, type: 'insert', changeType })
      j++
    } else {
      raw.push({ value: a[i]!, type: 'delete' })
      i++
    }
  }
  while (i < n) {
    raw.push({ value: a[i++]!, type: 'delete' })
  }
  while (j < m) {
    raw.push({ value: b[j++]!, type: 'insert', changeType })
  }

  return mergeAdjacent(collapseDeleteInsert(raw).map((token) =>
    token.type === 'equal' ? token : { ...token, changeType },
  ))
}

function findChangeType(tokenValue: string, changes: CorrectionChange[]): ChangeType | undefined {
  for (const change of changes) {
    if (change.corrected && (tokenValue === change.corrected || tokenValue.includes(change.corrected))) {
      return change.type
    }
    if (change.original && (tokenValue === change.original || tokenValue.includes(change.original))) {
      return change.type
    }
  }
  return undefined
}

export type HighlightGranularity = 'auto' | 'full' | 'character'

function letterBag(value: string): string {
  return Array.from(value.toLowerCase())
    .filter((char) => /[a-z]/.test(char))
    .sort()
    .join('')
}

/** Same letters in a different order (yuo → you, recieve → receive). */
function isLetterTransposition(original: string, corrected: string): boolean {
  const a = letterBag(original)
  const b = letterBag(corrected)
  return a.length >= 3 && a === b && original.toLowerCase() !== corrected.toLowerCase()
}

function markedLength(tokens: DiffToken[]): number {
  return tokens.filter((token) => token.type !== 'equal').reduce((sum, token) => sum + token.value.length, 0)
}

/**
 * Teach highlighting: mark only the letters that changed, unless the whole word
 * is the lesson (transposition, or most of the word is different).
 */
function highlightReplace(
  original: string,
  corrected: string,
  changeType: ChangeType,
  granularity: HighlightGranularity,
): DiffToken[] {
  if (granularity === 'full') {
    return [{ value: corrected, type: 'insert', changeType }]
  }
  const chars = diffCharacters(original, corrected, changeType)
  if (granularity === 'character') return chars
  if (isLetterTransposition(original, corrected)) {
    return [{ value: corrected, type: 'insert', changeType }]
  }
  if (corrected.length > 0 && markedLength(chars) / corrected.length >= 0.5) {
    return [{ value: corrected, type: 'insert', changeType }]
  }
  return chars
}

/**
 * Suggestion highlights with EWA-style teach colors: only the wrong characters
 * by default. Whole-word marks are used for transpositions and full replacements.
 */
export function buildHighlightedTokens(
  original: string,
  corrected: string,
  changes: CorrectionChange[],
  granularity: HighlightGranularity = 'auto',
): DiffToken[] {
  const base = diffTokens(original, corrected)
  const out: DiffToken[] = []
  for (const token of base) {
    if (token.type === 'equal') {
      out.push(token)
      continue
    }
    const changeType =
      /^[^\sA-Za-z0-9]+$/.test(token.value) || (token.originalValue != null && token.value.toLowerCase() === token.originalValue.toLowerCase())
        ? 'grammar'
        : findChangeType(token.value, changes) ??
          findChangeType(token.originalValue ?? '', changes) ??
          token.changeType ??
          'wording'
    if (token.type === 'replace' && token.originalValue != null) {
      out.push(...highlightReplace(token.originalValue, token.value, changeType, granularity))
      continue
    }
    out.push({ ...token, changeType })
  }
  return mergeAdjacent(out)
}

export function markedText(tokens: DiffToken[]): string {
  return tokens.filter((t) => t.type !== 'equal').map((t) => t.value).join('')
}

function classifyHistoryChange(original: string, corrected: string): ChangeType {
  const o = original.trim()
  const c = corrected.trim()
  if (!o || !c) return 'grammar'
  if (/^[A-Za-z]+$/.test(o) && /^[A-Za-z]+$/.test(c)) {
    const maxLen = Math.max(o.length, c.length)
    const minLen = Math.min(o.length, c.length)
    if (maxLen <= 12 && minLen >= maxLen - 3) return 'spelling'
    return 'wording'
  }
  if (/^[^\sA-Za-z0-9]+$/.test(c) || /^[^\sA-Za-z0-9]+$/.test(o)) return 'grammar'
  if (o.toLowerCase() === c.toLowerCase()) return 'grammar'
  return 'grammar'
}

/**
 * History UI diff: keeps removals (wrongs) and additions (fixes) so activity
 * can strikethrough mistakes and highlight corrections inline, including
 * character-level spelling edits when both sides are single words.
 */
export function buildHistoryDiffTokens(
  original: string,
  corrected: string,
  changes: CorrectionChange[] = [],
): DiffToken[] {
  const a = tokenize(original)
  const b = tokenize(corrected)
  const n = a.length
  const m = b.length
  const dp = lcsTable(a, b)

  const raw: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ value: b[j]!, type: 'equal' })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      raw.push({ value: a[i]!, type: 'delete' })
      i++
    } else {
      raw.push({ value: b[j]!, type: 'insert', changeType: 'wording' })
      j++
    }
  }
  while (i < n) {
    raw.push({ value: a[i++]!, type: 'delete' })
  }
  while (j < m) {
    raw.push({ value: b[j++]!, type: 'insert', changeType: 'wording' })
  }

  const out: DiffToken[] = []
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k]!
    const next = raw[k + 1]
    if (cur.type === 'delete' && next?.type === 'insert') {
      const changeType =
        findChangeType(cur.value, changes) ??
        findChangeType(next.value, changes) ??
        classifyHistoryChange(cur.value, next.value)
      out.push({ value: cur.value, type: 'delete', changeType })
      out.push({ value: next.value, type: 'insert', changeType })
      k++
      continue
    }
    if (cur.type === 'insert') {
      out.push({ ...cur, changeType: cur.changeType ?? 'grammar' })
      continue
    }
    if (cur.type === 'delete') {
      out.push({ ...cur, changeType: cur.changeType ?? 'spelling' })
      continue
    }
    out.push(cur)
  }
  return mergeAdjacent(out)
}
