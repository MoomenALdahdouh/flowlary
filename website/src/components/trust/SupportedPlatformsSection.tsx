import type { SupportedPlatform } from '@flowlary/shared'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

type SupportedPlatformsSectionProps = {
  platforms: SupportedPlatform[]
}

export function SupportedPlatformsSection({ platforms }: SupportedPlatformsSectionProps) {
  const t = useMessages()
  const copy = t.trust.platforms
  if (platforms.length === 0) return null

  return (
    <section className="trust-platforms" aria-labelledby="trust-platforms-title">
      <div className="container">
        <Reveal>
          <p className="kicker">{copy.kicker}</p>
          <h2 id="trust-platforms-title">{copy.title}</h2>
          <p className="hp-lead">{copy.lead}</p>
          <ul className="trust-platform-grid">
            {platforms.map((platform) => (
              <li key={platform.id} className="trust-platform-card fl-surface-1">
                <h3>{copy.names[platform.id as keyof typeof copy.names] ?? platform.name}</h3>
                <p>{copy.descriptions[platform.id as keyof typeof copy.descriptions] ?? platform.description}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
