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
    <div className="fl-dash-page">
      {title || lead ? (
        <header className="fl-dash-heading">
          {title ? <h2 className="fl-dash-page-title">{title}</h2> : null}
          {lead ? <p className="fl-dash-lead">{lead}</p> : null}
        </header>
      ) : null}
      {children}
    </div>
  )
}
