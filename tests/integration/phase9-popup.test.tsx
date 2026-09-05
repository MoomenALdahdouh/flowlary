import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { App } from '../../extension/src/popup/App.tsx'
import { buildStatus, handleMessage } from '../../extension/src/background/index.ts'
import {
  DEFAULT_CORRECTION,
  DEFAULT_LAYOUT,
  DEFAULT_SETTINGS,
  DEFAULT_TRANSLATION,
  stateManager,
} from '../../extension/src/core/state/StateManager.ts'
import { flowlaryStorage } from '../../extension/src/storage/index.ts'
import { setFirstWinState } from '../../extension/src/storage/ui/firstWin.ts'
import { sendCommandToActiveTab } from '../../extension/src/background/commands.ts'

vi.mock('../../extension/src/background/commands.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../extension/src/background/commands.ts')>()
  return {
    ...actual,
    sendCommandToActiveTab: vi.fn().mockResolvedValue({ sent: true, handlerExecuted: true }),
  }
})

const mockSendCommand = vi.mocked(sendCommandToActiveTab)

import { STORAGE_KEYS } from '@flowlary/shared'

const FIRST_WIN_COMPLETED = {
  [STORAGE_KEYS.uiFirstWin]: {
    completed: true,
    localSuccess: true,
    aiSuccess: false,
    completedAt: Date.now(),
  },
}

function mockChromeWithFirstWinComplete() {
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
        get: vi.fn(async (keys: string | string[] | Record<string, unknown> | null) => {
          if (keys == null) return { ...FIRST_WIN_COMPLETED }
          if (typeof keys === 'string') {
            return keys in FIRST_WIN_COMPLETED
              ? { [keys]: FIRST_WIN_COMPLETED[keys as keyof typeof FIRST_WIN_COMPLETED] }
              : {}
          }
          return {}
        }),
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
  return handler
}

describe('Phase 9 — Popup UX integration', () => {
  beforeEach(() => {
    // Feature blobs are projections of the unified writing policy. Reset the
    // policy fields, not only correction.enabled / layout.autoEnabled.
    stateManager.settings = { ...DEFAULT_SETTINGS, enabled: true, pausedUntil: null }
    stateManager.correction = { ...DEFAULT_CORRECTION, consentAccepted: true }
    stateManager.translation = { ...DEFAULT_TRANSLATION }
    stateManager.layout = { ...DEFAULT_LAYOUT }
    mockSendCommand.mockClear()
  })

  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome
  })

  it('A — GET_STATUS returns current popup state', async () => {
    const status = await handleMessage({ type: 'GET_STATUS' })
    expect(status).toMatchObject({
      brand: { name: 'Flowlary' },
      layout: { autoEnabled: true },
      correction: { aiReady: true },
    })
  })

  it('B — SET_CORRECTION persists independently from translation', async () => {
    await handleMessage({ type: 'SET_CORRECTION', patch: { enabled: false } })
    expect(stateManager.correction.enabled).toBe(false)
    expect(stateManager.translation.shortcutEnabled).toBe(true)

    await handleMessage({ type: 'SET_TRANSLATION', patch: { shortcutEnabled: false } })
    expect(stateManager.correction.enabled).toBe(false)
    expect(stateManager.translation.shortcutEnabled).toBe(false)
  })

  it('C — quick action forwards RUN_COMMAND to active tab', async () => {
    const response = await handleMessage({ type: 'RUN_COMMAND', operation: 'TRANSLATE' })
    expect(response).toMatchObject({ ok: true })
    expect(mockSendCommand).toHaveBeenCalledWith('TRANSLATE')
  })

  it('D — global pause disables active state', async () => {
    await handleMessage({ type: 'SET_SETTINGS', patch: { enabled: false } })
    const status = await buildStatus()
    expect(status.active).toBe(false)
  })

  it('E — SET_LAYOUT patches fixWrongTyping without changing improveEnglish', async () => {
    await handleMessage({ type: 'SET_LAYOUT', patch: { autoEnabled: false } })
    expect(stateManager.layout.autoEnabled).toBe(false)
    expect(stateManager.settings.fixWrongTyping).toBe(false)
    expect(stateManager.correction.enabled).toBe(true)
    expect(stateManager.settings.improveEnglish).toBe(true)
    expect(stateManager.translation.liveEnabled).toBe(false)
    expect(stateManager.settings.arabicToEnglishMode).toBe(false)
  })

  it('E2 — SET_LAYOUT does not re-enable English when improveEnglish is off', async () => {
    await handleMessage({ type: 'SET_CORRECTION', patch: { enabled: false } })
    expect(stateManager.correction.enabled).toBe(false)

    await handleMessage({ type: 'SET_LAYOUT', patch: { autoEnabled: false } })
    expect(stateManager.layout.autoEnabled).toBe(false)
    expect(stateManager.settings.fixWrongTyping).toBe(false)
    expect(stateManager.correction.enabled).toBe(false)
    expect(stateManager.settings.improveEnglish).toBe(false)

    await handleMessage({ type: 'SET_LAYOUT', patch: { autoEnabled: true } })
    expect(stateManager.layout.autoEnabled).toBe(true)
    expect(stateManager.settings.fixWrongTyping).toBe(true)
    expect(stateManager.correction.enabled).toBe(false)
    expect(stateManager.settings.improveEnglish).toBe(false)
  })

  it('E3 — SET_LAYOUT still configures layout when the product is paused', async () => {
    await handleMessage({ type: 'SET_SETTINGS', patch: { enabled: false } })
    await handleMessage({ type: 'SET_LAYOUT', patch: { autoEnabled: false } })
    expect(stateManager.settings.enabled).toBe(false)
    expect(stateManager.layout.autoEnabled).toBe(false)
    expect(stateManager.settings.fixWrongTyping).toBe(false)
    expect(stateManager.correction.enabled).toBe(true)
    expect(stateManager.settings.improveEnglish).toBe(true)
  })

  it('F — clearing consent marks correction as needing setup', async () => {
    await handleMessage({ type: 'SET_CORRECTION', patch: { consentAccepted: false } })
    const status = await buildStatus()
    expect(status.correction.consentAccepted).toBe(false)
    expect(status.correction.aiReady).toBe(false)
  })

  it('G — SET_TRANSLATION liveEnabled persists independently', async () => {
    await handleMessage({ type: 'SET_TRANSLATION', patch: { liveEnabled: true } })
    expect(stateManager.translation.liveEnabled).toBe(true)
    const status = await buildStatus()
    expect(status.translation.liveEnabled).toBe(true)
  })
})

describe('Popup rendering', () => {
  let container: HTMLDivElement

  beforeEach(async () => {
    stateManager.settings.enabled = true
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.translation.shortcutEnabled = true
    stateManager.translation.liveEnabled = false
    stateManager.layout.autoEnabled = true
    await setFirstWinState(flowlaryStorage, { completed: true, localSuccess: true })
    mockChromeWithFirstWinComplete()
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

  it('renders a compact speed surface with features and dashboard entry', async () => {
    await act(async () => {
      createRoot(container).render(<App />)
    })
    for (let i = 0; i < 40; i++) {
      if (container.textContent?.includes('Help in fields')) break
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 15))
      })
    }

    expect(container.textContent).toContain('Flowlary')
    expect(container.textContent).toContain('Help in fields')
    expect(container.textContent).toContain('Fix')
    expect(container.textContent).toContain('Translate')
    expect(container.textContent).toContain('Layout')
    expect(container.textContent).toContain('Speed Box')
    expect(container.textContent).toContain('AI checks today')
    expect(container.textContent).toContain('Shortcuts')
    expect(container.textContent).toContain('Dashboard')
    expect(container.textContent).toContain('All settings')

    const shortcuts = (await import('../../extension/src/popup/shortcuts.ts')).getShortcutLabels()
    const actionKbds = Array.from(container.querySelectorAll('button.fl-zip-action kbd.fl-kbd')).map(
      (el) => el.textContent,
    )
    expect(actionKbds).toEqual([shortcuts.fixLayout, shortcuts.translate, shortcuts.fixWriting])
    expect(container.textContent).toContain(shortcuts.speedBox)

    expect(container.textContent).not.toContain('gsk_test')
    expect(container.textContent).not.toContain('Local history')
    expect(container.textContent).not.toContain('Correction mode')
    expect(container.querySelector('.fl-bottom-nav')).toBeNull()
  })

  it('opens the dashboard from the footer control', async () => {
    await act(async () => {
      createRoot(container).render(<App />)
    })
    for (let i = 0; i < 40; i++) {
      if (container.textContent?.includes('Dashboard')) break
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 15))
      })
    }

    const dashboardBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Dashboard',
    )
    expect(dashboardBtn).toBeTruthy()
    await act(async () => {
      dashboardBtn!.click()
    })
    const chromeApi = (globalThis as { chrome: { tabs: { create: ReturnType<typeof vi.fn> } } }).chrome
    expect(chromeApi.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test/src/dashboard/index.html#overview',
    })
  })
})
