import type { ChangeType, CorrectionChange } from '@flowlary/shared'
import { teachClass } from '@flowlary/shared'
import {
  buildHighlightedTokens,
  buildHistoryDiffTokens,
} from '../../features/correction/diff/tokenDiff.ts'

export { teachClass }

type CorrectionHighlightProps = {
  original: string
  corrected: string
  changes: CorrectionChange[]
  className?: string
  /** When true, strikethrough wrong tokens and color fixes (learning view). */
  showMistakes?: boolean
}

export function CorrectionHighlight({
  original,
  corrected,
  changes,
  className = '',
  showMistakes = false,
}: CorrectionHighlightProps) {
  if (showMistakes) {
    const tokens = buildHistoryDiffTokens(original, corrected, changes)
    return (
      <p className={`fl-teach-text fl-mistake-pair ${className}`.trim()}>
        {tokens.map((token, index) => {
          if (token.type === 'equal') {
            return <span key={`${index}-${token.value}`}>{token.value}</span>
          }
          if (token.type === 'delete') {
            return (
              <del
                key={`${index}-${token.value}`}
                className={`fl-teach-wrong ${teachClass(token.changeType)}`}
              >
                {token.value}
              </del>
            )
          }
          return (
            <ins
              key={`${index}-${token.value}`}
              className={`fl-teach-fix ${teachClass(token.changeType)}`}
            >
              {token.value}
            </ins>
          )
        })}
      </p>
    )
  }

  const tokens = buildHighlightedTokens(original, corrected, changes)
  return (
    <p className={`fl-teach-text ${className}`.trim()}>
      {tokens.map((token, index) =>
        token.type === 'equal' || !token.changeType ? (
          <span key={`${index}-${token.value}`}>{token.value}</span>
        ) : (
          <mark
            key={`${index}-${token.value}`}
            className={`fl-teach-mark ${teachClass(token.changeType as ChangeType)}`}
          >
            {token.value}
          </mark>
        ),
      )}
    </p>
  )
}
