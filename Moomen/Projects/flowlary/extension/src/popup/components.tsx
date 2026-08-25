import type { ReactNode } from 'react'

type ToggleSwitchProps = {
  id: string
  checked: boolean
  disabled?: boolean
  busy?: boolean
  label: string
  onChange: (next: boolean) => void
}

export function ToggleSwitch({
  id,
  checked,
  disabled,
  busy,
  label,
  onChange,
}: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`fl-toggle${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
    >
      <span className="fl-toggle-track" aria-hidden>
        <span className="fl-toggle-thumb" />
      </span>
      <span className="fl-toggle-text">{checked ? 'ON' : 'OFF'}</span>
    </button>
  )
}

type FeatureCardProps = {
  title: string
  description: string
  meta?: string
  status?: string
  statusTone?: 'ok' | 'warn' | 'muted'
  toggle?: ReactNode
  children?: ReactNode
  primary?: boolean
}

export function FeatureCard({
  title,
  description,
  meta,
  status,
  statusTone = 'ok',
  toggle,
  children,
  primary,
}: FeatureCardProps) {
  return (
    <article className={`fl-card${primary ? ' fl-card-primary' : ''}`}>
      <div className="fl-card-head">
        <div className="fl-card-copy">
          <h3 className="fl-card-title">{title}</h3>
          <p className="fl-card-desc">{description}</p>
          {meta ? <p className="fl-card-meta">{meta}</p> : null}
        </div>
        {toggle}
      </div>
      {status ? (
        <p className={`fl-card-status tone-${statusTone}`}>
          <span className="fl-status-dot" aria-hidden />
          {status}
        </p>
      ) : null}
      {children}
    </article>
  )
}
