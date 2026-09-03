import type { ReactNode } from 'react'

export function DashboardPage({
  title,
  lead,
  children,
}: {
  title?: string
  lead?: string
  children: ReactNode
}) {
  return (
    <div className="wd-panel-stack">
      {title || lead ? (
        <header className="wd-panel-head">
          {title ? <h2>{title}</h2> : null}
          {lead ? <p className="wd-lead">{lead}</p> : null}
        </header>
      ) : null}
      {children}
    </div>
  )
}
