import { describe, expect, it } from 'vitest'
import {
  createFieldSnapshot,
  readFieldText,
  readSelectionRange,
  commitReplacement,
  captureReplacementSnapshot,
  bumpGeneration,
  getGenerationMap,
} from '../../extension/src/core/dom/index.ts'

describe('DOM abstraction', () => {
  it('reads and writes textarea with caret preservation', () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello world'
    document.body.append(ta)
    ta.setSelectionRange(6, 6)

    const snap = createFieldSnapshot(ta, 0)
    expect(readFieldText(ta)).toBe('hello world')
    expect(snap.caret).toBe(6)

    const replacement = captureReplacementSnapshot(ta, 'world', 6, 11, 6)
    const verdict = commitReplacement(replacement, 'universe')
    expect(verdict).toBe('written')
    expect(readFieldText(ta)).toBe('hello universe')
  })

  it('reads text input selection', () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.value = 'abc'
    input.setSelectionRange(1, 2)
    document.body.append(input)
    expect(readSelectionRange(input)).toEqual({ start: 1, end: 2 })
  })

  it('verifies stale generation before write', () => {
    const ta = document.createElement('textarea')
    ta.value = 'token'
    document.body.append(ta)
    bumpGeneration(ta)
    const replacement = captureReplacementSnapshot(ta, 'token', 0, 5, 5)
    bumpGeneration(ta)
    ta.value = 'changed'
    const verdict = commitReplacement(replacement, 'fixed')
    expect(verdict).toBe('discarded')
    void getGenerationMap()
  })

  it('supports contenteditable read/write', () => {
    const div = document.createElement('div')
    div.contentEditable = 'true'
    div.textContent = 'edit me'
    document.body.append(div)

    expect(readFieldText(div)).toBe('edit me')
    const replacement = captureReplacementSnapshot(div, 'edit', 0, 4, 4)
    const verdict = commitReplacement(replacement, 'fix')
    expect(verdict).toBe('written')
    expect(readFieldText(div)).toBe('fix me')
  })
})
