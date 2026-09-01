import type { ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'
import { Link } from 'react-router-dom'
import { CHROME_WEB_STORE_URL } from '../config.ts'
import { useMessages } from '../i18n/index.tsx'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'link'

type ButtonProps = {
  children: ReactNode
  variant?: Variant
  to?: string
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  name?: string
  value?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  'aria-busy'?: boolean
  'aria-describedby'?: string
}

export function Button({
  children,
  variant = 'primary',
  to,
  href,
  onClick,
  type = 'button',
  name,
  value,
  disabled,
  className = '',
  ariaLabel,
  'aria-busy': ariaBusy,
  'aria-describedby': ariaDescribedBy,
}: ButtonProps) {
  const classes = `btn btn-${variant} ${className}`.trim()

  if (to && !disabled) {
    return (
      <Link className={classes} to={to} aria-label={ariaLabel} aria-busy={ariaBusy}>
        {children}
      </Link>
    )
  }

  if (href && !disabled) {
    return (
      <a className={classes} href={href} aria-label={ariaLabel} aria-busy={ariaBusy}>
        {children}
      </a>
    )
  }

  return (
    <button
      className={classes}
      type={type}
      name={name}
      value={value}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      aria-busy={ariaBusy}
      aria-describedby={ariaDescribedBy}
    >
      {children}
    </button>
  )
}

export function GetFlowlaryButton({
  variant = 'primary',
  className,
}: {
  variant?: Variant
  className?: string
}) {
  const t = useMessages()
  if (CHROME_WEB_STORE_URL) {
    return (
      <Button variant={variant} href={CHROME_WEB_STORE_URL} className={className}>
        {t.cta.primary}
      </Button>
    )
  }
  return (
    <Button variant={variant} to="/support#get-flowlary" className={className}>
      {t.cta.primary}
    </Button>
  )
}

function AlertGlyph({ tone }: { tone: 'info' | 'success' | 'warning' | 'error' }) {
  const label =
    tone === 'success' ? 'Success' : tone === 'warning' ? 'Warning' : tone === 'error' ? 'Error' : 'Info'
  return (
    <svg className="fl-alert-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <title>{label}</title>
      {tone === 'success' ? (
        <path d="M3.5 8.2 6.4 11l6.1-6.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : tone === 'warning' ? (
        <>
          <path d="M8 3.2 13.4 12.5H2.6L8 3.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 6.8v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="11.2" r="0.7" fill="currentColor" />
        </>
      ) : tone === 'error' ? (
        <>
          <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7.2V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="5.2" r="0.7" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

export function FactGrid({
  items,
}: {
  items: { title: string; body: ReactNode }[]
}) {
  return (
    <div className="fact-grid">
      {items.map((item) => (
        <article key={item.title} className="fact">
          <h2>{item.title}</h2>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  )
}

export function Badge({
  children,
  tone = 'default',
  pill = false,
}: {
  children: ReactNode
  tone?: 'default' | 'accent' | 'warn' | 'ok'
  pill?: boolean
}) {
  const extra =
    tone === 'accent' ? 'badge-accent' : tone === 'warn' ? 'badge-warn' : tone === 'ok' ? 'badge-ok' : ''
  return <span className={`badge ${extra}${pill ? ' badge-pill' : ''}`.trim()}>{children}</span>
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`card ${className}`.trim()}>{children}</div>
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: ReactNode
  action?: ReactNode
}) {
  const live = tone === 'error' ? 'assertive' : 'polite'
  return (
    <div
      className={`fl-alert fl-alert-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={live}
    >
      <AlertGlyph tone={tone} />
      <div className="fl-alert-body">
        {title ? <p className="fl-alert-title">{title}</p> : null}
        <div className="fl-alert-text">{children}</div>
        {action}
      </div>
    </div>
  )
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  const control =
    isValidElement(children)
      ? cloneElement(children as ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
        })
      : children
  return (
    <div className="fl-field">
      <label className="fl-field-label" htmlFor={id}>
        {label}
      </label>
      {control}
      {hint && !error ? (
        <p id={hintId} className="fl-field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="fl-field-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Input({
  id,
  label,
  hint,
  error,
  disabled,
  type = 'text',
  value,
  name,
  autoComplete,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  disabled?: boolean
  type?: 'text' | 'email' | 'password'
  value?: string
  name?: string
  autoComplete?: string
  onChange?: (value: string) => void
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className="fl-field">
      <label className="fl-field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="fl-input"
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
      {hint && !error ? (
        <p id={hintId} className="fl-field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="fl-field-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PageHero({
  kicker,
  title,
  lead,
}: {
  kicker?: string
  title: string
  lead?: string
}) {
  return (
    <header className="page-hero">
      <div className="container">
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
    </header>
  )
}

export function CtaBanner() {
  const t = useMessages()
  return (
    <section className="cta-banner" aria-labelledby="cta-heading">
      <div className="container">
        <div className="cta-panel">
          <p className="kicker">{t.brand.name}</p>
          <h2 id="cta-heading">{t.home.finalTitle}</h2>
          <p className="lead">{t.home.finalLead}</p>
          <div className="btn-row">
            <GetFlowlaryButton />
            <Button variant="secondary" to="/#how">
              {t.cta.secondary}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export function MockCaption() {
  const t = useMessages()
  return <p className="mock-caption">{t.a11y.mockCaption}</p>
}
