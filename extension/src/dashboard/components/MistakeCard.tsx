import type { LearningEventCategory } from '@flowlary/shared'
import { practiceTargetPatternId } from '@flowlary/shared'
import { t } from '../../popup/i18n/index.ts'
import type { ProgressMistakeItem } from '../../storage/learning/progress.ts'

function speakEnglish(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.92
  window.speechSynthesis.speak(utterance)
}

function categoryTip(category: LearningEventCategory): string {
  switch (category) {
    case 'spelling':
      return t('progress.tipSpelling')
    case 'grammar':
      return t('progress.tipGrammar')
    case 'wording':
      return t('progress.tipWording')
    default:
      return t('progress.tipLayout')
  }
}

function statusLabel(item: ProgressMistakeItem): string {
  if (item.appliedCount > 1) return t('progress.appliedCount', { count: String(item.appliedCount) })
  if (item.appliedCount === 1 && item.count === 1) return t('progress.applied')
  if (item.appliedCount >= 1) return t('progress.appliedCount', { count: String(item.appliedCount) })
  return t('progress.suggested')
}

export function MistakePair({ original, corrected }: { original: string; corrected: string }) {
  return (
    <p className="fl-mistake-pair" aria-label={`${original} → ${corrected}`}>
      <del>{original || '∅'}</del>
      <ins>{corrected || '∅'}</ins>
    </p>
  )
}

export function MistakeCard({
  item,
  onOpenHistory,
  onPractice,
}: {
  item: ProgressMistakeItem
  onOpenHistory?: (item: ProgressMistakeItem) => void
  onPractice?: (targetPatternId: string) => void
}) {
  const listenText = item.corrected.trim() || item.original.trim()
  const targetId = practiceTargetPatternId({
    category: item.category,
    normalizedOriginal: item.normalizedOriginal,
    displayOriginal: item.original,
    displayCorrected: item.corrected,
    count: item.count,
  })

  return (
    <article className={`fl-mistake-card fl-mistake-${item.category}`}>
      <header className="fl-mistake-meta">
        <span className={`fl-teach-badge fl-teach-${item.category}`}>
          {t(`learning.focus.${item.category}` as 'learning.focus.spelling')}
        </span>
        <time dateTime={new Date(item.timestamp).toISOString()}>{item.relativeLabel}</time>
        {item.count > 1 ? <span className="fl-mistake-count">{item.count}×</span> : null}
        <span className="fl-mistake-status">{statusLabel(item)}</span>
      </header>
      <MistakePair original={item.original} corrected={item.corrected} />
      <p className="fl-mistake-tip">{categoryTip(item.category)}</p>
      <footer className="fl-mistake-actions">
        {item.historyWord && onOpenHistory ? (
          <button type="button" className="fl-link-btn" onClick={() => onOpenHistory(item)}>
            {t('progress.openHistory', { word: item.historyWord })}
          </button>
        ) : onPractice ? (
          <button type="button" className="fl-link-btn" onClick={() => onPractice(targetId)}>
            {t('progress.practiceCta')}
          </button>
        ) : (
          <span />
        )}
        {listenText ? (
          <button type="button" className="fl-link-btn" onClick={() => speakEnglish(listenText)}>
            {t('progress.listen')}
          </button>
        ) : null}
      </footer>
    </article>
  )
}
