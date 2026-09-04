import { createContext, useContext, type ReactNode } from 'react'
import { ThemeBoot, ThemeToggle } from '../../components/ThemeToggle.tsx'
import { resolveTheme, toggleTheme as cycleTheme, type Theme } from '../../theme.ts'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/** Shared Flowlary theme (data-theme + .dark). Do not persist light/dark-only here. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider
      value={{
        theme: resolveTheme(),
        toggleTheme: () => {
          cycleTheme()
        },
      }}
    >
      <ThemeBoot />
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export { ThemeToggle }
