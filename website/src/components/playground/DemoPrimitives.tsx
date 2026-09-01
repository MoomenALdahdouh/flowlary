import type { ReactNode } from 'react'
import { useMessages } from '../../i18n/index.tsx'

export type DemoPhase = 'idle' | 'working' | 'done' | 'error'

export function DemoButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  className?: string
}) {
  return (
    <button
      type="button"
      className={`pg-btn pg-btn-${variant} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function DemoStatus({
  label,
  value,
  tone = 'neutral',
  compact = false,
}: {
  label?: string
  value: string
  tone?: 'neutral' | 'working' | 'success' | 'listening'
  compact?: boolean
}) {
  return (
    <div
      className={`pg-status tone-${tone}${compact ? ' is-compact' : ''}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {label ? <span className="pg-status-label">{label}</span> : null}
      <span className="pg-status-value">{value}</span>
      {tone === 'working' ? <span className="pg-spinner" aria-hidden="true" /> : null}
    </div>
  )
}

export function DemoToolbar({
  actions,
  status,
}: {
  actions: ReactNode
  status: ReactNode
}) {
  return (
    <div className="pg-mode-toolbar">
      <div className="pg-mode-actions">{actions}</div>
      <div className="pg-mode-status">{status}</div>
    </div>
  )
}

export function ExampleSelector<T extends { id: string }>({
  examples,
  activeId,
  onSelect,
  renderLabel,
  ariaLabel,
}: {
  examples: T[]
  activeId: string
  onSelect: (example: T) => void
  renderLabel: (example: T, index: number) => string
  ariaLabel: string
}) {
  return (
    <div className="pg-examples" role="group" aria-label={ariaLabel}>
      {examples.map((example, index) => (
        <button
          key={example.id}
          type="button"
          className={`pg-example-chip${activeId === example.id ? ' is-active' : ''}`}
          aria-pressed={activeId === example.id}
          onClick={() => onSelect(example)}
        >
          {renderLabel(example, index)}
        </button>
      ))}
    </div>
  )
}

export function DemoInput({
  id,
  label,
  value,
  onChange,
  onFocus,
  dir,
  lang,
  rows = 3,
  mono = false,
  placeholder,
  readOnly,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange?: (value: string) => void
  onFocus?: () => void
  dir?: 'ltr' | 'rtl'
  lang?: string
  rows?: number
  mono?: boolean
  placeholder?: string
  readOnly?: boolean
  disabled?: boolean
}) {
  const shared = {
    id,
    value,
    dir,
    lang,
    placeholder,
    readOnly: readOnly || undefined,
    disabled: disabled || undefined,
    onFocus,
    className: `pg-field-input${mono ? ' mono' : ''}`,
  }

  return (
    <div className="pg-field">
      <label className="pg-field-label" htmlFor={id}>
        {label}
      </label>
      {rows > 1 ? (
        <textarea
          {...shared}
          rows={rows}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
      ) : (
        <input
          {...shared}
          type="text"
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
      )}
    </div>
  )
}

export function DemoResult({
  label,
  children,
  visible = true,
  dir,
  lang,
}: {
  label: string
  children: ReactNode
  visible?: boolean
  dir?: 'ltr' | 'rtl'
  lang?: string
}) {
  if (!visible) return null

  return (
    <div className="pg-result is-visible" dir={dir} lang={lang} aria-live="polite">
      <span className="pg-field-label">{label}</span>
      <div className="pg-result-body">{children}</div>
    </div>
  )
}

export function DemoTags({ tags }: { tags: string[] }) {
  const t = useMessages()
  return (
    <div className="pg-tags" aria-label={t.a11y.featureTags}>
      {tags.map((tag) => (
        <span key={tag} className="pg-tag">
          {tag}
        </span>
      ))}
    </div>
  )
}

export function DemoFallback({ message }: { message: string }) {
  return <p className="pg-fallback">{message}</p>
}

export function ProcessingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="pg-processing" aria-hidden="true">
      <span className="pg-processing-bar" />
    </div>
  )
}
