import {
  CORRECTION_DEFAULTS,
  enrichCorrectionResponseWithExplanations,
  validateCorrectionResponse,
  type CorrectionResponse,
} from '@flowlary/shared'
import { resolvePublicApiUrl } from '../config.ts'
import { ensureFreshWebSession } from './client.ts'
import { ensureWebInstall } from './webInstall.ts'

export type WebCorrectionErrorCode =
  | 'auth'
  | 'credits'
  | 'rate_limited'
  | 'unavailable'
  | 'invalid'
  | 'network'
  | 'aborted'

export type WebCorrectionResult =
  | { ok: true; data: CorrectionResponse }
  | { ok: false; code: WebCorrectionErrorCode }

function mapHttpError(status: number, code?: string): WebCorrectionErrorCode {
  if (status === 401 || code === 'AI_AUTH_FAILED') return 'auth'
  if (code === 'AI_ENTITLEMENT_DENIED' || status === 403) return 'credits'
  if (status === 429 || code === 'AI_RATE_LIMITED') return 'rate_limited'
  if (status >= 500) return 'unavailable'
  return 'invalid'
}

async function correctionHeaders(): Promise<Record<string, string> | null> {
  const session = await ensureFreshWebSession()
  if (!session) return null
  let install
  try {
    install = await ensureWebInstall()
  } catch {
    return null
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.accessToken}`,
    'X-Flowlary-Install-Id': install.installId,
  }
}

/** POST /api/ai/correction — same gateway as the extension background handler. */
export async function requestWebCorrection(
  text: string,
  signal?: AbortSignal,
  options?: { mode?: 'practice' },
): Promise<WebCorrectionResult> {
  if (signal?.aborted) return { ok: false, code: 'aborted' }

  const headers = await correctionHeaders()
  if (!headers) return { ok: false, code: 'auth' }

  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/ai/correction`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text,
        fieldType: 'textarea',
        ...(options?.mode === 'practice' ? { mode: 'practice' } : {}),
      }),
      signal,
    })

    if (signal?.aborted) return { ok: false, code: 'aborted' }

    let body: {
      ok?: boolean
      data?: unknown
      error?: { code?: string }
    } = {}
    try {
      body = (await response.json()) as typeof body
    } catch {
      return { ok: false, code: 'invalid' }
    }

    if (!response.ok || !body.ok || !body.data) {
      return { ok: false, code: mapHttpError(response.status, body.error?.code) }
    }

    const validated = validateCorrectionResponse(body.data, text)
    if (!validated) return { ok: false, code: 'invalid' }

    const enriched = enrichCorrectionResponseWithExplanations(validated)
    return { ok: true, data: enriched }
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return { ok: false, code: 'aborted' }
    }
    return { ok: false, code: 'network' }
  }
}

export const WEB_CORRECTION_MIN_CHARS = CORRECTION_DEFAULTS.MIN_CHARS
export const WEB_CORRECTION_MIN_WORDS = CORRECTION_DEFAULTS.MIN_WORDS
export const WEB_CORRECTION_MAX_CHARS = CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS
