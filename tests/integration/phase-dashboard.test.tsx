import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { DashboardApp } from '../../extension/src/dashboard/App.tsx'
import { handleMessage } from '../../extension/src/background/index.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'

vi.mock('../../extension/src/background/commands.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../extension/src/background/commands.ts')>()
  return {
    ...actual,
    sendCommandToActiveTab: vi.fn().mockResolvedValue({ sent: true, handlerExecuted: true }),
  }
})

function mockChrome() {
  const handler = vi.fn(async (message: { type: string; patch?: Record<string, unknown>; operation?: string }) => {
    return handleMessage(message)
  })
  ;(globalThis as { chrome?: unknown }).chrome = {
    runtime: {
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      sendMessage: handler,
      id: 'test-extension',
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    commands: {
      onCommand: { addListener: vi.fn() },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      sync: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  }
}

async function waitUntil(container: HTMLDivElement, text: string) {
  for (let i = 0; i < 40; i++) {
    if (container.textContent?.includes(text)) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15))
    })
  }
  throw new Error(`Timed out waiting for "${text}" in: ${container.textContent?.slice(0, 200)}`)
}

describe('Extension dashboard', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    stateManager.settings.enabled = true
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.translation.shortcutEnabled = true
    stateManager.translation.liveEnabled = false
    stateManager.layout.autoEnabled = true
    window.location.hash = ''
    mockChrome()
    container = document.createElement('div')
    document.body.append(container)
  })

  afterEach(() => {
    container.remove()
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        sendMessage: vi.fn(),
      },
      commands: {
        onCommand: { addListener: vi.fn() },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([]),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    })
  })

  it('renders home with practice, progress, settings, and account navigation', async () => {
    await act(async () => {
      createRoot(container).render(<DashboardApp />)
    })
    await waitUntil(container, 'Try it')

    expect(container.textContent).toContain('Dashboard')
    expect(container.textContent).toContain('Home')
    expect(container.textContent).toContain('Progress')
    expect(container.textContent).toContain('Practice')
    expect(container.textContent).toContain('Report')
    expect(container.textContent).toContain('Settings')
    expect(container.textContent).toContain('Account')
    expect(container.textContent).not.toContain('History')
    expect(container.textContent).toContain('Writing Correction')
    expect(container.textContent).toContain('Tools')
    expect(container.textContent).not.toContain('gsk_test')
    expect(container.textContent).not.toMatch(/groq|byok/i)
  })

  it('opens settings tabs for writing, data, and privacy', async () => {
    await act(async () => {
      createRoot(container).render(<DashboardApp />)
    })
    await waitUntil(container, 'Writing Correction')

    const settingsBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Settings',
    )
    expect(settingsBtn).toBeTruthy()
    await act(async () => {
      settingsBtn!.click()
    })
    expect(container.textContent).toContain('Mode')
    expect(container.textContent).toContain('Highlights')

    const dataBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent === 'Data')
    expect(dataBtn).toBeTruthy()
    await act(async () => {
      dataBtn!.click()
    })
    expect(container.textContent).toContain('Your data')
    expect(container.textContent).toContain('Clear activity')

    const privacyBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Privacy',
    )
    expect(privacyBtn).toBeTruthy()
    await act(async () => {
      privacyBtn!.click()
    })
    expect(container.textContent).toContain('What stays on your device')
    expect(container.textContent).not.toMatch(/bring your own key|groq/i)
  })
})
