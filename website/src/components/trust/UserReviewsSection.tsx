import type { PublicTestimonialView } from '@flowlary/shared'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

type UserReviewsSectionProps = {
  testimonials: PublicTestimonialView[]
}

export function UserReviewsSection({ testimonials }: UserReviewsSectionProps) {
  const t = useMessages()
  const copy = t.trust.reviews
  if (testimonials.length === 0) return null

  return (
    <section className="trust-reviews" aria-labelledby="trust-reviews-title">
      <div className="container">
        <Reveal>
          <h2 id="trust-reviews-title">{copy.title}</h2>
          <div className="trust-review-grid">
            {testimonials.map((item) => (
              <figure key={item.id} className="trust-review-card fl-surface-1">
                <blockquote>{item.quote}</blockquote>
                <figcaption>
                  <strong>{item.displayName}</strong>
                  {item.role ? <span>{item.role}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
