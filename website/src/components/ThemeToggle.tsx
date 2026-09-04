import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useMessages } from '../i18n/index.tsx'
import {
  readStoredThemePreference,
  setThemePreference,
  subscribeSystemTheme,
  syncDocumentTheme,
  type ThemePreference,
} from '../theme.ts'

export function ThemeBoot() {
  useEffect(() => {
    syncDocumentTheme()
    return subscribeSystemTheme()
  }, [])
  return null
}

const OPTIONS: { value: ThemePreference; Icon: typeof Sun; labelKey: 'themeLight' | 'themeDark' | 'themeSystem'; shortKey: 'themeLightShort' | 'themeDarkShort' | 'themeSystemShort' }[] = [
  { value: 'light', Icon: Sun, labelKey: 'themeLight', shortKey: 'themeLightShort' },
  { value: 'dark', Icon: Moon, labelKey: 'themeDark', shortKey: 'themeDarkShort' },
  { value: 'system', Icon: Monitor, labelKey: 'themeSystem', shortKey: 'themeSystemShort' },
]

export function ThemeToggle() {
  const t = useMessages()
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredThemePreference() ?? 'system')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    syncDocumentTheme()
    setPreference(readStoredThemePreference() ?? 'system')
    return subscribeSystemTheme()
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(next: ThemePreference) {
    setThemePreference(next)
    setPreference(next)
    setOpen(false)
  }

  const current = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[2]
  const CurrentIcon = current.Icon

  return (
    <div ref={root} className="theme-toggle fl-nav-icon relative" role="group" aria-label={t.a11y.theme}>
      <button
        type="button"
        className="fl-nav-icon__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.a11y[current.labelKey]}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div className="fl-nav-menu" role="listbox" aria-label={t.a11y.theme}>
          <p className="fl-nav-menu__kicker">{t.a11y.theme}</p>
          {OPTIONS.map((option) => {
            const Icon = option.Icon
            const selected = preference === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={t.a11y[option.labelKey]}
                className="fl-nav-menu__item"
                onClick={() => choose(option.value)}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t.a11y[option.labelKey]}
                </span>
                {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
