import { canTranslateRequest, normalizeTranslationText } from './eligibility.ts'
import type { TranslationOutcome, TranslationRequest } from './types.ts'
import type { PhysicalHttpContext } from '../../core/runtime/physicalHttp.ts'

export type TranslationProvider = {
  translate(
    request: TranslationRequest,
    signal?: AbortSignal,
    physical?: PhysicalHttpContext,
  ): Promise<TranslationOutcome>
}

export class TranslationEngine {
  constructor(private provider: TranslationProvider) {}

  async translate(
    request: TranslationRequest,
    signal?: AbortSignal,
    physical?: PhysicalHttpContext,
  ): Promise<TranslationOutcome> {
    const blocked = canTranslateRequest(request)
    if (blocked) return blocked
    return this.provider.translate(
      { ...request, text: normalizeTranslationText(request.text) },
      signal,
      physical,
    )
  }
}

export { canTranslateRequest }
