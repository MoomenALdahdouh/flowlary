import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { subscribeSystemTheme, syncDocumentTheme } from '@flowlary/shared/theme'
import { App } from './App.tsx'
import { I18nProvider } from './i18n/I18nProvider.tsx'
import './tokens.css'

syncDocumentTheme()
subscribeSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
