import { describe, expect, it } from 'vitest'
import { CommandOrchestrator } from '../../../extension/src/core/router/CommandOrchestrator.ts'
import { CommandRouter } from '../../../extension/src/core/router/CommandRouter.ts'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { deepActiveElement } from '../../../extension/src/core/input/resolveTarget.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'

describe('command targeting', () => {
  it('follows open shadow activeElement', () => {
    document.body.innerHTML = ''
    const host = document.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })
    const ta = document.createElement('textarea')
    shadow.append(ta)
    document.body.append(host)
    ta.focus()
    expect(deepActiveElement()).toBe(ta)
  })

  it('runs a shortcut while composition was stuck on', async () => {
    document.body.innerHTML = ''
    stateManager.settings.enabled = true
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    ta.focus()
    const engine = new InputEngine()
    const session = engine.sessions.getOrCreate(ta)
    session.setComposing(true)
    const router = new CommandRouter()
    router.register('FIX_LAYOUT', async () => ({ ok: true, operation: 'FIX_LAYOUT' }))
    const orchestrator = new CommandOrchestrator({ engine, router })
    const result = await orchestrator.dispatch('FIX_LAYOUT', { target: ta })
    expect(session.isComposing()).toBe(false)
    expect(result.handlerExecuted).toBe(true)
  })
})
