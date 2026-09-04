import { useCallback, useState, type KeyboardEvent } from 'react'
import { Star } from 'lucide-react'

type StarRatingProps = {
  value: number | null
  onChange: (value: number) => void
  label: string
  disabled?: boolean
}

export function StarRating({ value, onChange, label, disabled }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null)
  const active = hover ?? value ?? 0

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault()
        onChange(Math.min(5, (value ?? 0) + 1))
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault()
        onChange(Math.max(1, (value ?? 1) - 1))
      }
    },
    [disabled, onChange, value],
  )

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {[1, 2, 3, 4, 5].map((star) => {
        const on = star <= active
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            className="rounded-lg p-1 transition-transform hover:scale-110 disabled:opacity-50"
            disabled={disabled}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(star)}
          >
            <Star
              className={`h-8 w-8 ${on ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
              aria-hidden="true"
            />
            <span className="visually-hidden">{star}</span>
          </button>
        )
      })}
    </div>
  )
}
