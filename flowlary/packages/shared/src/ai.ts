import type { CommandResult } from './types.ts'

/** Correction AI contract — separate from translation and layout classification. */
export interface CorrectionAI {
  correct(text: string, context?: { fieldType?: string; previousText?: string }): Promise<CommandResult>
}

/** Translation AI contract — meaning translation only. */
export interface TranslationAI {
  translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    context?: { mode?: string },
  ): Promise<CommandResult>
}

/** Layout classifier AI contract — classification only; remap stays local. */
export interface LayoutClassifierAI {
  classify(
    token: string,
    sourceLayout: string,
    candidateLayouts: string[],
    context?: string,
  ): Promise<CommandResult>
}

/** Placeholder — no implementation in Phase 1. */
export const correctionAINotImplemented = (): CorrectionAI => ({
  async correct() {
    return { ok: false, operation: 'CORRECT', error: 'not_implemented' }
  },
})

export const translationAINotImplemented = (): TranslationAI => ({
  async translate() {
    return { ok: false, operation: 'TRANSLATE', error: 'not_implemented' }
  },
})

export const layoutClassifierAINotImplemented = (): LayoutClassifierAI => ({
  async classify() {
    return { ok: false, operation: 'FIX_LAYOUT', error: 'not_implemented' }
  },
})
