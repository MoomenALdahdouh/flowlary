import { useCallback, useState } from 'react'

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
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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
    <div className="fb-stars" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          className={`fb-star${star <= active ? ' is-active' : ''}`}
          disabled={disabled}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(null)}
          onClick={() => onChange(star)}
        >
          <span aria-hidden="true">{star <= active ? '★' : '☆'}</span>
          <span className="visually-hidden">{star}</span>
        </button>
      ))}
    </div>
  )
}
