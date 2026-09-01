import { afterEach, describe, expect, it } from 'vitest'
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  themeFromSystem,
  toggleTheme,
} from '../theme.ts'

function setScheme(light: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: light && query.includes('prefers-color-scheme: light'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
    }) as MediaQueryList) as typeof window.matchMedia
}

afterEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY)
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.colorScheme = ''
})

describe('theme', () => {
  it('follows the system scheme when nothing is stored', () => {
    setScheme(true)
    expect(themeFromSystem()).toBe('light')
    expect(resolveTheme()).toBe('light')
    setScheme(false)
    expect(resolveTheme()).toBe('dark')
  })

  it('prefers a stored choice over the system scheme', () => {
    setScheme(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredTheme()).toBe('dark')
    expect(resolveTheme()).toBe('dark')
  })

  it('applies data-theme and persists the toggle', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    expect(toggleTheme()).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    applyTheme('dark', true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('uses light on-accent text in light mode', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const shared = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../packages/shared/src/tokens.css'),
      'utf8',
    )
    const website = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../styles/global.css'),
      'utf8',
    )
    expect(shared).toContain('--fl-on-accent: #061018')
    expect(shared).toContain('--fl-on-accent: #ffffff')
    expect(website).toContain('color: var(--fl-on-accent)')
    expect(website).not.toMatch(/\.btn-primary[^{]*\{[^}]*color: var\(--fl-ink\)/)
  })

  it('does not lock product stages to a dark palette', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../styles/product.css'),
      'utf8',
    )
    expect(css).not.toContain('color-scheme: dark')
    expect(css).not.toContain('#0b1017')
    expect(css).not.toContain('#0a0e15')
  })

  it('uses Flowlary tokens in the live Speed Box overlay', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../extension/src/features/layout/speedBox.css'),
      'utf8',
    )
    expect(css).toContain('--fl-accent: #5b8cff')
    expect(css).toContain('--fl-surface: #10151f')
    expect(css).toContain('--fl-overlay: rgba(5, 7, 11, 0.72)')
    expect(css).toContain(":host([data-theme='light'])")
    expect(css).toContain('--fl-input-bg: #f4f8fd')
    expect(css).not.toContain('#f0b429')
    expect(css).not.toContain('Avenir Next')
  })
})
