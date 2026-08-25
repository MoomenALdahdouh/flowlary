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

export function buildHighlightedTokens(
  original: string,
  corrected: string,
  changes: CorrectionChange[],
): DiffToken[] {
  const base = diffTokens(original, corrected)
  const out: DiffToken[] = []
  for (const token of base) {
    if (token.type === 'equal') {
      out.push(token)
      continue
    }
    const changeType =
      findChangeType(token.value, changes) ??
      findChangeType(token.originalValue ?? '', changes) ??
      token.changeType ??
      'wording'
    if (token.type === 'replace' && token.originalValue != null) {
      out.push(...diffCharacters(token.originalValue, token.value, changeType))
      continue
    }
    out.push({ ...token, changeType })
  }
  return mergeAdjacent(out)
}
