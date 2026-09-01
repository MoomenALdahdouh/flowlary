import type { ChangeType, CorrectionChange } from '@flowlary/shared'
import { buildHighlightedTokens } from '../../features/correction/diff/tokenDiff.ts'

type CorrectionHighlightProps = {
  original: string
  corrected: string
  changes: CorrectionChange[]
  className?: string
}

export function teachClass(type: ChangeType | undefined): string {
  if (type === 'spelling' || type === 'grammar' || type === 'wording' || type === 'layout') {
    return `fl-teach-${type}`
  }
  return 'fl-teach-grammar'
}

export function CorrectionHighlight({
  original,
  corrected,
  changes,
  className = '',
}: CorrectionHighlightProps) {
  const tokens = buildHighlightedTokens(original, corrected, changes)
  return (
    <p className={`fl-teach-text ${className}`.trim()}>
      {tokens.map((token, index) =>
        token.type === 'equal' || !token.changeType ? (
          <span key={`${index}-${token.value}`}>{token.value}</span>
        ) : (
          <mark
            key={`${index}-${token.value}`}
            className={`fl-teach-mark ${teachClass(token.changeType)}`}
          >
            {token.value}
          </mark>
        ),
      )}
    </p>
  )
}
