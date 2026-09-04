import type { ReactNode } from 'react'
import { useInView } from '../hooks/useInView.ts'

export type RevealVariant = 'up' | 'clip' | 'start' | 'end' | 'scale'

const VARIANT_CLASS: Record<RevealVariant, string> = {
  up: '',
  clip: 'reveal-clip',
  start: 'reveal-start',
  end: 'reveal-end',
  scale: 'reveal-scale',
}

export function Reveal({
  children,
  className = '',
  variant = 'up',
}: {
  children: ReactNode
  className?: string
  variant?: RevealVariant
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const variantClass = VARIANT_CLASS[variant]
  return (
    <div ref={ref} className={`reveal${inView ? ' is-in' : ''}${variantClass ? ` ${variantClass}` : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}
