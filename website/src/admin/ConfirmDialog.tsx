import { useEffect } from 'react'
import { Button } from '../components/Ui.tsx'

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null
  return (
    <div className="ad-dialog-backdrop" role="presentation" onClick={() => !busy && onCancel()}>
      <div
        className="ad-dialog wd-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ad-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="ad-dialog-title">{title}</h2>
        <p>{body}</p>
        <div className="btn-row">
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
