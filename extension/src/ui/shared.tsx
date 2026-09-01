import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { t } from '../popup/i18n/index.ts'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = t('dialog.cancel'),
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fl-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="fl-dialog"
        role="alertdialog"
        aria-labelledby="fl-dialog-title"
        aria-describedby="fl-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="fl-dialog-title" className="fl-dialog-title">
          {title}
        </h3>
        <p id="fl-dialog-desc" className="fl-dialog-desc">
          {description}
        </p>
        <div className="fl-dialog-actions">
          <button ref={cancelRef} type="button" className="fl-action-btn" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="fl-action-btn fl-action-btn-primary"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ShortcutKey({ label }: { label: string }) {
  return <kbd className="fl-kbd">{label}</kbd>
}

export function SectionHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="fl-dash-heading">
      <h2 className="fl-dash-page-title">{title}</h2>
      {lead ? <p className="fl-dash-lead">{lead}</p> : null}
    </header>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="fl-empty-state">
      <p className="fl-empty-title">{title}</p>
      {description ? <p className="fl-empty-desc">{description}</p> : null}
    </div>
  )
}

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fl-info-card">
      <h3 className="fl-info-card-title">{title}</h3>
      <div className="fl-info-card-body">{children}</div>
    </section>
  )
}

export function DataFlowDiagram() {
  return (
    <div className="fl-data-flow" aria-label={t('privacy.dataFlowLabel')}>
      <div className="fl-flow-step">
        <span className="fl-flow-node">{t('privacy.flowUser')}</span>
        <span className="fl-flow-arrow" aria-hidden>
          ↓
        </span>
        <span className="fl-flow-node">{t('privacy.flowExtension')}</span>
        <span className="fl-flow-arrow" aria-hidden>
          ↓
        </span>
        <span className="fl-flow-node">{t('privacy.flowDestinations')}</span>
      </div>
      <ul className="fl-flow-legend">
        <li>
          <span className="fl-flow-tag local">{t('privacy.tagLocal')}</span>
          {t('privacy.legendLocal')}
        </li>
        <li>
          <span className="fl-flow-tag leaves">{t('privacy.tagLeaves')}</span>
          {t('privacy.legendLeaves')}
        </li>
        <li>
          <span className="fl-flow-tag blocked">{t('privacy.tagBlocked')}</span>
          {t('privacy.legendBlocked')}
        </li>
      </ul>
    </div>
  )
}
