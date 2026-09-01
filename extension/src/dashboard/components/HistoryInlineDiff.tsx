import { buildHistoryDiffTokens } from '../../features/correction/diff/tokenDiff.ts'
import { t } from '../../popup/i18n/index.ts'
import { truncateHistoryText } from '../../popup/history.ts'
import { teachClass } from './CorrectionHighlight.tsx'

type HistoryInlineDiffProps = {
  original: string
  corrected: string
}

export function HistoryInlineDiff({ original, corrected }: HistoryInlineDiffProps) {
  if (original === corrected) {
    return (
      <article className="fl-history-diff fl-history-same">
        <p className="fl-teach-text">“{truncateHistoryText(corrected, 120)}”</p>
        <span className="fl-history-badge">{t('activity.noChanges')}</span>
      </article>
    )
  }

  const tokens = buildHistoryDiffTokens(original, corrected)
  const edits = Math.max(1, tokens.filter((token) => token.type !== 'equal').length)

  return (
    <article className="fl-history-diff fl-history-colored">
      <p className="fl-teach-text" aria-label={`${corrected}. ${original}`}>
        “
        {tokens.map((token, index) => {
          if (token.type === 'equal') {
            return <span key={`${index}-eq`}>{token.value}</span>
          }
          if (token.type === 'delete') {
            return (
              <del
                key={`${index}-del`}
                className={`fl-teach-wrong ${teachClass(token.changeType)}`}
              >
                {token.value}
              </del>
            )
          }
          return (
            <ins
              key={`${index}-ins`}
              className={`fl-teach-fix ${teachClass(token.changeType)}`}
            >
              {token.value}
            </ins>
          )
        })}
        ”
      </p>
      <div className="fl-history-diff-meta">
        <span className="fl-history-badge">
          {t('activity.editCount', { count: String(edits) })}
        </span>
        <span className="fl-history-was" title={original}>
          {t('activity.was', { text: truncateHistoryText(original, 48) })}
        </span>
      </div>
    </article>
  )
}
