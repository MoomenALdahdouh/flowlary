import type { LearningEventCategory } from '@flowlary/shared'
import { practiceTargetPatternId } from '@flowlary/shared'
import type { DashboardCopy } from '../types.ts'
import type { ProgressMistakeItem } from '../learning/progress.ts'

function speakEnglish(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.92
  window.speechSynthesis.speak(utterance)
}

function categoryTip(category: LearningEventCategory, copy: DashboardCopy['progress']): string {
  if (category === 'spelling') return copy.tipSpelling
  if (category === 'grammar') return copy.tipGrammar
  return copy.tipWording
}

function statusLabel(item: ProgressMistakeItem, copy: DashboardCopy['progress']): string {
  if (item.appliedCount === 0) return copy.suggested
  if (item.appliedCount === 1 && item.count === 1) return copy.applied
  return copy.appliedCount.replace('{count}', String(item.appliedCount))
}

function categoryLabel(category: string, copy: DashboardCopy): string {
  if (category === 'spelling') return copy.practice.focusSpelling
  if (category === 'grammar') return copy.practice.focusGrammar
  return copy.practice.focusWording
}

export function MistakeCard({
  item,
  copy,
  onOpenHistory,
  onPractice,
}: {
  item: ProgressMistakeItem
  copy: DashboardCopy
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
    <article className={`wd-mistake-card wd-mistake-${item.category}`}>
      <header className="wd-mistake-meta">
        <span className={`fl-teach-badge fl-teach-${item.category}`}>{categoryLabel(item.category, copy)}</span>
        <time dateTime={new Date(item.timestamp).toISOString()}>{item.relativeLabel}</time>
        {item.count > 1 ? <span className="wd-mistake-count">{item.count}×</span> : null}
        <span className="wd-mistake-status">{statusLabel(item, copy.progress)}</span>
      </header>
      <p className="fl-mistake-pair" aria-label={`${item.original} → ${item.corrected}`}>
        <del>{item.original || '∅'}</del>
        <ins>{item.corrected || '∅'}</ins>
      </p>
      <p className="wd-mistake-tip">{categoryTip(item.category, copy.progress)}</p>
      <footer className="wd-mistake-actions">
        {item.historyWord && onOpenHistory ? (
          <button type="button" className="wd-text-btn" onClick={() => onOpenHistory(item)}>
            {copy.progress.openHistory.replace('{word}', item.historyWord)}
          </button>
        ) : onPractice ? (
          <button type="button" className="wd-text-btn" onClick={() => onPractice(targetId)}>
            {copy.progress.practiceCta}
          </button>
        ) : (
          <span />
        )}
        {listenText ? (
          <button type="button" className="wd-text-btn" onClick={() => speakEnglish(listenText)}>
            {copy.progress.listen}
          </button>
        ) : null}
      </footer>
    </article>
  )
}
