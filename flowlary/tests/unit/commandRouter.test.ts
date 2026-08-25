import { describe, expect, it, vi } from 'vitest'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import type { Command } from '@flowlary/shared'

const baseCommand = (type: Command['type']): Command => ({
  type,
  field: { id: 'field-1', tag: 'TEXTAREA' },
  text: 'sample',
})

describe('CommandRouter', () => {
  it('dispatches CORRECT to registered handler', async () => {
    const router = new CommandRouter()
    router.register('CORRECT', async () => ({ ok: true, operation: 'CORRECT', data: 'ok' }))
    const result = await router.dispatch(baseCommand('CORRECT'))
    expect(result.ok).toBe(true)
    expect(result.operation).toBe('CORRECT')
  })

  it('dispatches TRANSLATE to registered handler', async () => {
    const router = new CommandRouter()
    router.register('TRANSLATE', async () => ({ ok: true, operation: 'TRANSLATE' }))
    const result = await router.dispatch(baseCommand('TRANSLATE'))
    expect(result.operation).toBe('TRANSLATE')
  })

  it('dispatches FIX_LAYOUT to registered handler', async () => {
    const router = new CommandRouter()
    router.register('FIX_LAYOUT', async () => ({ ok: true, operation: 'FIX_LAYOUT' }))
    const result = await router.dispatch(baseCommand('FIX_LAYOUT'))
    expect(result.operation).toBe('FIX_LAYOUT')
  })

  it('does not cross-dispatch between handlers', async () => {
    const router = new CommandRouter()
    router.register('CORRECT', async () => ({ ok: true, operation: 'CORRECT', data: 'correct-only' }))
    router.register('TRANSLATE', async () => ({ ok: true, operation: 'TRANSLATE', data: 'translate-only' }))

    const correct = await router.dispatch(baseCommand('CORRECT'))
    const translate = await router.dispatch(baseCommand('TRANSLATE'))

    expect(correct.data).toBe('correct-only')
    expect(translate.data).toBe('translate-only')
    expect(correct.operation).not.toBe('TRANSLATE')
  })

  it('returns controlled error when handler missing', async () => {
    const router = new CommandRouter()
    const result = await router.dispatch(baseCommand('CORRECT'))
    expect(result.ok).toBe(false)
    expect(result.error).toBe('handler_not_registered')
  })

  it('does not auto-chain PIPELINE to other handlers', async () => {
    const router = new CommandRouter()
    const correct = vi.fn(async () => ({ ok: true, operation: 'CORRECT' as const }))
    router.register('CORRECT', correct)
    const result = await router.dispatch(baseCommand('PIPELINE'))
    expect(result.error).toBe('pipeline_not_implemented')
    expect(correct).not.toHaveBeenCalled()
  })
})
