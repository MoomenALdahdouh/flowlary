import type { PhysicalHttpContext } from '../../core/runtime/physicalHttp.ts'
import { runWithPhysicalHttp } from '../../core/runtime/physicalHttp.ts'
import type { CorrectionResponse } from '@flowlary/shared'

export type CorrectTextMessage = {
  type: 'CORRECT_TEXT'
  requestId: string
  text: string
  fieldType?: string
  previousText?: string
  mode?: 'practice'
}

export type CorrectTextResponse =
  | {
      type: 'CORRECT_TEXT_RESULT'
      ok: true
      requestId: string
      data: CorrectionResponse
    }
  | {
      type: 'CORRECT_TEXT_RESULT'
      ok: false
      requestId: string
      error: string
      aborted?: boolean
    }

export async function requestCorrectionRemote(
  requestId: string,
  text: string,
  fieldType: string | undefined,
  previousText: string | undefined,
  signal?: AbortSignal,
  mode?: string,
  physical?: PhysicalHttpContext,
): Promise<CorrectTextResponse> {
  const send = () => requestCorrectionRemoteUncapped(
    requestId,
    text,
    fieldType,
    previousText,
    signal,
    mode,
  )
  if (!physical) return send()
  const gated = await runWithPhysicalHttp(physical, send)
  if (!gated.dispatched) {
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'aborted', aborted: true }
  }
  return gated.value
}

async function requestCorrectionRemoteUncapped(
  requestId: string,
  text: string,
  fieldType: string | undefined,
  previousText: string | undefined,
  signal?: AbortSignal,
  mode?: string,
): Promise<CorrectTextResponse> {
  if (signal?.aborted) {
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'aborted', aborted: true }
  }

  const onAbort = () => {
    void cancelCorrectionRemote(requestId)
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    signal?.removeEventListener('abort', onAbort)
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'network' }
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'CORRECT_TEXT',
      requestId,
      text,
      fieldType,
      previousText,
      mode,
    })) as CorrectTextResponse | undefined

    if (signal?.aborted) {
      return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'aborted', aborted: true }
    }
    if (!response) return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'network' }
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (/could not establish connection|receiving end does not exist/i.test(message)) {
      return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'extension_disconnected' }
    }
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'network' }
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function cancelCorrectionRemote(requestId: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
  try {
    await chrome.runtime.sendMessage({ type: 'CANCEL_CORRECT', requestId })
  } catch {
    /* ignore */
  }
}
