import type { ReactNode } from 'react'
import { BrowserStage } from '../product/BrowserStage.tsx'

export function ProductScene({
  url,
  children,
  className = '',
  size = 'default',
  glow = 'none',
}: {
  url: string
  children: ReactNode
  className?: string
  size?: 'default' | 'large' | 'hero'
  glow?: 'none' | 'cyan' | 'magenta' | 'mixed'
}) {
  return (
    <div
      className={`xp-scene xp-scene-${size} xp-scene-glow-${glow} ${className}`.trim()}
    >
      <BrowserStage url={url}>{children}</BrowserStage>
    </div>
  )
}

export function WritingField({
  value,
  dir = 'ltr',
  lang = 'en',
  focused = false,
  children,
  label,
}: {
  value: ReactNode
  dir?: 'ltr' | 'rtl'
  lang?: string
  focused?: boolean
  children?: ReactNode
  label?: string
}) {
  return (
    <div className={`xp-field${focused ? ' is-focused' : ''}`}>
      {label ? <p className="xp-field-label">{label}</p> : null}
      <div className="xp-field-surface" dir={dir} lang={lang}>
        <p className="xp-field-text">{value}</p>
        {focused ? <span className="xp-cursor" aria-hidden="true" /> : null}
      </div>
      {children}
    </div>
  )
}
