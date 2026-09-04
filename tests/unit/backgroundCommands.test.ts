import { describe, expect, it, vi } from 'vitest'
import {
  commandFromChromeCommand,
  rememberCommandTarget,
  resetCommandTargetForTests,
  sendCommandToActiveTab,
} from '../../extension/src/background/commands.ts'

describe('background command routing', () => {
  it('maps chrome command names', () => {
    expect(commandFromChromeCommand('TRANSLATE')).toBe('TRANSLATE')
    expect(commandFromChromeCommand('FIX_LAYOUT')).toBe('FIX_LAYOUT')
    expect(commandFromChromeCommand('CORRECT')).toBe('CORRECT')
  })

  it('forwards RUN_COMMAND to the active tab and reads handler acknowledgment', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ handlerExecuted: true, status: 'success' })
    const api = {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42 }]),
        sendMessage,
      },
    } as unknown as Pick<typeof chrome, 'tabs'>
    const result = await sendCommandToActiveTab('TRANSLATE', api)
    expect(result).toEqual({ sent: true, handlerExecuted: true, reason: undefined })
    expect(sendMessage).toHaveBeenCalledWith(42, {
      type: 'RUN_COMMAND',
      operation: 'TRANSLATE',
    })
  })

  it('reports no_tab when the active tab is missing', async () => {
    const api = {
      tabs: {
        query: vi.fn().mockResolvedValue([]),
        sendMessage: vi.fn(),
      },
    } as unknown as Pick<typeof chrome, 'tabs'>
    const result = await sendCommandToActiveTab('FIX_LAYOUT', api)
    expect(result).toEqual({ sent: false, handlerExecuted: false, reason: 'no_tab' })
  })

  it('does not mark success when the handler did not execute', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ handlerExecuted: false, status: 'no_target' })
    const api = {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 7 }]),
        sendMessage,
      },
    } as unknown as Pick<typeof chrome, 'tabs'>
    const result = await sendCommandToActiveTab('FIX_LAYOUT', api)
    expect(result).toEqual({ sent: true, handlerExecuted: false, reason: 'no_target' })
  })

  it('sends RUN_COMMAND to the last focused frame first', async () => {
    rememberCommandTarget({ tab: { id: 9 }, frameId: 4 })
    const sendMessage = vi.fn().mockResolvedValue({ handlerExecuted: true, status: 'success' })
    const api = {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 9 }]),
        sendMessage,
      },
    } as unknown as Pick<typeof chrome, 'tabs'>
    const result = await sendCommandToActiveTab('CORRECT', api)
    expect(result.handlerExecuted).toBe(true)
    expect(sendMessage).toHaveBeenCalledWith(
      9,
      { type: 'RUN_COMMAND', operation: 'CORRECT' },
      { frameId: 4 },
    )
    resetCommandTargetForTests()
  })
})
