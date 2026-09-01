import { FLOWLARY_MARK } from '@flowlary/shared'

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx={FLOWLARY_MARK.radius} fill="var(--fl-accent, #5b8cff)" />
      <path d={FLOWLARY_MARK.f} fill="var(--fl-on-accent, #061018)" />
      <rect
        x={FLOWLARY_MARK.caret.x}
        y={FLOWLARY_MARK.caret.y}
        width={FLOWLARY_MARK.caret.width}
        height={FLOWLARY_MARK.caret.height}
        rx={FLOWLARY_MARK.caret.rx}
        fill="var(--fl-on-accent, #061018)"
      />
    </svg>
  )
}
