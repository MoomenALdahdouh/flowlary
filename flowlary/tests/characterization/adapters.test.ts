/** Adapted from EWA extension/src/adapters/index.test.ts */
import { describe, expect, it, beforeEach } from 'vitest'
import {
  createEditableAdapter,
  findEditableFromTarget,
} from '../../extension/src/core/dom/adapter.ts'

describe('characterization: EditableAdapter (EWA)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('creates textarea adapter', () => {
    const el = document.createElement('textarea')
    document.body.append(el)
    const adapter = createEditableAdapter(el)
    expect(adapter).not.toBeNull()
    expect(adapter!.kind).toBe('textarea')
  })

  it('creates text input adapter and ignores password', () => {
    const text = document.createElement('input')
    text.type = 'text'
    const password = document.createElement('input')
    password.type = 'password'
    document.body.append(text, password)
    expect(createEditableAdapter(text)?.kind).toBe('text')
    expect(createEditableAdapter(password)).toBeNull()
  })

  it('creates contenteditable adapter from nested target', () => {
    const el = document.createElement('div')
    el.setAttribute('contenteditable', 'true')
    el.innerHTML = '<span>hello</span>'
    document.body.append(el)
    const span = el.querySelector('span')!
    const adapter = findEditableFromTarget(span)
    expect(adapter).not.toBeNull()
    expect(adapter!.kind).toBe('contenteditable')
    expect(adapter!.getText()).toBe('hello')
  })

  it('ignores monaco code editor regions', () => {
    const el = document.createElement('div')
    el.className = 'monaco-editor'
    el.contentEditable = 'true'
    document.body.append(el)
    expect(createEditableAdapter(el)).toBeNull()
  })
})
