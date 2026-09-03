import { FLOWLARY_MARK, FLOWLARY_LOGO_GRADIENT_ID } from '@flowlary/shared'

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={FLOWLARY_LOGO_GRADIENT_ID} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--fl-brand-cyan, #19c7e8)" />
          <stop offset="1" stopColor="var(--fl-brand-magenta, #ec4899)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={FLOWLARY_MARK.radius} fill={`url(#${FLOWLARY_LOGO_GRADIENT_ID})`} />
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
