/** Adapted from Lingo/Layfix src/dom/replace.test.ts */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { adjustCaret } from '../../extension/src/core/dom/caret.ts'
import {
  readCaret,
  readText,
  writeReplacement,
} from '../../extension/src/core/dom/editor.ts'
import { setNativeValue, captureReplacementSnapshot, commitReplacement } from '../../extension/src/core/dom/write.ts'

function valueField(value: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  document.body.append(input)
  setNativeValue(input, value)
  input.setSelectionRange(value.length, value.length)
  return input
}

function areaField(value: string): HTMLTextAreaElement {
  const area = document.createElement('textarea')
  document.body.append(area)
  setNativeValue(area, value)
  area.setSelectionRange(value.length, value.length)
  return area
}

describe('characterization: value replacement (Lingo/Layfix)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('restores a space that setRangeText dropped next to Arabic', () => {
    const area = areaField('مرحبا اثممخ حمثشسث')
    const start = 'مرحبا '.length
    vi.spyOn(area, 'setRangeText').mockImplementation(() => {
      setNativeValue(area, 'مرحبا helloحمثشسث')
    })
    const result = writeReplacement(area, start, start + 'اثممخ'.length, 'hello', { origin: 'FIX_LAYOUT' })
    expect(result.verdict).toBe('written')
    expect(area.value).toBe('مرحبا hello حمثشسث')
  })

  it('places the caret after the space that finished the remapped word', () => {
    const area = areaField('اثممخ ')
    area.setSelectionRange(5, 5)
    const result = writeReplacement(area, 0, 5, 'hello', { origin: 'FIX_LAYOUT' })
    expect(result.verdict).toBe('written')
    expect(area.value).toBe('hello ')
    expect(area.selectionStart).toBe(6)
  })

  it('prefers setRangeText so the browser can undo the write', () => {
    const input = valueField('اثممخ ')
    const rangeSpy = vi.spyOn(input, 'setRangeText')
    const result = writeReplacement(input, 0, 5, 'hello', { origin: 'FIX_LAYOUT' })
    expect(result.verdict).toBe('written')
    expect(rangeSpy).toHaveBeenCalled()
    expect(input.value).toBe('hello ')
  })

  it('uses insertReplacementText and preserves caret', () => {
    const input = valueField('مرحبا ')
    const events: string[] = []
    input.addEventListener('input', (event) => {
      events.push((event as InputEvent).inputType)
    })
    const result = writeReplacement(input, 0, 5, 'Hello', { origin: 'FIX_LAYOUT' })
    expect(result.verdict).toBe('written')
    expect(input.value).toBe('Hello ')
    expect(events).toEqual(['insertReplacementText'])
    expect(input.selectionStart).toBe(6)
  })

  it('replaces only the selected range in a longer field', () => {
    const input = valueField('I want شراء هذا المنتج today.')
    const start = 'I want '.length
    const end = start + 'شراء هذا المنتج'.length
    const result = writeReplacement(input, start, end, 'buy this product', {
      origin: 'TRANSLATE',
      placeCaretAfter: true,
    })
    expect(result.verdict).toBe('written')
    expect(input.value).toBe('I want buy this product today.')
    expect(input.selectionStart).toBe('I want buy this product'.length)
  })

  it('discards when original slice no longer matches', () => {
    const input = valueField('مرحبا')
    const snapshot = captureReplacementSnapshot(input, 'مرحبا', 0, 5, 5)
    setNativeValue(input, 'changed')
    expect(commitReplacement(snapshot, 'Hello')).toBe('discarded')
    expect(input.value).toBe('changed')
  })

  it('works on multiline textareas', () => {
    const area = areaField('hola\nmundo')
    const result = writeReplacement(area, 0, 10, 'hello\nworld', { origin: 'CORRECT' })
    expect(result.verdict).toBe('written')
    expect(area.value).toBe('hello\nworld')
  })
})

describe('characterization: contenteditable replacement', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('places the caret after the completing space on contenteditable', () => {
    const edit = document.createElement('div')
    edit.contentEditable = 'true'
    edit.textContent = 'اثممخ '
    document.body.append(edit)
    const result = writeReplacement(edit, 0, 5, 'hello', { origin: 'FIX_LAYOUT' })
    expect(result.verdict).toBe('written')
    expect(readText(edit)).toBe('hello ')
    expect(readCaret(edit)).toBe(6)
  })

  it('second mapped word does not glue onto the first', () => {
    const edit = document.createElement('div')
    edit.contentEditable = 'true'
    edit.textContent = 'hello حمثشسث '
    document.body.append(edit)
    const start = 'hello '.length
    const result = writeReplacement(edit, start, start + 'حمثشسث'.length, 'please', { origin: 'FIX_LAYOUT' })
    expect(result.verdict).toBe('written')
    expect(readText(edit)).toBe('hello please ')
  })
})

describe('characterization: caret math', () => {
  it('keeps the caret after shorter or longer replacement', () => {
    expect(adjustCaret(8, 0, 2, 2)).toBe(8)
    expect(adjustCaret(8, 0, 5, 5)).toBe(8)
    expect(adjustCaret(3, 0, 5, 10)).toBe(10)
  })
})
