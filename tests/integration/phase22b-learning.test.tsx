import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORAGE_KEYS } from '@flowlary/shared'
import { DashboardApp } from '../../extension/src/dashboard/App.tsx'
import { ProgressPanel } from '../../extension/src/dashboard/panels/ProgressPanel.tsx'
import { OnboardingFlow } from '../../extension/src/dashboard/onboarding/OnboardingFlow.tsx'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import type { ExtensionStatus } from '../../extension/src/messaging/types.ts'
import { createDefaultLearningProfile } from '@flowlary/shared'
import { activateTestAccount, clearTestAccountContext, TEST_ACCOUNT_A } from '../helpers/accountIsolation.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'
import { buildAccountScopedKey } from '../../extension/src/storage/accountScopedStorage.ts'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, '../..')

describe('Phase 22B — learning foundation + onboarding', () => {
  const store = createMockChromeStorage()
  let container: HTMLDivElement
  let root: Root | null = null

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    await clearTestAccountContext()
    seedFlowlaryAccountAuth(store)
    await activateTestAccount()
    Object.assign(stateManager.correction, {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: false,
    })
    Object.assign(stateManager.translation, {
      liveEnabled: false,
      shortcutEnabled: true,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    Object.assign(stateManager.layout, {
      autoEnabled: true,
      manualConversionEnabled: true,
      directShortcutEnabled: true,
      sourceLayout: 'en-US-qwerty',
      targetLayouts: ['ar-101'],
    })

    const handler = vi.fn(async (message: { type: string; patch?: Record<string, unknown> }) =>
      handleMessage(message),
    )
    const chromeGlobal = globalThis as {
      chrome: {
        runtime: {
          sendMessage: typeof handler
          getURL: (path: string) => string
        }
      }
    }
    chromeGlobal.chrome.runtime.sendMessage = handler
    chromeGlobal.chrome.runtime.getURL = (path: string) => `chrome-extension://test/${path}`

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    root?.unmount()
    container.remove()
  })

  async function waitUntil(text: string) {
    for (let i = 0; i < 60; i++) {
      if (container.textContent?.includes(text)) return
      await act(async () => {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 15))
      })
    }
    throw new Error(`Timed out waiting for "${text}"`)
  }

  it('does not expose BYOK or provider setup in onboarding and learning settings', () => {
    const onboardingSource = readFileSync(
      resolve(repoRoot, 'extension/src/dashboard/onboarding/OnboardingFlow.tsx'),
      'utf8',
    )
    const learningSettingsSource = readFileSync(
      resolve(repoRoot, 'extension/src/dashboard/panels/LearningSettingsSection.tsx'),
      'utf8',
    )
    expect(onboardingSource).not.toMatch(/\bBYOK\b|\bgroqApiKey\b|\bGroq\b/i)
    expect(learningSettingsSource).not.toMatch(/\bBYOK\b|\bgroqApiKey\b|\bGroq\b/i)
  })

  it('Progress remains empty-state without fake metrics', async () => {
    await act(async () => {
      root!.render(<ProgressPanel onOpenActivity={() => undefined} />)
    })
    await waitUntil('Your progress is building')
    expect(container.textContent).not.toMatch(/corrections applied|words corrected|mistake rate/i)
  })

  it('creates migrated profile for existing installs without forcing full onboarding', async () => {
    store.local[STORAGE_KEYS.translation] = {
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      liveEnabled: false,
      shortcutEnabled: true,
      _v: 1,
    }
    store.local[STORAGE_KEYS.learningInstall] = { kind: 'existing', createdAt: Date.now(), _v: 1 }

    const status = (await handleMessage({ type: 'GET_STATUS' })) as ExtensionStatus
    expect(status.learning.showFullOnboarding).toBe(false)
    expect(status.learning.showSetupPrompt).toBe(true)
    expect(status.translation.sourceLanguage).toBe('ar')
  })

  it('fresh install exposes full onboarding through status', async () => {
    store.local[STORAGE_KEYS.learningInstall] = { kind: 'fresh', createdAt: Date.now(), _v: 1 }

    const status = (await handleMessage({ type: 'GET_STATUS' })) as ExtensionStatus
    expect(status.learning.showFullOnboarding).toBe(true)
    expect(status.learning.onboardingStep).toBe('welcome')
  })

  it('accepts AI consent during onboarding welcome step', async () => {
    const profile = createDefaultLearningProfile()
    const status = (await handleMessage({ type: 'GET_STATUS' })) as ExtensionStatus

    await act(async () => {
      root!.render(
        <OnboardingFlow
          status={status}
          profile={profile}
          busy={false}
          onStatusChange={() => undefined}
          onProfileChange={() => undefined}
          onComplete={() => undefined}
        />,
      )
    })

    await waitUntil('Meet Flowlary')
    expect(container.textContent).toContain('Flowlary AI')

    const consent = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    await act(async () => {
      consent.click()
    })

    const getStarted = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Get started'),
    )
    await act(async () => {
      getStarted!.click()
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 30))
    })

    const nextStatus = (await handleMessage({ type: 'GET_STATUS' })) as ExtensionStatus
    expect(nextStatus.correction.consentAccepted).toBe(true)
  })

  it('completes onboarding and clears full onboarding flag', async () => {
    store.local[STORAGE_KEYS.learningInstall] = { kind: 'fresh', createdAt: Date.now(), _v: 1 }
    await handleMessage({ type: 'GET_STATUS' })

    await handleMessage({ type: 'COMPLETE_ONBOARDING' })
    const status = (await handleMessage({ type: 'GET_STATUS' })) as ExtensionStatus
    expect(status.learning.onboardingCompleted).toBe(true)
    expect(status.learning.showFullOnboarding).toBe(false)
    expect(status.learning.summary).toContain('English')
  })

  it('reset learning profile does not clear activity history', async () => {
    store.local[buildAccountScopedKey(TEST_ACCOUNT_A, 'history')] = {
      version: 1,
      entries: [
        {
          id: 'entry-1',
          operation: 'CORRECT',
          timestamp: Date.now(),
          sourceText: 'hello',
          resultText: 'Hello',
        },
      ],
      _v: 1,
    }
    await handleMessage({ type: 'GET_STATUS' })
    await handleMessage({ type: 'RESET_LEARNING_PROFILE' })
    const history = await handleMessage({ type: 'GET_HISTORY' })
    expect(history && 'entries' in history && history.entries.length).toBe(1)
  })

  it('renders dashboard setup card for existing users', async () => {
    store.local[STORAGE_KEYS.translation] = {
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      liveEnabled: false,
      shortcutEnabled: true,
      _v: 1,
    }
    store.local[STORAGE_KEYS.learningInstall] = { kind: 'existing', createdAt: Date.now(), _v: 1 }

    await act(async () => {
      root!.render(<DashboardApp />)
    })
    await waitUntil('Learning setup')
    expect(container.textContent).not.toContain('Meet Flowlary')
  })
})
