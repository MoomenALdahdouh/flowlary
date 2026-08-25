import type { Command, CommandResult } from './types.ts'

export interface CorrectionFeature {
  execute(command: Command): Promise<CommandResult>
}

export interface TranslationFeature {
  execute(command: Command): Promise<CommandResult>
}

export interface LayoutFeature {
  execute(command: Command): Promise<CommandResult>
}

/** Phase 1 stub — returns controlled not-implemented result. */
export function createStubCorrectionFeature(): CorrectionFeature {
  return {
    async execute(command) {
      return { ok: false, operation: command.type, error: 'feature_not_ported' }
    },
  }
}

export function createStubTranslationFeature(): TranslationFeature {
  return {
    async execute(command) {
      return { ok: false, operation: command.type, error: 'feature_not_ported' }
    },
  }
}

export function createStubLayoutFeature(): LayoutFeature {
  return {
    async execute(command) {
      return { ok: false, operation: command.type, error: 'feature_not_ported' }
    },
  }
}
