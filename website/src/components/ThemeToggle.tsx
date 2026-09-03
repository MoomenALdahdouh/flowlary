import { useEffect, useState } from 'react'
import { useMessages } from '../i18n/index.tsx'
import {
  readStoredThemePreference,
  subscribeSystemTheme,
  syncDocumentTheme,
  toggleTheme,
  type ThemePreference,
} from '../theme.ts'

export function ThemeToggle() {
  const t = useMessages()
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredThemePreference() ?? 'system')

  useEffect(() => {
    syncDocumentTheme()
    return subscribeSystemTheme()
  }, [])

  function onToggle() {
    toggleTheme()
    setPreference(readStoredThemePreference() ?? 'system')
  }

  const label =
    preference === 'system'
      ? t.a11y.themeSystem ?? t.a11y.theme
      : preference === 'light'
        ? t.a11y.themeLight ?? t.a11y.theme
        : t.a11y.themeDark ?? t.a11y.theme

  return (
    <button type="button" className="theme-toggle" aria-label={label} onClick={onToggle}>
      <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 3.2v1.8M12 19v1.8M4.9 4.9l1.3 1.3M17.8 17.8l1.3 1.3M3.2 12H5M19 12h1.8M4.9 19.1l1.3-1.3M17.8 6.2l1.3-1.3" />
      </svg>
      <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.2 4.2a7.4 7.4 0 1 0 4.6 12.9 6.2 6.2 0 0 1-8.3-8.4 7.3 7.3 0 0 0 3.7-4.5Z" />
      </svg>
      <svg className="theme-icon theme-icon-system" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="11" rx="1.8" />
        <path d="M8.5 19h7" />
      </svg>
    </button>
  )
}
