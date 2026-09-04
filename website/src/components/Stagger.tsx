import type { ReactNode } from 'react'
import { useInView } from '../hooks/useInView.ts'

export function Stagger({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={`fl-stagger${inView ? ' is-in' : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}
