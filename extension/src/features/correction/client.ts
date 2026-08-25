import type { CorrectionResponse } from '@flowlary/shared'

export type CorrectTextMessage = {
  type: 'CORRECT_TEXT'
  requestId: string
  text: string
  fieldType?: string
  previousText?: string
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
  groqApiKey: string,
  signal?: AbortSignal,
): Promise<CorrectTextResponse> {
  if (signal?.aborted) {
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'aborted', aborted: true }
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'network' }
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'CORRECT_TEXT',
      requestId,
      text,
      fieldType,
      previousText,
      groqApiKey,
    })) as CorrectTextResponse | undefined

    if (signal?.aborted) {
      return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'aborted', aborted: true }
    }
    if (!response) return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'network' }
    return response
  } catch {
    return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId, error: 'network' }
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
