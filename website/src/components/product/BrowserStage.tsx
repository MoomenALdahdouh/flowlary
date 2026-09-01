import type { ReactNode } from 'react'

export function BrowserStage({
  url,
  children,
  className = '',
}: {
  url: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`browser-stage ${className}`.trim()}>
      <div className="browser-chrome" aria-hidden="true">
        <div className="browser-controls">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-url">{url}</div>
      </div>
      <div className="browser-body">{children}</div>
    </div>
  )
}
