import { FLOWLARY_MARK, FLOWLARY_MARK_COLORS, FLOWLARY_LOGO_GRADIENT_ID, FLOWLARY_LOGO_GRADIENT_STOPS } from '@flowlary/shared'

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={FLOWLARY_LOGO_GRADIENT_ID} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          {FLOWLARY_LOGO_GRADIENT_STOPS.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={FLOWLARY_MARK.radius} fill={`url(#${FLOWLARY_LOGO_GRADIENT_ID})`} />
      <path d={FLOWLARY_MARK.f} fill={FLOWLARY_MARK_COLORS.onGradient} />
      <rect
        x={FLOWLARY_MARK.caret.x}
        y={FLOWLARY_MARK.caret.y}
        width={FLOWLARY_MARK.caret.width}
        height={FLOWLARY_MARK.caret.height}
        rx={FLOWLARY_MARK.caret.rx}
        fill={FLOWLARY_MARK_COLORS.onGradient}
      />
    </svg>
  )
}
