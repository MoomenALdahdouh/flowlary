import { canTranslateRequest, normalizeTranslationText } from './eligibility.ts'
import type { TranslationOutcome, TranslationRequest } from './types.ts'

export type TranslationProvider = {
  translate(request: TranslationRequest, signal?: AbortSignal): Promise<TranslationOutcome>
}

export class TranslationEngine {
  constructor(private provider: TranslationProvider) {}

  async translate(request: TranslationRequest, signal?: AbortSignal): Promise<TranslationOutcome> {
    const blocked = canTranslateRequest(request)
    if (blocked) return blocked
    return this.provider.translate(
      { ...request, text: normalizeTranslationText(request.text) },
      signal,
    )
  }
}

export { canTranslateRequest }
