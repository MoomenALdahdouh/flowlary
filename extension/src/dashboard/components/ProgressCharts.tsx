import type { ProgressDayPoint, ProgressSkillSpark, ProgressWeekBar } from '../../storage/learning/progress.ts'
import { t } from '../../popup/i18n/index.ts'

const TEACH_HEX = {
  spelling: 'var(--fl-teach-spelling)',
  grammar: 'var(--fl-teach-grammar)',
  wording: 'var(--fl-teach-wording)',
} as const

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 72
  const height = 28
  const max = Math.max(1, ...values)
  if (values.length < 2) {
    return <svg className="fl-chart-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" />
  }
  const d = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - 2 - (value / max) * (height - 4)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg className="fl-chart-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  )
}

export function LineChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const width = 560
  const height = 140
  const pad = { l: 28, r: 8, t: 10, b: 24 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const max = Math.max(1, ...points.map((point) => point.value))
  if (points.length === 0) return <p className="fl-card-desc">{t('progress.chartEmpty')}</p>
  const coords = points.map((point, i) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
    const y = pad.t + innerH - (point.value / max) * innerH
    return { x, y }
  })
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  return (
    <svg className="fl-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('progress.chartRate')}>
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} stroke="currentColor" opacity="0.12" />
      <line
        x1={pad.l}
        y1={pad.t + innerH}
        x2={pad.l + innerW}
        y2={pad.t + innerH}
        stroke="currentColor"
        opacity="0.12"
      />
      <path d={d} fill="none" stroke="var(--fl-accent)" strokeWidth="2.2" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={points[i]!.label} cx={c.x} cy={c.y} r="2.6" fill="var(--fl-accent)" />
      ))}
      {points.map((point, i) =>
        i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2) ? (
          <text key={`l-${point.label}`} x={coords[i]!.x} y={height - 6} textAnchor="middle" className="fl-chart-label">
            {point.label}
          </text>
        ) : null,
      )}
    </svg>
  )
}

export function StackedBars({ rows }: { rows: ProgressWeekBar[] }) {
  const width = 560
  const height = 150
  const pad = { l: 8, r: 8, t: 8, b: 24 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const max = Math.max(1, ...rows.map((row) => row.spelling + row.grammar + row.wording))
  const gap = 8
  const barW = rows.length ? (innerW - gap * (rows.length - 1)) / rows.length : innerW
  return (
    <svg className="fl-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('progress.chartByType')}>
      {rows.map((row, i) => {
        const x = pad.l + i * (barW + gap)
        let y = pad.t + innerH
        const parts = [
          { type: 'spelling' as const, n: row.spelling },
          { type: 'grammar' as const, n: row.grammar },
          { type: 'wording' as const, n: row.wording },
        ]
        return (
          <g key={row.key}>
            {parts.map((part) => {
              const h = (part.n / max) * innerH
              y -= h
              return (
                <rect
                  key={part.type}
                  x={x}
                  y={y}
                  width={Math.max(4, barW)}
                  height={h}
                  fill={TEACH_HEX[part.type]}
                  opacity={0.85}
                  rx="2"
                />
              )
            })}
            <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="fl-chart-label">
              {row.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ProgressChartBlock({
  daily,
  weekly,
  skills,
  range,
  onRange,
}: {
  daily: ProgressDayPoint[]
  weekly: ProgressWeekBar[]
  skills: ProgressSkillSpark[]
  range: '7d' | '30d'
  onRange: (range: '7d' | '30d') => void
}) {
  const points = range === '7d' ? daily.slice(-7) : daily
  const hasSignal = points.some((point) => point.errors > 0 || point.words > 0)

  return (
    <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-charts-heading">
      <div className="fl-progress-chart-head">
        <h3 id="progress-charts-heading" className="fl-section-label">
          {t('progress.charts')}
        </h3>
        <div className="fl-progress-range" role="group" aria-label={t('progress.chartRange')}>
          {(['7d', '30d'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`fl-history-filter${range === id ? ' is-active' : ''}`}
              onClick={() => onRange(id)}
            >
              {id === '7d' ? t('progress.range7d') : t('progress.range30d')}
            </button>
          ))}
        </div>
      </div>

      <div className="fl-progress-skills">
        {skills.map((skill) => (
          <article key={skill.type} className="fl-progress-skill">
            <div className="fl-progress-skill-head">
              <span className={`fl-teach-badge fl-teach-${skill.type}`}>
                {t(`learning.focus.${skill.type}` as 'learning.focus.spelling')}
              </span>
              <Sparkline values={skill.spark} color={TEACH_HEX[skill.type]} />
            </div>
            <p className="fl-progress-stat-value">{skill.count}</p>
          </article>
        ))}
      </div>

      {hasSignal ? (
        <div className="fl-progress-charts">
          <div>
            <h4 className="fl-progress-type-group">{t('progress.chartRate')}</h4>
            <LineChart points={points.map((point) => ({ label: point.label, value: point.rate }))} />
          </div>
          <div>
            <h4 className="fl-progress-type-group">{t('progress.chartByType')}</h4>
            <StackedBars rows={weekly} />
            <p className="fl-chart-legend">
              <span>
                <i className="fl-chart-swatch fl-teach-spelling" /> {t('learning.focus.spelling')}
              </span>
              <span>
                <i className="fl-chart-swatch fl-teach-grammar" /> {t('learning.focus.grammar')}
              </span>
              <span>
                <i className="fl-chart-swatch fl-teach-wording" /> {t('learning.focus.wording')}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <p className="fl-card-desc">{t('progress.chartEmpty')}</p>
      )}
    </section>
  )
}
