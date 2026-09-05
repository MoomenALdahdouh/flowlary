import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DashboardApp } from '../../extension/src/dashboard/App.tsx'
import { App } from '../../extension/src/popup/App.tsx'
import { handleMessage } from '../../extension/src/background/index.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { computeDomainState } from '../../extension/src/ui/domainState.ts'
import type { ExtensionStatus } from '../../extension/src/messaging/types.ts'
import { BRAND, FREE_DAILY_CREDITS, STORAGE_KEYS } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { flowlaryStorage } from '../../extension/src/storage/index.ts'
import { setFirstWinState } from '../../extension/src/storage/ui/firstWin.ts'

function installTestChrome(store: ReturnType<typeof createMockChromeStorage>) {
  const handler = vi.fn(async (message: { type: string; patch?: Record<string, unknown> }) => {
    return handleMessage(message)
  })
  store.install()
  const chromeApi = (globalThis as { chrome: typeof chrome }).chrome
  chromeApi.runtime.sendMessage = handler
  chromeApi.runtime.getURL = (path: string) => `chrome-extension://test/${path}`
  chromeApi.tabs.create = vi.fn()
  return handler
}

function baseStatus(overrides: Partial<ExtensionStatus> = {}): ExtensionStatus {
  return {
    brand: BRAND,
    active: true,
    features: { correction: true, translation: true, layout: true },
    translation: {
      liveEnabled: false,
      shortcutEnabled: true,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    },
    correction: {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
      aiReady: true,
    },
    entitlement: {
      status: 'free',
      hasLicenseKey: false,
      isPro: false,
      inTrial: false,
      trialEndsAt: null,
      remainingMs: FREE_DAILY_CREDITS,
      creditsRemaining: FREE_DAILY_CREDITS,
      creditsUsed: 0,
      dailyLimit: FREE_DAILY_CREDITS,
      resetAt: Date.now() + 3_600_000,
      monthlyCreditsUsed: 0,
      monthlySoftCap: null,
      capabilities: ['ai.correction', 'ai.translation', 'keyboard.unlimited', 'speedbox.unlimited'],
    },
    account: {
      signedIn: true,
      accountId: '11111111-1111-4111-8111-111111111111',
      email: 'user@flowlary.com',
      serverPlan: 'free',
      billingAvailable: false,
      subscriptionStatus: null,
      cancelAtPeriodEnd: false,
      paymentFailed: false,
      currentPeriodEnd: null,
    },
    apiHealth: 'ok',
    layout: {
      autoEnabled: true,
      manualConversionEnabled: true,
      directShortcutEnabled: true,
      sourceLayout: 'en',
      targetLayouts: ['ar'],
    },
    learning: {
      onboardingCompleted: true,
      showFullOnboarding: false,
      showSetupPrompt: false,
      onboardingStep: null,
      summary: null,
    },
    version: '1.1.0',
    ...overrides,
  }
}

async function waitUntil(container: HTMLDivElement, text: string) {
  for (let i = 0; i < 40; i++) {
    if (container.textContent?.includes(text)) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15))
    })
  }
  throw new Error(`Timed out waiting for "${text}"`)
}

describe('Phase 22A — foundation cleanup', () => {
  let container: HTMLDivElement
  let root: Root | null = null
  const store = createMockChromeStorage({
    local: {
      [STORAGE_KEYS.uiFirstWin]: {
        completed: true,
        localSuccess: true,
        aiSuccess: false,
        completedAt: Date.now(),
      },
    },
  })

  beforeEach(async () => {
    store.reset()
    store.local[STORAGE_KEYS.uiFirstWin] = {
      completed: true,
      localSuccess: true,
      aiSuccess: false,
      completedAt: Date.now(),
    }
    store.install()
    stateManager.settings.enabled = true
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.translation.shortcutEnabled = true
    stateManager.layout.autoEnabled = true
    window.location.hash = ''
    await setFirstWinState(flowlaryStorage, { completed: true, localSuccess: true })
    installTestChrome(store)
    container = document.createElement('div')
    document.body.append(container)
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount()
      })
      root = null
    }
    container.remove()
    delete (globalThis as { chrome?: unknown }).chrome
  })

  async function renderApp(node: JSX.Element) {
    if (root) {
      await act(async () => {
        root!.unmount()
      })
    }
    root = createRoot(container)
    await act(async () => {
      root!.render(node)
    })
  }

  it('manifest has no client-side Groq host permission', () => {
    const devManifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../extension/manifest.json'), 'utf8'),
    ) as { host_permissions: string[] }
    const prodManifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../extension/manifest.prod.json'), 'utf8'),
    ) as { host_permissions: string[] }
    expect(devManifest.host_permissions).not.toContain('https://api.groq.com/*')
    expect(prodManifest.host_permissions).not.toContain('https://api.groq.com/*')
  })

  it('popup and dashboard omit BYOK/Groq UI', async () => {
    await renderApp(<App />)
    await waitUntil(container, 'Help in fields')
    const popupText = container.textContent ?? ''
    expect(popupText).not.toMatch(/groq|byok|bring your own key|api key/i)

    await renderApp(<DashboardApp />)
    await waitUntil(container, 'Settings')
    const dashText = container.textContent ?? ''
    expect(dashText).not.toMatch(/groq|byok|bring your own key|api key/i)
    expect(dashText).toContain('Flowlary')
  })

  it('uses Overview, Writing Lab, and account navigation without History', async () => {
    await renderApp(<DashboardApp />)
    await waitUntil(container, 'Overview')
    const navButtons = Array.from(container.querySelectorAll('.wd-nav-groups a, .wd-nav-groups button')).map(
      (btn) => btn.textContent?.trim(),
    )
    expect(navButtons).toEqual([
      'Overview',
      'Writing Lab',
      'Practice',
      'Progress',
      'Report',
      'Settings',
      'Account',
      'Activity',
      'Support',
    ])
    expect(navButtons).not.toContain('Home')
    expect(navButtons).not.toContain('History')
  })

  it('renders Progress with honest empty state', async () => {
    await renderApp(<DashboardApp />)
    await waitUntil(container, 'Writing settings')

    const progressBtn = Array.from(container.querySelectorAll('.wd-nav-groups button')).find(
      (btn) => btn.textContent === 'Progress',
    )
    await act(async () => {
      progressBtn!.click()
    })
    await waitUntil(container, 'Your progress is building')
    expect(container.textContent).toContain('Your progress is building')
    expect(container.textContent).not.toContain('Total actions')
    expect(container.textContent).not.toContain('Activity summary')
  })

  it('shows data controls under Settings, not embedded activity list', async () => {
    await renderApp(<DashboardApp />)
    await waitUntil(container, 'Writing settings')
    const settingsBtn = Array.from(container.querySelectorAll('.wd-nav-groups button')).find(
      (btn) => btn.textContent === 'Settings',
    )
    await act(async () => {
      settingsBtn!.click()
    })
    await waitUntil(container, 'Highlights')
    const dataBtn = Array.from(container.querySelectorAll('[role="tab"]')).find((btn) => btn.textContent === 'Data')
    expect(dataBtn).toBeTruthy()
    await act(async () => {
      dataBtn!.click()
    })
    expect(container.textContent).toContain('Your data')
    expect(container.textContent).toContain('Clear learning data')
    expect(container.textContent).not.toContain('Learning history')
  })

  it('keeps keyboard layout ready when Flowlary AI is unavailable', () => {
    const domain = computeDomainState(
      baseStatus({ apiHealth: 'offline' }),
      false,
    )
    expect(domain?.ai).toBe('temporarily_unavailable')
    expect(domain?.features.correction.kind).toBe('unavailable')
    expect(domain?.features.layout.kind).toBe('ready')
  })

  it('rejects legacy groq key patches without exposing provider fields in status', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    const { seedFlowlaryAccountAuth } = await import('../helpers/mockFlowlaryAuth.ts')
    seedFlowlaryAccountAuth(mockStore)
    mockStore.local[STORAGE_KEYS.correctionGroqKey] = 'gsk_legacy'
    mockStore.local[STORAGE_KEYS.correction] = {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: false,
      aiProvider: 'byok',
    }
    const status = await handleMessage({ type: 'GET_STATUS' })
    expect(status.correction).not.toHaveProperty('hasGroqKey')
    expect(status.correction).not.toHaveProperty('aiProvider')

    await handleMessage({
      type: 'SET_CORRECTION',
      patch: { consentAccepted: true },
    })
    expect(mockStore.local[STORAGE_KEYS.correctionGroqKey]).toBeUndefined()
  })
})
