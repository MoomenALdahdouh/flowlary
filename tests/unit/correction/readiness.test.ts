import { describe, expect, it } from 'vitest'
import { DEFAULT_CORRECTION } from '../../../extension/src/core/state/StateManager.ts'
import {
  isCorrectionAiReady,
  usesManagedCorrection,
} from '../../../extension/src/features/correction/readiness.ts'

describe('correction AI readiness', () => {
  it('requires consent only for Flowlary AI', () => {
    const settings = {
      ...DEFAULT_CORRECTION,
      consentAccepted: true,
    }
    expect(usesManagedCorrection(settings)).toBe(true)
    expect(isCorrectionAiReady(settings)).toBe(true)
  })

  it('is not ready without consent', () => {
    const settings = {
      ...DEFAULT_CORRECTION,
      consentAccepted: false,
    }
    expect(isCorrectionAiReady(settings)).toBe(false)
  })
})
