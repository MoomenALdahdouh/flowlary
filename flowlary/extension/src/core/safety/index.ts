import type { SafetyDecision } from '@flowlary/shared'
import { probeElement, skipReasonForField } from './fields.ts'
import { isExcludedHost } from './domains.ts'
import { isInsideMarkdownCode } from './markdown.ts'
import { skipReasonForToken } from './tokenKind.ts'

export type SafetyContext = {
  hostname?: string
  excludedDomains?: string[]
  text?: string
  caretOffset?: number
  token?: string
}

export function evaluateFieldSafety(element: Element, context: SafetyContext = {}): SafetyDecision {
  if (context.hostname && context.excludedDomains?.length) {
    if (isExcludedHost(context.hostname, context.excludedDomains)) {
      return { allowed: false, reason: 'excluded-domain' }
    }
  }

  const probe = probeElement(element)
  const fieldReason = skipReasonForField(probe)
  if (fieldReason) {
    return { allowed: false, reason: fieldReason }
  }

  if (
    context.text != null &&
    context.caretOffset != null &&
    isInsideMarkdownCode(context.text, context.caretOffset)
  ) {
    return { allowed: false, reason: 'markdown-code-fence' }
  }

  if (context.token) {
    const tokenReason = skipReasonForToken(context.token)
    if (tokenReason) {
      return { allowed: false, reason: `token:${tokenReason}` }
    }
  }

  return { allowed: true }
}

export * from './fields.ts'
export * from './domains.ts'
export * from './markdown.ts'
export * from './tokenKind.ts'
