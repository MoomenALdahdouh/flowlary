import { evaluateFieldSafety } from '../../core/safety/index.ts'
import { looksLikeMarkdownFence } from '../../core/safety/markdown.ts'
import { probeElement } from '../../core/safety/fields.ts'
import { skipReasonForToken } from '../../core/safety/tokenKind.ts'
import type { HistoryFieldKind } from './types.ts'

const FULL_TEXT_PATTERNS = [
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  /^(sk|pk|rk|ghp|gsk)_[A-Za-z0-9]{8,}$/i,
  /^Bearer\s+\S+$/i,
  /^Basic\s+\S+$/i,
]

export function normalizeHistoryDomain(hostname: string | undefined): string | undefined {
  if (!hostname) return undefined
  const host = hostname.trim().toLowerCase().replace(/^www\./, '')
  return host || undefined
}

export function fieldKindFromElement(element: Element): HistoryFieldKind {
  const probe = probeElement(element)
  if (probe.tag === 'TEXTAREA') return 'textarea'
  if (probe.tag === 'INPUT') return 'text'
  if (element instanceof HTMLElement && element.isContentEditable) return 'contenteditable'
  return 'unknown'
}

export function isSensitiveText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed.length > 10_000) return true
  if (looksLikeMarkdownFence(trimmed)) return true

  for (const pattern of FULL_TEXT_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    if (skipReasonForToken(token, trimmed, token)) return true
  }

  if (tokens.length === 1 && skipReasonForToken(trimmed, trimmed, trimmed)) return true
  return false
}

export function canRecordHistory(input: {
  element: Element
  hostname?: string
  excludedDomains?: string[]
  sourceText: string
  resultText: string
}): boolean {
  const safety = evaluateFieldSafety(input.element, {
    hostname: input.hostname,
    excludedDomains: input.excludedDomains,
    text: input.sourceText,
  })
  if (!safety.allowed) return false
  if (isSensitiveText(input.sourceText) || isSensitiveText(input.resultText)) return false
  return true
}
