import type { PhysicalHttpContext } from '../../core/runtime/physicalHttp.ts'
import { runWithPhysicalHttp } from '../../core/runtime/physicalHttp.ts'
import type { LanguageCode, TranslationMode, TranslationOutcome } from './types.ts'
import type { TranslationRequestContext } from '@flowlary/shared'

export type TranslateTextMessage = {
  type: 'TRANSLATE_TEXT'
  text: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  mode: TranslationMode
  context?: TranslationRequestContext
  requestId?: string
}

export type TranslateTextResponse =
  | {
      type: 'TRANSLATE_TEXT_RESULT'
      ok: true
      translation: string
      sourceLanguage: LanguageCode
      targetLanguage: LanguageCode
    }
  | {
      type: 'TRANSLATE_TEXT_ERROR'
      ok: false
      code: string
    }

type ExtensionErrorResponse = {
  ok: false
  error: string
}

function isTranslateResult(response: unknown): response is TranslateTextResponse {
  if (!response || typeof response !== 'object') return false
  const type = (response as { type?: unknown }).type
  return type === 'TRANSLATE_TEXT_RESULT' || type === 'TRANSLATE_TEXT_ERROR'
}

function mapBackgroundErrorCode(code: string): TranslationOutcome extends { ok: false; code: infer C } ? C : 'invalid-response' {
  if (code === 'network' || code === 'upstream') {
    return 'translation_unavailable' as TranslationOutcome extends { ok: false; code: infer C } ? C : 'invalid-response'
  }
  return code as TranslationOutcome extends { ok: false; code: infer C } ? C : 'invalid-response'
}

let lastTranslationNetworkSignal: AbortSignal | null = null

export function getLastTranslationNetworkSignalForTests(): AbortSignal | null {
  return lastTranslationNetworkSignal
}

export async function cancelTranslationRemote(requestId: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
  try {
    await chrome.runtime.sendMessage({ type: 'CANCEL_TRANSLATE', requestId })
  } catch {
    /* ignore */
  }
}

export async function requestTranslationRemote(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  signal?: AbortSignal,
  mode: TranslationMode = 'shortcut',
  context?: TranslationRequestContext,
  physical?: PhysicalHttpContext,
): Promise<TranslationOutcome> {
  const send = () => requestTranslationRemoteUncapped(
    text,
    sourceLanguage,
    targetLanguage,
    signal,
    mode,
    context,
  )
  if (!physical) return send()
  const gated = await runWithPhysicalHttp(physical, send)
  if (!gated.dispatched) return { ok: false, code: 'aborted' }
  return gated.value
}

async function requestTranslationRemoteUncapped(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  signal?: AbortSignal,
  mode: TranslationMode = 'shortcut',
  context?: TranslationRequestContext,
): Promise<TranslationOutcome> {
  lastTranslationNetworkSignal = signal ?? null
  if (signal?.aborted) return { ok: false, code: 'aborted' }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return { ok: false, code: 'translation_unavailable' }
  }

  const requestId = `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const onAbort = () => {
    void cancelTranslationRemote(requestId)
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'TRANSLATE_TEXT',
      text,
      sourceLanguage,
      targetLanguage,
      mode,
      context,
      requestId,
    } satisfies TranslateTextMessage)) as TranslateTextResponse | ExtensionErrorResponse | undefined

    if (signal?.aborted) return { ok: false, code: 'aborted' }
    if (!response) return { ok: false, code: 'translation_unavailable' }

    if (isTranslateResult(response)) {
      if (response.type === 'TRANSLATE_TEXT_RESULT' && response.ok) {
        const translation = response.translation?.trim()
        if (!translation) return { ok: false, code: 'invalid-response' }
        return { ok: true, translation }
      }
      if (response.type === 'TRANSLATE_TEXT_ERROR') {
        return { ok: false, code: mapBackgroundErrorCode(response.code) }
      }
    }

    if ('error' in response && typeof response.error === 'string') {
      if (response.error === 'internal_error') {
        return { ok: false, code: 'translation_unavailable' }
      }
      return { ok: false, code: 'invalid-response' }
    }

    return { ok: false, code: 'translation_unavailable' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/could not establish connection|receiving end does not exist/i.test(message)) {
      return { ok: false, code: 'translation_unavailable' }
    }
    return { ok: false, code: 'translation_unavailable' }
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}
