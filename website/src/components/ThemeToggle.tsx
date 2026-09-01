import { useEffect } from 'react'
import { useMessages } from '../i18n/index.tsx'
import { subscribeSystemTheme, syncDocumentTheme, toggleTheme } from '../theme.ts'

export function ThemeToggle() {
  const t = useMessages()

  useEffect(() => {
    syncDocumentTheme()
    return subscribeSystemTheme()
  }, [])

  return (
    <button type="button" className="theme-toggle" aria-label={t.a11y.theme} onClick={() => toggleTheme()}>
      <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 3.2v1.8M12 19v1.8M4.9 4.9l1.3 1.3M17.8 17.8l1.3 1.3M3.2 12H5M19 12h1.8M4.9 19.1l1.3-1.3M17.8 6.2l1.3-1.3" />
      </svg>
      <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.2 4.2a7.4 7.4 0 1 0 4.6 12.9 6.2 6.2 0 0 1-8.3-8.4 7.3 7.3 0 0 0 3.7-4.5Z" />
      </svg>
    </button>
  )
}
