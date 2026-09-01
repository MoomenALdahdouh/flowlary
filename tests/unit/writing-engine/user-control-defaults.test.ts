import { afterEach, describe, expect, it } from 'vitest'
import { allowsAutomaticFieldWrite } from '../../../extension/src/core/safety/autoWrite.ts'
import { evaluateFieldSafety } from '../../../extension/src/core/safety/index.ts'
import { isExcludedHost, withHostExclusion } from '../../../extension/src/core/safety/domains.ts'
import { DEFAULT_SETTINGS, stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { resolveWritingPolicy, resolveProductControls } from '../../../extension/src/core/policy/writingPolicy.ts'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { buildFieldContext, shouldConsultAdvisor } from '../../../extension/src/core/engine/index.ts'

afterEach(() => {
  document.body.replaceChildren()
  stateManager.settings = { ...DEFAULT_SETTINGS }
})

describe('user-controlled defaults', () => {
  it('is on by default with no developer site list', () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(true)
    expect(DEFAULT_SETTINGS.excludedDomains).toEqual([])
    expect(DEFAULT_SETTINGS.aiAdvisorEnabled).toBe(true)
    expect(resolveWritingPolicy().aiAdvisorEnabled).toBe(true)
  })

  it('treats site exclusion as a user preference', () => {
    const paused = withHostExclusion([], 'example.com', true)
    expect(isExcludedHost('example.com', paused)).toBe(true)
    expect(isExcludedHost('www.example.com', paused)).toBe(true)
    expect(isExcludedHost('other.com', paused)).toBe(false)

    const resumed = withHostExclusion(paused, 'www.example.com', false)
    expect(isExcludedHost('example.com', resumed)).toBe(false)
    expect(isExcludedHost('www.example.com', resumed)).toBe(false)

    const ta = document.createElement('textarea')
    document.body.append(ta)
    expect(evaluateFieldSafety(ta, { hostname: 'news.example', excludedDomains: [] }).allowed).toBe(true)
    expect(
      evaluateFieldSafety(ta, { hostname: 'example.com', excludedDomains: paused }).allowed,
    ).toBe(false)
  })

  it('allows ordinary contenteditable auto-write and blocks code editors', () => {
    const ce = document.createElement('div')
    ce.contentEditable = 'true'
    document.body.append(ce)
    expect(allowsAutomaticFieldWrite(ce)).toBe(true)

    const monaco = document.createElement('div')
    monaco.contentEditable = 'true'
    monaco.className = 'monaco-editor'
    document.body.append(monaco)
    expect(allowsAutomaticFieldWrite(monaco)).toBe(false)
    expect(evaluateFieldSafety(monaco).reason).toBe('code-region')
  })

  it('can consult the advisor on contenteditable when the user leaves AI on', () => {
    const ce = document.createElement('div')
    ce.contentEditable = 'true'
    ce.textContent = 'hello there friend'
    document.body.append(ce)
    const session = new FieldSession(ce)
    const context = buildFieldContext({
      element: ce,
      session,
      cycleId: 'ce-ai',
      composing: false,
      textLength: 18,
    })
    expect(context.editorTier).toBe(2)
    expect(context.aiAdvisorEnabled).toBe(true)
    expect(shouldConsultAdvisor([], { ...context, editorTier: 4 })).toBe(false)
  })

  it('exposes one product-control snapshot', () => {
    stateManager.personalExceptions = ['deploy']
    const controls = resolveProductControls()
    expect(controls.assistantEnabled).toBe(true)
    expect(controls.personalExceptions).toContain('deploy')
    expect(controls.excludedDomains).toEqual(stateManager.settings.excludedDomains)
    stateManager.personalExceptions = []
  })
})
