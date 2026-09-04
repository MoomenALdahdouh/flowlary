import { flowlaryFaviconDataUri } from './markSvg.ts'

export const THEME_STORAGE_KEY = 'flowlary-theme'
export const THEME_DARK = '#0b1120'
export const THEME_LIGHT = '#f7f8fc'

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return isTheme(value) || value === 'system'
}

export function themeFromSystem(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function readStoredThemePreference(): ThemePreference | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : null
  } catch {
    return null
  }
}

/** @deprecated Use readStoredThemePreference */
export function readStoredTheme(): Theme | null {
  const pref = readStoredThemePreference()
  return pref && pref !== 'system' ? pref : null
}

export function resolveTheme(): Theme {
  const pref = readStoredThemePreference()
  if (!pref || pref === 'system') return themeFromSystem()
  return pref
}

export function applyTheme(theme: Theme, persistPreference?: ThemePreference): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? THEME_LIGHT : THEME_DARK)
  syncFavicon(theme)
  if (!persistPreference) return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, persistPreference)
  } catch {
    /* private mode */
  }
}

function syncFavicon(theme: Theme): void {
  if (typeof document === 'undefined') return
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/svg+xml'
    document.head.appendChild(link)
  }
  link.href = flowlaryFaviconDataUri(theme)
}

export function setThemePreference(preference: ThemePreference): Theme {
  const resolved = preference === 'system' ? themeFromSystem() : preference
  applyTheme(resolved, preference)
  return resolved
}

export function toggleTheme(): Theme {
  const pref = readStoredThemePreference() ?? 'system'
  const order: ThemePreference[] = ['light', 'dark', 'system']
  const nextPref = order[(order.indexOf(pref) + 1) % order.length] ?? 'system'
  return setThemePreference(nextPref)
}

export function syncDocumentTheme(): Theme {
  const theme = resolveTheme()
  applyTheme(theme)
  return theme
}

export function subscribeSystemTheme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia('(prefers-color-scheme: light)')
  function onChange() {
    const pref = readStoredThemePreference()
    if (pref && pref !== 'system') return
    applyTheme(themeFromSystem())
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
