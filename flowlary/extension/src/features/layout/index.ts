import type { LayoutFeature } from '@flowlary/shared'
import { createStubLayoutFeature } from '@flowlary/shared'

export type { LayoutFeature }
export const createLayoutFeature = (): LayoutFeature => createStubLayoutFeature()
