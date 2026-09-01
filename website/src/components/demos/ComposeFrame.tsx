import type { ReactNode } from 'react'
import { useMessages } from '../../i18n/index.tsx'

export function ComposeFrame({
  title,
  status,
  children,
  footer,
}: {
  title: string
  status: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="compose" aria-hidden="true">
      <div className="compose-bar">
        <span>{title}</span>
        <div className="compose-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="compose-body">
        {children}
        <p className="compose-status">{status}</p>
        {footer}
      </div>
    </div>
  )
}

export function DemoCaption() {
  const t = useMessages()
  return <p className="mock-caption">{t.a11y.mockCaption}</p>
}
