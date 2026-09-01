import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { subscribeSystemTheme, syncDocumentTheme } from '@flowlary/shared/theme'
import { DashboardApp } from './App.tsx'
import { I18nProvider } from '../popup/i18n/I18nProvider.tsx'
import { bootstrapDashboardAccount } from './accountBootstrap.ts'
import '../popup/tokens.css'
import './dashboard.css'

syncDocumentTheme()
subscribeSystemTheme()

async function startDashboard(): Promise<void> {
  await bootstrapDashboardAccount()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider>
        <DashboardApp />
      </I18nProvider>
    </StrictMode>,
  )
}

void startDashboard()
