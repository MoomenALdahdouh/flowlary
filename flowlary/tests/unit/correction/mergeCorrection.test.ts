import { describe, expect, it } from 'vitest'
import {
  canMergeCorrection,
  mergeCorrectionIntoField,
} from '../../../extension/src/features/correction/mergeCorrection.ts'

describe('mergeCorrectionIntoField', () => {
  it('replaces an exact match', () => {
    expect(mergeCorrectionIntoField('hello hwo', 'hello hwo', 'hello how')).toBe('hello how')
  })

  it('keeps text typed after the corrected snapshot', () => {
    expect(mergeCorrectionIntoField('hello hwo are yuo', 'hello hwo', 'hello how')).toBe(
      'hello how are yuo',
    )
  })

  it('returns null when the user edited inside the snapshot', () => {
    expect(mergeCorrectionIntoField('hello X hwo', 'hello hwo', 'hello how')).toBeNull()
    expect(canMergeCorrection('hello X hwo', 'hello hwo')).toBe(false)
  })
})
