import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { STORAGE_KEYS } from '@flowlary/shared'
import { DashboardApp } from '../../extension/src/dashboard/App.tsx'
import { ProgressPanel } from '../../extension/src/dashboard/panels/ProgressPanel.tsx'
import { handleMessage } from '../../extension/src/background/index.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { retireByokIfNeeded } from '../../extension/src/storage/retireByok.ts'
import { createCorrectionFeature } from '../../extension/src/features/correction/CorrectionFeature.ts'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { flowlaryStorage } from '../../extension/src/storage/index.ts'
import { getCorrectionSettings } from '../../extension/src/storage/facade.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import type { ExtensionStatus } from '../../extension/src/messaging/types.ts'
import { BRAND } from '@flowlary/shared'

vi.mock('../../extension/src/popup/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../extension/src/popup/api.ts')>()
  return {
    ...actual,
    fetchHistory: vi.fn().mockRejectedValue(new Error('Progress must not fetch activity history')),
  }
})

function mockChrome() {
  const handler = vi.fn(async (message: { type: string; patch?: Record<string, unknown> }) => {
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
    commands: { onCommand: { addListener: vi.fn() } },
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
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
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
  throw new Error(`Timed out waiting for "${text}"`)
}

describe('Phase 22A.1 — progress / activity reconciliation', () => {
  let container: HTMLDivElement
  let root: Root | null = null

  beforeEach(() => {
    Object.assign(stateManager.correction, {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
    })
    stateManager.settings.enabled = true
    window.location.hash = ''
    mockChrome()
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

  async function render(node: JSX.Element) {
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

  it('Progress panel does not fetch activity history', async () => {
    const { fetchHistory } = await import('../../extension/src/popup/api.ts')
    await render(<ProgressPanel onOpenActivity={() => undefined} />)
    expect(container.textContent).toContain('Your progress is building')
    expect(container.textContent).not.toContain('Total actions')
    expect(fetchHistory).not.toHaveBeenCalled()
  })

  it('Progress shows honest empty state without activity metrics', async () => {
    await render(<DashboardApp />)
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
    expect(container.textContent).not.toMatch(/errors per 100|mistakes logged|trend chart/i)
  })

  it('View activity navigates to the activity list, not settings root', async () => {
    await render(<DashboardApp />)
    await waitUntil(container, 'Writing settings')
    const progressBtn = Array.from(container.querySelectorAll('.wd-nav-groups button')).find(
      (btn) => btn.textContent === 'Progress',
    )
    await act(async () => {
      progressBtn!.click()
    })
    await waitUntil(container, 'View activity log')
    const viewActivity = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('View activity log'),
    )
    expect(viewActivity).toBeTruthy()
    await act(async () => {
      viewActivity!.click()
    })
    expect(window.location.hash).toBe('#activity')
    expect(container.textContent).toContain('Could not load activity.')
    expect(container.textContent).not.toContain('Writing, languages, and data.')
  })

  it('uses Overview, Writing Lab, and account navigation', async () => {
    await render(<DashboardApp />)
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

  it('Practice route shows honest empty state without activity data', async () => {
    await render(<DashboardApp />)
    await waitUntil(container, 'Writing settings')
    const practiceBtn = Array.from(container.querySelectorAll('.wd-nav-groups button')).find(
      (btn) => btn.textContent === 'Practice',
    )
    await act(async () => {
      practiceBtn!.click()
    })
    await waitUntil(container, 'Keep writing first')
    expect(container.textContent).toContain('Keep writing first')
    expect(container.textContent).not.toContain('Total actions')
  })

  it('Data controls live under Settings and Activity remains a direct route', async () => {
    await render(<DashboardApp />)
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
    expect(container.textContent).toContain('Clear activity')
    expect(container.textContent).toContain('Clear learning data')
  })

  async function executeCorrectionOnField(options: {
    consentAccepted: boolean
    field: 'missing' | 'textarea' | 'password'
    text?: string
  }) {
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = options.consentAccepted
    const engine = new InputEngine()
    engine.start()
    const text = options.text ?? 'hello world test sentence'
    let fieldId = 'missing-field'
    let element: HTMLTextAreaElement | HTMLInputElement | null = null
    if (options.field !== 'missing') {
      element =
        options.field === 'password' ? document.createElement('input') : document.createElement('textarea')
      if (element instanceof HTMLInputElement) element.type = 'password'
      element.value = text
      document.body.append(element)
      fieldId = engine.sessions.getOrCreate(element).field.id
    }
    const feature = createCorrectionFeature({ engine })
    try {
      return await feature.execute({
        type: 'CORRECT',
        field: { id: fieldId, tag: options.field === 'textarea' ? 'textarea' : 'input' },
        text,
      })
    } finally {
      engine.stop()
      element?.remove()
    }
  }

  it('CorrectionFeature returns no_target when the field cannot be resolved', async () => {
    const result = await executeCorrectionOnField({
      consentAccepted: false,
      field: 'missing',
    })
    expect(result.error).toBe('no_target')
    expect(result.error).not.toBe('missing_api_key')
  })

  it('CorrectionFeature no longer returns missing_api_key', async () => {
    const result = await executeCorrectionOnField({
      consentAccepted: false,
      field: 'textarea',
    })
    expect(result.error).toBe('consent_required')
    expect(result.error).not.toBe('missing_api_key')
    expect(result.error).not.toBe('no_target')
  })

  it('CorrectionFeature blocks a protected password field before consent', async () => {
    const result = await executeCorrectionOnField({
      consentAccepted: false,
      field: 'password',
    })
    expect(result.error).toBe('safety_blocked')
    expect(result.error).not.toBe('consent_required')
  })

  it('CorrectionFeature with consent on an eligible field does not return consent_required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      })),
    )
    const result = await executeCorrectionOnField({
      consentAccepted: true,
      field: 'textarea',
    })
    expect(result.error).not.toBe('consent_required')
    expect(result.error).not.toBe('no_target')
    expect(result.error).not.toBe('missing_api_key')
    vi.unstubAllGlobals()
  })

  it('StateManager correction settings omit BYOK fields', () => {
    expect(stateManager.correction).not.toHaveProperty('aiProvider')
    expect(stateManager.correction).not.toHaveProperty('groqApiKey')
  })

  it('retireByokIfNeeded clears legacy groq key without exposing it', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    mockStore.local[STORAGE_KEYS.correctionGroqKey] = 'gsk_secret_never_log'
    mockStore.local[STORAGE_KEYS.correction] = {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
      aiProvider: 'byok',
      groqApiKey: 'gsk_secret_never_log',
    }
    await retireByokIfNeeded(flowlaryStorage)
    expect(mockStore.local[STORAGE_KEYS.correctionGroqKey]).toBeUndefined()
    const correction = await getCorrectionSettings(flowlaryStorage)
    expect(correction).not.toHaveProperty('aiProvider')
    expect(correction).not.toHaveProperty('groqApiKey')
  })

  it('manifest has no client-side Groq host permission', () => {
    const devManifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../extension/manifest.json'), 'utf8'),
    ) as { host_permissions: string[] }
    expect(devManifest.host_permissions).not.toContain('https://api.groq.com/*')
  })
})
