export const THEME_STORAGE_KEY = 'flowlary-theme'
export const THEME_DARK = '#05070b'
export const THEME_LIGHT = '#f4f8fd'

export type Theme = 'light' | 'dark'

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}

export function themeFromSystem(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? themeFromSystem()
}

export function applyTheme(theme: Theme, persist: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? THEME_LIGHT : THEME_DARK)
  if (!persist) return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* private mode */
  }
}

export function toggleTheme(): Theme {
  const current = document.documentElement.getAttribute('data-theme')
  const next: Theme = current === 'light' ? 'dark' : 'light'
  applyTheme(next, true)
  return next
}

export function syncDocumentTheme(): Theme {
  const theme = resolveTheme()
  applyTheme(theme, false)
  return theme
}

export function subscribeSystemTheme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia('(prefers-color-scheme: light)')
  function onChange() {
    if (readStoredTheme()) return
    applyTheme(themeFromSystem(), false)
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
