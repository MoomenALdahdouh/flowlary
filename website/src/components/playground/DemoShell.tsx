import type { ReactNode } from 'react'
import { useMessages } from '../../i18n/index.tsx'

export function DemoShell({
  children,
  footer,
}: {
  children: ReactNode
  footer?: ReactNode
}) {
  const t = useMessages()

  return (
    <div className="pg-shell product-surface">
      <header className="pg-shell-header">
        <div className="pg-shell-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="pg-shell-title">
          <span className="pg-shell-brand">{t.brand.name}</span>
          <span className="pg-shell-badge">{t.playground.shellBadge}</span>
        </div>
      </header>
      <div className="pg-shell-body">{children}</div>
      {footer ? <footer className="pg-shell-footer">{footer}</footer> : null}
    </div>
  )
}
