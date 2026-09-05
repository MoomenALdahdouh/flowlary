import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type AdminTableColumn<T> = {
  key: string
  header: string
  className?: string
  cell: (row: T) => ReactNode
}

/** Simple stacked admin list — avoids CSS table/grid collapse bugs. */
export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  countLabel,
  embedded,
}: {
  columns: AdminTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty: string
  countLabel?: string
  embedded?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className={embedded ? 'ad-table-empty' : 'ad-table-empty wd-card'}>
        <p>{empty}</p>
      </div>
    )
  }

  return (
    <div className={embedded ? 'ad-data-list' : 'ad-data-list wd-card'}>
      {countLabel ? <p className="ad-table-count">{countLabel}</p> : null}
      <ul className="ad-data-rows">
        {rows.map((row) => (
          <li key={rowKey(row)} className="ad-data-row">
            {columns.map((column) => (
              <div key={column.key} className={`ad-data-cell${column.className ? ` ${column.className}` : ''}`}>
                <span className="ad-data-label">{column.header}</span>
                <span className="ad-data-value">{column.cell(row)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AdminTableLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="ad-table-link" to={to}>
      {children}
    </Link>
  )
}
