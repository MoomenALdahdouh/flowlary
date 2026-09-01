import type { ProgressDayPoint, ProgressSkillSpark, ProgressWeekBar } from '../learning/progress.ts'

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 72
  const height = 28
  const max = Math.max(1, ...values)
  if (values.length < 2) {
    return <svg className="wd-chart-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" />
  }
  const d = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - 2 - (value / max) * (height - 4)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg className="wd-chart-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  )
}

export function LineChart({ points, label }: { points: Array<{ label: string; value: number }>; label: string }) {
  const width = 560
  const height = 140
  const pad = { l: 28, r: 8, t: 10, b: 24 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const max = Math.max(1, ...points.map((point) => point.value))
  if (points.length === 0) return null
  const coords = points.map((point, i) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
    const y = pad.t + innerH - (point.value / max) * innerH
    return { x, y }
  })
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  return (
    <svg className="wd-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} stroke="currentColor" opacity="0.12" />
      <line x1={pad.l} y1={pad.t + innerH} x2={pad.l + innerW} y2={pad.t + innerH} stroke="currentColor" opacity="0.12" />
      <path d={d} fill="none" stroke="var(--fl-accent)" strokeWidth="2.2" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={points[i]!.label} cx={c.x} cy={c.y} r="2.6" fill="var(--fl-accent)" />
      ))}
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
    <svg className="wd-chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {rows.map((row, i) => {
        const x = pad.l + i * (barW + gap)
        const total = row.spelling + row.grammar + row.wording
        let y = pad.t + innerH
        const segments = [
          { key: 'spelling', value: row.spelling, color: 'var(--fl-teach-spelling)' },
          { key: 'grammar', value: row.grammar, color: 'var(--fl-teach-grammar)' },
          { key: 'wording', value: row.wording, color: 'var(--fl-teach-wording)' },
        ] as const
        return (
          <g key={row.key}>
            {segments.map((seg) => {
              if (seg.value <= 0) return null
              const h = (seg.value / max) * innerH
              y -= h
              return <rect key={seg.key} x={x} y={y} width={barW} height={h} fill={seg.color} rx="2" />
            })}
            <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="wd-chart-label">
              {row.label}
            </text>
            {total === 0 ? (
              <rect x={x} y={pad.t + innerH - 2} width={barW} height={2} fill="currentColor" opacity="0.1" />
            ) : null}
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
  onRangeChange,
  labels,
}: {
  daily: ProgressDayPoint[]
  weekly: ProgressWeekBar[]
  skills: ProgressSkillSpark[]
  range: '7d' | '30d'
  onRangeChange: (range: '7d' | '30d') => void
  labels: { chart7d: string; chart30d: string }
}) {
  const slice = range === '7d' ? daily.slice(-7) : daily
  const linePoints = slice.map((point) => ({ label: point.label, value: point.rate }))
  return (
    <div className="wd-charts">
      <div className="wd-chart-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={range === '7d'}
          className={range === '7d' ? 'is-active' : ''}
          onClick={() => onRangeChange('7d')}
        >
          {labels.chart7d}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={range === '30d'}
          className={range === '30d' ? 'is-active' : ''}
          onClick={() => onRangeChange('30d')}
        >
          {labels.chart30d}
        </button>
      </div>
      <LineChart points={linePoints} label="Error rate" />
      <StackedBars rows={weekly} />
      <div className="wd-skill-sparks">
        {skills.map((skill) => (
          <div key={skill.type} className="wd-skill-spark">
            <span>{skill.type}</span>
            <Sparkline
              values={skill.spark}
              color={
                skill.type === 'spelling'
                  ? 'var(--fl-teach-spelling)'
                  : skill.type === 'grammar'
                    ? 'var(--fl-teach-grammar)'
                    : 'var(--fl-teach-wording)'
              }
            />
            <strong>{skill.count}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
