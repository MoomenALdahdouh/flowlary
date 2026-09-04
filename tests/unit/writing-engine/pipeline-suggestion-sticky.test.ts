import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { bumpUserGeneration } from '../../../extension/src/core/dom/generation.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  applyPipelineSuggestion,
  getActivePipelineSuggestion,
  invalidateStalePipelineSuggestion,
  presentPipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import { markOperationRunning } from '../../../extension/src/core/runtime/Operation.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function present(session: FieldSession, ta: HTMLTextAreaElement, source: string, suggestion: string) {
  const operation = session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature: 'layout',
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: ta.value,
  })
  markOperationRunning(operation)
  presentPipelineSuggestion({
    fieldId: session.field.id,
    element: ta,
    session,
    generation: session.getRevision(),
    range: { start: 0, end: source.length },
    sourceText: source,
    suggestion,
    action: 'layout_fix',
    textOrigin: 'layout_mismatch_suspected',
    operation,
  })
}

describe('pipeline suggestion identity', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetPipelineSuggestionsForTests()
    stateManager.settings = {
      enabled: true,
      pausedUntil: null,
      excludedDomains: [],
      version: 1,
      helpStyle: 'suggestions',
    }
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
  })

  it('hides the Typing card after a FieldRevision bump even if the source remains', () => {
    const ta = textarea('صاشف اثمح غخع')
    const session = new FieldSession(ta)
    present(session, ta, ta.value, 'what help you')
    session.bumpGeneration()
    invalidateStalePipelineSuggestion(session, ta.value)
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })

  it('does not retarget by substring when a prefix is inserted', () => {
    const source = 'صاشف اثمح'
    const ta = textarea(source)
    const session = new FieldSession(ta)
    present(session, ta, source, 'what help')
    ta.value = `  ${source}`
    invalidateStalePipelineSuggestion(session, ta.value)
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })

  it('hides when the snapshot no longer matches', () => {
    const ta = textarea('صاشف')
    const session = new FieldSession(ta)
    present(session, ta, 'صاشف', 'what')
    ta.value = 'hello'
    invalidateStalePipelineSuggestion(session, ta.value)
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })

  it('rejects apply after generation drift even if the source remains', () => {
    const ta = textarea('اثممخ ')
    const session = new FieldSession(ta)
    present(session, ta, 'اثممخ', 'hello')
    bumpUserGeneration(ta, session)
    expect(applyPipelineSuggestion(session.field.id)).not.toBe('applied')
    expect(ta.value).not.toMatch(/hello/)
  })

  it('hides when tashkeel changes the exact snapshot', () => {
    const source = 'صاشف'
    const ta = textarea(source)
    const session = new FieldSession(ta)
    present(session, ta, source, 'what')
    ta.value = `${source[0]}\u064e${source.slice(1)}`
    invalidateStalePipelineSuggestion(session, ta.value)
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })

  it('hides immediately on an empty composer when the snapshot mismatches', () => {
    const ta = textarea('صاشف')
    const session = new FieldSession(ta)
    present(session, ta, 'صاشف', 'what')
    ta.value = ''
    invalidateStalePipelineSuggestion(session, '')
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })
})
