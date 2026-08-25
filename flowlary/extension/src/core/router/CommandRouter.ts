import type { Command, CommandResult, OperationType } from '@flowlary/shared'
import type { CorrectionFeature, LayoutFeature, TranslationFeature } from '@flowlary/shared'

export type OperationHandler = (command: Command) => Promise<CommandResult>

export class CommandRouter {
  private handlers = new Map<OperationType, OperationHandler>()

  register(operation: OperationType, handler: OperationHandler): void {
    this.handlers.set(operation, handler)
  }

  registerCorrection(feature: CorrectionFeature): void {
    this.register('CORRECT', (command) => feature.execute(command))
  }

  registerTranslation(feature: TranslationFeature): void {
    this.register('TRANSLATE', (command) => feature.execute(command))
  }

  registerLayout(feature: LayoutFeature): void {
    this.register('FIX_LAYOUT', (command) => feature.execute(command))
  }

  has(operation: OperationType): boolean {
    return this.handlers.has(operation)
  }

  async dispatch(command: Command): Promise<CommandResult> {
    if (command.type === 'PIPELINE') {
      return {
        ok: false,
        operation: 'PIPELINE',
        error: 'pipeline_not_implemented',
      }
    }

    const handler = this.handlers.get(command.type)
    if (!handler) {
      return {
        ok: false,
        operation: command.type,
        error: 'handler_not_registered',
      }
    }

    return handler(command)
  }
}
