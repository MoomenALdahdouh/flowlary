import { describe, expect, it, vi } from 'vitest'
import {
  commandFromChromeCommand,
  sendCommandToActiveTab,
} from '../../extension/src/background/commands.ts'

describe('background command routing', () => {
  it('maps chrome command names', () => {
    expect(commandFromChromeCommand('TRANSLATE')).toBe('TRANSLATE')
    expect(commandFromChromeCommand('FIX_LAYOUT')).toBe('FIX_LAYOUT')
    expect(commandFromChromeCommand('SPEED_BOX')).toBe('SPEED_BOX')
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
})
