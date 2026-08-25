import type { CorrectionFeature } from '@flowlary/shared'
import { createStubCorrectionFeature } from '@flowlary/shared'

export type { CorrectionFeature }
export const createCorrectionFeature = (): CorrectionFeature => createStubCorrectionFeature()
