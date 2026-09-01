import { describe, expect, it } from 'vitest'
import {
  changePresentInWritingSample,
  isLearningEventCategory,
  isValidLearningChange,
  normalizeLearningText,
} from '@flowlary/shared'

describe('learning event normalization', () => {
  it('normalizes whitespace and casing', () => {
    expect(normalizeLearningText('  Recieved  ')).toBe('recieved')
    expect(normalizeLearningText('Recieved')).toBe('recieved')
  })

  it('keeps their and there distinct', () => {
    expect(normalizeLearningText('their')).not.toBe(normalizeLearningText('there'))
  })

  it('rejects unchanged and empty changes', () => {
    expect(isValidLearningChange('hello', 'hello')).toBe(false)
    expect(isValidLearningChange('  ', 'there')).toBe(false)
    expect(isValidLearningChange('recieved', 'received')).toBe(true)
  })

  it('requires original text in writing sample', () => {
    expect(changePresentInWritingSample('I recieved your email.', 'recieved')).toBe(true)
    expect(changePresentInWritingSample('I received your email.', 'recieved')).toBe(false)
  })

  it('accepts layout as a learning category', () => {
    expect(isLearningEventCategory('layout')).toBe(true)
    expect(isLearningEventCategory('spelling')).toBe(true)
    expect(isLearningEventCategory('typo')).toBe(false)
  })
})
