import {
  THEME_STORAGE_KEY,
  THEME_DARK,
  THEME_LIGHT,
  type Theme,
  type ThemePreference,
  isTheme,
  isThemePreference,
  themeFromSystem,
  readStoredTheme,
  readStoredThemePreference,
  resolveTheme,
  applyTheme,
  syncDocumentTheme,
  subscribeSystemTheme,
  setThemePreference as persistThemePreference,
} from '@flowlary/shared/theme'
import { canStorePreferences } from './cookies/consent.ts'

export {
  THEME_STORAGE_KEY,
  THEME_DARK,
  THEME_LIGHT,
  type Theme,
  type ThemePreference,
  isTheme,
  isThemePreference,
  themeFromSystem,
  readStoredTheme,
  readStoredThemePreference,
  resolveTheme,
  applyTheme,
  syncDocumentTheme,
  subscribeSystemTheme,
}

export function setThemePreference(preference: ThemePreference): Theme {
  const resolved = preference === 'system' ? themeFromSystem() : preference
  if (canStorePreferences()) return persistThemePreference(preference)
  applyTheme(resolved)
  return resolved
}

export function toggleTheme(): Theme {
  const pref = readStoredThemePreference() ?? 'system'
  const order: ThemePreference[] = ['light', 'dark', 'system']
  const nextPref = order[(order.indexOf(pref) + 1) % order.length] ?? 'system'
  return setThemePreference(nextPref)
}
