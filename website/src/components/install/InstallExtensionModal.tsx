import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Download, FolderOpen, PackageOpen, Puzzle, ToggleRight, X } from 'lucide-react'
import { useMessages } from '../../i18n/index.tsx'
import {
  STABLE_EXTENSION_DOWNLOAD_PATH,
  STABLE_EXTENSION_VERSION,
  STABLE_EXTENSION_ZIP_NAME,
} from './extensionRelease.ts'

const STEP_ICONS = [Download, FolderOpen, Puzzle, ToggleRight, PackageOpen] as const

export function InstallExtensionModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useMessages().pages.installExtension
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const versionText = t.versionLabel.replace('{version}', STABLE_EXTENSION_VERSION)

  return createPortal(
    <div className="fl-install-backdrop" role="presentation" onClick={onClose}>
      <div
        className="fl-install-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fl-install-head">
          <div>
            <h2 id={titleId} className="fl-install-title">
              {t.title}
            </h2>
            <p className="fl-install-version">{versionText}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="fl-install-x"
            onClick={onClose}
            aria-label={t.close}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="fl-install-lead">{t.lead}</p>

        <ol className="fl-install-steps">
          {t.steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? Download
            return (
              <li key={step.title} className="fl-install-step">
                <span className="fl-install-step-icon" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="fl-install-step-body">
                  <p className="fl-install-step-kicker">
                    {t.stepLabel.replace('{n}', String(index + 1))}
                  </p>
                  <h3 className="fl-install-step-title">{step.title}</h3>
                  <p className="fl-install-step-text">{step.body}</p>
                  {index === 0 ? (
                    <a
                      className="btn-primary fl-install-download"
                      href={STABLE_EXTENSION_DOWNLOAD_PATH}
                      download={STABLE_EXTENSION_ZIP_NAME}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      {t.download}
                    </a>
                  ) : null}
                  {index === 2 ? (
                    <p className="fl-install-chrome-url">
                      <code>{t.extensionsUrl}</code>
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="fl-install-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
