import type { ReactElement } from 'react'
import type { FeatureMode } from './playground/demoData.ts'

const ICONS: Record<FeatureMode, ReactElement> = {
  correction: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 14.5 11.5 7 14 9.5 6.5 17H4v-2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12.5 5.5 14.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  translation: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 6h8M7 6v10M7 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 10h4M15 8v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  live: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </svg>
  ),
  layout: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 9h2M6 12h8M12 9h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  speedbox: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
}

export function FeatureIcon({ mode }: { mode: FeatureMode }) {
  return ICONS[mode]
}

export const FEATURE_MODES: FeatureMode[] = [
  'correction',
  'translation',
  'live',
  'layout',
]
