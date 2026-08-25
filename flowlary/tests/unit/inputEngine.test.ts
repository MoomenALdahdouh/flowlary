import { describe, expect, it, beforeEach } from 'vitest'
import { InputEngine, detectEditable } from '../../extension/src/core/input/InputEngine.ts'
import { EventBus } from '../../extension/src/core/events/EventBus.ts'

describe('InputEngine', () => {
  let engine: InputEngine
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
    engine = new InputEngine({ eventBus: bus })
    document.body.innerHTML = ''
  })

  it('detects textarea', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    expect(detectEditable(ta)).toBe(true)
  })

  it('detects text input', () => {
    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    expect(detectEditable(input)).toBe(true)
  })

  it('detects contenteditable', () => {
    const div = document.createElement('div')
    div.contentEditable = 'true'
    document.body.append(div)
    expect(detectEditable(div)).toBe(true)
  })

  it('creates session on focusin and bumps generation on input', () => {
    const events: string[] = []
    bus.subscribe((event) => events.push(event.type))

    const ta = document.createElement('textarea')
    document.body.append(ta)
    engine.start()

    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))

    expect(events).toContain('focus-in')
    expect(events).toContain('input')
    const session = engine.getActiveSession()
    expect(session?.getGeneration()).toBeGreaterThan(0)
  })
})
