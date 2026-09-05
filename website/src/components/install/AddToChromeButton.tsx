import { useState, type ReactNode } from 'react'
import { CHROME_WEB_STORE_URL } from '../../config.ts'
import { useMessages } from '../../i18n/index.tsx'
import { InstallExtensionModal } from './InstallExtensionModal.tsx'

/**
 * Existing "Add to Chrome" CTA behavior: store link when published,
 * otherwise open the temporary manual-install modal (no navigation).
 */
export function AddToChromeButton({
  className = '',
  label,
  showChromeIcon = true,
  chromeIcon,
}: {
  className?: string
  label?: string
  showChromeIcon?: boolean
  chromeIcon?: ReactNode
}) {
  const t = useMessages()
  const text = label ?? t.pages.chrome
  const [open, setOpen] = useState(false)
  const content = (
    <>
      {showChromeIcon ? chromeIcon : null}
      {text}
    </>
  )

  if (CHROME_WEB_STORE_URL) {
    return (
      <a className={className} href={CHROME_WEB_STORE_URL}>
        {content}
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {content}
      </button>
      <InstallExtensionModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
