import type { TranslationFeature } from '@flowlary/shared'
import { createStubTranslationFeature } from '@flowlary/shared'

export type { TranslationFeature }
export const createTranslationFeature = (): TranslationFeature => createStubTranslationFeature()
