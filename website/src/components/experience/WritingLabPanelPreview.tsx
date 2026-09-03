import { useState } from 'react'
import { FidelityBadge } from '../Ui.tsx'
import { useI18n, useMessages } from '../../i18n/index.tsx'

export function WritingLabPanelPreview() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.marketingHome.learning.panel
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="xp-lab-panel" dir={direction} lang={locale} aria-label={copy.ariaLabel}>
      <header className="xp-lab-panel-head">
        <span className="xp-lab-panel-title">{copy.title}</span>
        <FidelityBadge mode="live" />
      </header>

      <div className="xp-lab-panel-stats" role="list">
        {copy.stats.map((stat) => (
          <div key={stat.label} className={`xp-lab-stat xp-lab-stat-${stat.accent}`} role="listitem">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="xp-lab-practice">
        <p className="xp-lab-practice-label">{copy.practiceLabel}</p>
        <ul className="xp-lab-practice-list">
          {copy.items.map((item) => {
            const open = openId === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`xp-lab-practice-row${open ? ' is-open' : ''}`}
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span className="xp-lab-practice-meta">
                    <span className="xp-lab-practice-cat">{item.category}</span>
                    <span className="xp-lab-practice-wrong">{item.wrong}</span>
                    {open ? <span className="xp-lab-practice-fixed">{item.fixed}</span> : null}
                  </span>
                  <span className="xp-lab-practice-chevron" aria-hidden="true">
                    {open ? '▴' : '▾'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
