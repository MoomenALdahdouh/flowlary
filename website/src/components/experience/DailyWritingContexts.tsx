import { useI18n, useMessages } from '../../i18n/index.tsx'

const CONTEXT_KEYS = ['email', 'document', 'form', 'message', 'study', 'work'] as const

export function DailyWritingContexts() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.marketingHome.proof.contexts

  return (
    <div className="xp-daily-contexts" dir={direction} lang={locale}>
      {CONTEXT_KEYS.map((key) => {
        const item = copy[key]
        return (
          <article key={key} className="xp-daily-context">
            <span className="xp-daily-context-tag">{item.tag}</span>
            <div className="xp-daily-context-field" aria-hidden="true">
              <span className="xp-daily-context-cursor" />
              <span className="xp-daily-context-text">{item.sample}</span>
            </div>
            <p className="xp-daily-context-note">{item.note}</p>
          </article>
        )
      })}
    </div>
  )
}
