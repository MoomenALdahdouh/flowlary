import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { App } from '../../extension/src/popup/App.tsx'
import { buildStatus, handleMessage } from '../../extension/src/background/index.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { sendCommandToActiveTab } from '../../extension/src/background/commands.ts'

vi.mock('../../extension/src/background/commands.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../extension/src/background/commands.ts')>()
  return {
    ...actual,
    sendCommandToActiveTab: vi.fn().mockResolvedValue('sent'),
  }
})

const mockSendCommand = vi.mocked(sendCommandToActiveTab)

function mockChrome(initialStatus: ReturnType<typeof buildStatus>) {
  const handler = vi.fn(async (message: { type: string; patch?: Record<string, unknown>; operation?: string }) => {
    return handleMessage(message)
  })
  ;(globalThis as { chrome?: unknown }).chrome = {
    runtime: {
      sendMessage: handler,
      id: 'test-extension',
    },
  }
  return handler
}

describe('Phase 9 — Popup UX integration', () => {
  beforeEach(() => {
    stateManager.settings.enabled = true
    stateManager.settings.pausedUntil = null
    stateManager.correction.enabled = true
    stateManager.correction.groqApiKey = 'gsk_test'
    stateManager.correction.consentAccepted = true
    stateManager.translation.shortcutEnabled = true
    stateManager.translation.liveEnabled = false
    stateManager.layout.autoEnabled = true
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
      correction: { hasGroqKey: true },
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
    const status = buildStatus()
    expect(status.active).toBe(false)
  })

  it('E — SET_LAYOUT updates layout without touching correction', async () => {
    await handleMessage({ type: 'SET_LAYOUT', patch: { autoEnabled: false } })
    expect(stateManager.layout.autoEnabled).toBe(false)
    expect(stateManager.correction.enabled).toBe(true)
  })

  it('F — removing Groq key clears connected state', async () => {
    await handleMessage({ type: 'SET_CORRECTION', patch: { groqApiKey: '', consentAccepted: false } })
    const status = buildStatus()
    expect(status.correction.hasGroqKey).toBe(false)
  })
})

describe('Popup rendering', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    stateManager.settings.enabled = true
    stateManager.correction.enabled = true
    stateManager.correction.groqApiKey = 'gsk_test'
    stateManager.correction.consentAccepted = true
    stateManager.translation.shortcutEnabled = true
    stateManager.translation.liveEnabled = false
    stateManager.layout.autoEnabled = true
    mockChrome(buildStatus())
    container = document.createElement('div')
    document.body.append(container)
  })

  afterEach(() => {
    container.remove()
    delete (globalThis as { chrome?: unknown }).chrome
  })

  it('renders header, feature cards, and shortcuts', async () => {
    await act(async () => {
      createRoot(container).render(<App />)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Flowlary')
    expect(container.textContent).toContain('Writing Correction')
    expect(container.textContent).toContain('Translation')
    expect(container.textContent).toContain('Keyboard Layout')
    expect(container.textContent).toContain('Quick actions')
    expect(container.textContent).toContain('Speed Box')
    expect(container.textContent).not.toContain('gsk_test')
  })
})
