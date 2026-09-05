import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Ui.tsx'
import { barWidth } from './format.ts'

export function AdminHeader({
  kicker,
  title,
  lead,
  actions,
}: {
  kicker?: string
  title: string
  lead?: string
  actions?: ReactNode
}) {
  return (
    <header className="wd-home-head">
      <div>
        {kicker ? <p className="wd-data-label">{kicker}</p> : null}
        <h1 className="wd-panel-head">{title}</h1>
        {lead ? <p className="wd-lead">{lead}</p> : null}
      </div>
      {actions ? <div className="ad-header-actions">{actions}</div> : null}
    </header>
  )
}

export function AdminStatusLine({
  loading,
  error,
  loadingLabel,
  errorLabel,
  retryLabel,
  onRetry,
}: {
  loading: boolean
  error: boolean
  loadingLabel: string
  errorLabel: string
  retryLabel: string
  onRetry?: () => void
}) {
  if (loading) return <p role="status">{loadingLabel}</p>
  if (!error) return null
  return (
    <p role="alert" className="ad-inline-alert">
      {errorLabel}{' '}
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </p>
  )
}

export function SparkBars({
  rows,
  empty,
}: {
  rows: { key: string; label: string; value: number; extra?: string }[]
  empty: string
}) {
  if (rows.length === 0 || rows.every((row) => row.value === 0)) return <p>{empty}</p>
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <ul className="ad-spark">
      {rows.map((row) => (
        <li key={row.key}>
          <span>{row.label}</span>
          <span className="ad-bar" style={{ width: `${barWidth(row.value, max)}%` }} />
          <strong>
            {row.value.toLocaleString()}
            {row.extra ? ` · ${row.extra}` : ''}
          </strong>
        </li>
      ))}
    </ul>
  )
}

export function DebouncedField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string
  value: string
  onCommit: (next: string) => void
  placeholder?: string
}) {
  const [local, setLocal] = useState(value)
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const skipCommit = useRef(true)
  useEffect(() => {
    setLocal(value)
  }, [value])
  useEffect(() => {
    if (skipCommit.current) {
      skipCommit.current = false
      return
    }
    const handle = window.setTimeout(() => {
      if (local !== value) onCommitRef.current(local)
    }, 280)
    return () => window.clearTimeout(handle)
  }, [local, value])
  return (
    <label className="wd-field">
      <span>{label}</span>
      <input
        value={local}
        placeholder={placeholder}
        onChange={(event) => setLocal(event.target.value)}
      />
    </label>
  )
}

export function AdminPager({
  page,
  pages,
  label,
  previous,
  next,
  onPage,
}: {
  page: number
  pages: number
  label: string
  previous: string
  next: string
  onPage: (page: number) => void
}) {
  return (
    <div className="ad-pager">
      <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {previous}
      </Button>
      <span>{label}</span>
      <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {next}
      </Button>
    </div>
  )
}
