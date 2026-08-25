import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLayoutFeature } from '../../../extension/src/features/layout/LayoutFeature.ts'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { mapLayout } from '../../../extension/src/features/layout/layouts/registry.ts'

describe('LayoutFeature', () => {
  let engine: InputEngine
  let layout: ReturnType<typeof createLayoutFeature>

  beforeEach(() => {
    document.body.innerHTML = ''
    stateManager.settings.enabled = true
    stateManager.layout.directShortcutEnabled = true
    stateManager.layout.sourceLayout = 'en-US-qwerty'
    stateManager.layout.targetLayouts = ['ar-101']
    engine = new InputEngine()
    layout = createLayoutFeature({ engine })
    layout.start()
  })

  afterEach(() => {
    layout.stop()
    engine.stop()
  })

  it('FIX_LAYOUT corrects mistyped Arabic token locally', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    ta.focus()
    const session = engine.sessions.getOrCreate(ta)
    const acquire = session.tryAcquireWrite('FIX_LAYOUT')
    expect(acquire.ok).toBe(true)
    if (!acquire.ok) return

    const result = await layout.execute({
      type: 'FIX_LAYOUT',
      field: session.field,
      text: ta.value,
      generation: acquire.generation,
      requestId: acquire.requestId,
    })

    expect(result.ok).toBe(true)
    expect(ta.value).toBe('مرحبا')
    session.releaseWrite('FIX_LAYOUT', acquire.requestId)
  })

  it('respects personal exceptions', async () => {
    layout.setProfileState({
      layoutProfile: {
        sourceLayout: 'en-US-qwerty',
        enabledLayouts: ['en-US-qwerty', 'ar-101'],
      },
      personalExceptions: ['hsjo]lj'],
      events: [],
    })

    const ta = document.createElement('textarea')
    ta.value = 'hsjo]lj'
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const acquire = session.tryAcquireWrite('FIX_LAYOUT')
    if (!acquire.ok) return

    const result = await layout.execute({
      type: 'FIX_LAYOUT',
      field: session.field,
      text: ta.value,
      generation: acquire.generation,
      requestId: acquire.requestId,
    })

    expect(result.ok).toBe(false)
    expect(ta.value).toBe('hsjo]lj')
    session.releaseWrite('FIX_LAYOUT', acquire.requestId)
  })

  it('maps layout deterministically without remote classifier', () => {
    expect(mapLayout('lvpfh', 'en-US-qwerty', 'ar-101')).toBe('مرحبا')
  })
})
